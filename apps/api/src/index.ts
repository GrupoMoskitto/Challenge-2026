import dotenv from 'dotenv';
import path from 'path';

const projectRoot = path.resolve(__dirname, '../../..');
dotenv.config({ path: path.join(projectRoot, '.env') });
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@as-integrations/express5';
import { typeDefs } from './graphql/schema';
import { resolvers, Context } from './graphql/resolvers';
import { verifyToken, isTokenRevoked, verifyRefreshToken, generateToken, generateRefreshToken, COOKIE_OPTIONS, authRedis } from './auth';
import { prisma } from '@crmed/database';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { getSecurityPlugins, getIntrospectionConfig } from './config/graphql-security';
import { logger } from './config/logger';

const isProduction = process.env.NODE_ENV === 'production';

const app = express();

// --- Security Headers ---
app.use(helmet({
  contentSecurityPolicy: isProduction ? undefined : false, // Disable CSP in dev for GraphQL Sandbox
  crossOriginEmbedderPolicy: false,
}));

// --- Cookie Parser ---
app.use(cookieParser());

// --- CORS Configuration ---
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
  : isProduction
    ? [] // No wildcard in production — must configure CORS_ORIGIN
    : ['http://localhost:3000', 'http://localhost:5173']; // Dev defaults

app.use(cors({
  origin: isProduction
    ? (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          logger.warn('CORS', `Blocked request from origin: ${origin}`);
          callback(new Error('Not allowed by CORS'));
        }
      }
    : allowedOrigins,
  credentials: true, // Required for cookies
}));

app.use(express.json({ limit: '1mb' })); // Limit payload size

// --- Rate Limiting (Redis-backed for distributed deployments) ---
const createRedisStore = (): RedisStore | undefined => {
  try {
    return new RedisStore({
      // Use the auth Redis connection
      sendCommand: (...args: string[]) => authRedis.call(args[0], ...args.slice(1)) as any,
    });
  } catch (err) {
    logger.warn('RateLimit', 'Failed to create Redis store, falling back to in-memory', err);
    return undefined;
  }
};

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 200,
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisStore(),
  message: 'Muitas requisições deste IP, por favor tente novamente mais tarde',
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisStore(),
  message: 'Muitas tentativas de login. Tente novamente em 15 minutos.',
  keyGenerator: (req) => ipKeyGenerator(req),
});

// Apply rate limiting
app.use(apiLimiter);

// --- Apollo Server with Security Plugins ---
const server = new ApolloServer<Context>({
  typeDefs,
  resolvers,
  introspection: getIntrospectionConfig(),
  plugins: getSecurityPlugins(),
});

// --- Auth Refresh Endpoint (REST, cookie-based) ---
app.post('/auth/refresh', loginLimiter, async (req, res) => {
  try {
    const refreshToken = req.cookies?.refresh_token as string | undefined;

    if (!refreshToken) {
      res.status(401).json({ error: 'Refresh token não encontrado' });
      return;
    }

    const decoded = verifyRefreshToken(refreshToken);
    if (!decoded) {
      res.clearCookie('access_token', COOKIE_OPTIONS.CLEAR);
      res.clearCookie('refresh_token', { ...COOKIE_OPTIONS.CLEAR, path: '/auth/refresh' });
      res.status(401).json({ error: 'Refresh token inválido' });
      return;
    }

    // Check blacklist
    const revoked = await isTokenRevoked(decoded.userId);
    if (revoked) {
      res.clearCookie('access_token', COOKIE_OPTIONS.CLEAR);
      res.clearCookie('refresh_token', { ...COOKIE_OPTIONS.CLEAR, path: '/auth/refresh' });
      res.status(401).json({ error: 'Sessão revogada. Faça login novamente.' });
      return;
    }

    // Verify user still exists and is active
    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user || !user.isActive) {
      res.clearCookie('access_token', COOKIE_OPTIONS.CLEAR);
      res.clearCookie('refresh_token', { ...COOKIE_OPTIONS.CLEAR, path: '/auth/refresh' });
      res.status(401).json({ error: 'Usuário não encontrado ou inativo' });
      return;
    }

    const payload = { userId: user.id, email: user.email, role: user.role };
    const newAccessToken = generateToken(payload);
    const newRefreshToken = generateRefreshToken(payload);

    res.cookie('access_token', newAccessToken, COOKIE_OPTIONS.ACCESS_TOKEN);
    res.cookie('refresh_token', newRefreshToken, COOKIE_OPTIONS.REFRESH_TOKEN);
    res.json({ success: true });
  } catch (error) {
    logger.error('Auth:Refresh', 'Error refreshing token', error);
    res.status(500).json({ error: 'Erro interno ao renovar sessão' });
  }
});

// --- Auth Logout Endpoint (clears cookies) ---
app.post('/auth/logout', (_req, res) => {
  res.clearCookie('access_token', COOKIE_OPTIONS.CLEAR);
  res.clearCookie('refresh_token', { ...COOKIE_OPTIONS.CLEAR, path: '/auth/refresh' });
  res.json({ success: true });
});

async function startServer() {
  await server.start();

  app.use(
    '/graphql',
    expressMiddleware(server, {
      context: async ({ req, res }: { req: express.Request; res: express.Response }): Promise<Context> => {
        // 1. Try cookie-based auth first
        let token = (req as Record<string, unknown> & express.Request).cookies?.access_token as string | undefined;

        // 2. Fall back to Bearer token for backward compatibility & API clients
        if (!token) {
          const authHeader = req.headers.authorization;
          if (authHeader?.startsWith('Bearer ')) {
            token = authHeader.substring(7);
          }
        }

        if (token) {
          const payload = verifyToken(token);
          
          if (payload && payload.userId) {
            try {
              // Check token blacklist (revocation)
              const revoked = await isTokenRevoked(payload.userId);
              if (revoked) {
                logger.info('Auth:Context', `Revoked token used by user ${payload.userId}`);
                return { res };
              }

              const dbUser = await prisma.user.findUnique({
                where: { id: payload.userId }
              });

              if (dbUser && dbUser.isActive) {
                return { user: payload, res };
              }
            } catch (error) {
              logger.error('Auth:Context', 'Error verifying user in context', error);
            }
          }
        }
        
        return { res };
      },
    })
  );

  const port = process.env.PORT || 3001;
  app.listen(port, () => {
    logger.success('Server', `🚀 GraphQL Server ready at: http://localhost:${port}/graphql`);
    if (isProduction) {
      logger.info('Security', 'Production mode: introspection disabled, CORS restricted, cookies secure');
    }
  });
}

if (process.env.NODE_ENV !== 'test') {
  startServer();
}
