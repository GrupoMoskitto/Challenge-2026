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
import multer from 'multer';
import fs from 'fs';
import { getSecurityPlugins, getIntrospectionConfig } from './config/graphql-security';
import { logger } from './config/logger';

const isProduction = process.env.NODE_ENV === 'production';

const app = express();

app.use(helmet({
  contentSecurityPolicy: isProduction ? undefined : false,
  crossOriginEmbedderPolicy: false,
}));

app.use(cookieParser());

const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
  : isProduction
    ? []
    : ['http://localhost:3000', 'http://localhost:5173'];

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
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

const createRedisStore = (): RedisStore | undefined => {
  try {
    return new RedisStore({
      sendCommand: (...args: string[]) => authRedis.call(args[0], ...args.slice(1)) as any,
    });
  } catch (err) {
    logger.warn('RateLimit', 'Failed to create Redis store, falling back to in-memory', err);
    return undefined;
  }
};

const isLocalhost = (req: express.Request) => {
  const ip = req.ip || req.socket.remoteAddress || '';
  return ip === '127.0.0.1' || ip === '::1' || ip.includes('127.0.0.1');
};

const rateLimitHandler = (req: express.Request, res: express.Response, next: express.NextFunction, options: import('express-rate-limit').Options) => {
  res.status(options.statusCode).json({
    errors: [
      {
        message: options.message,
        extensions: { code: 'RATE_LIMITED' },
      },
    ],
  });
};

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisStore(),
  message: 'Muitas requisições deste IP, por favor tente novamente mais tarde',
  handler: rateLimitHandler,
  skip: (req) => (!isProduction && isLocalhost(req)),
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisStore(),
  message: 'Muitas tentativas de login. Tente novamente em 15 minutos.',
  keyGenerator: (req) => ipKeyGenerator(req.ip || ""),
  handler: rateLimitHandler,
  skip: (req) => (!isProduction && isLocalhost(req)),
});

const mutationLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  store: createRedisStore(),
  message: 'Limite de mutações excedido. Tente novamente mais tarde.',
  keyGenerator: (req) => `mutation:${ipKeyGenerator(req.ip || '')}`,
  handler: rateLimitHandler,
  skip: (req) => {
    if (!isProduction && isLocalhost(req)) return true;
    const body = req.body as Record<string, unknown> | undefined;
    const query = (body?.query as string) || '';
    return !query.trimStart().startsWith('mutation');
  },
});

app.use(apiLimiter);
app.use(mutationLimiter);

const server = new ApolloServer<Context>({
  typeDefs,
  resolvers,
  introspection: getIntrospectionConfig(),
  plugins: getSecurityPlugins(),
});

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

    const revoked = await isTokenRevoked(decoded.userId);
    if (revoked) {
      res.clearCookie('access_token', COOKIE_OPTIONS.CLEAR);
      res.clearCookie('refresh_token', { ...COOKIE_OPTIONS.CLEAR, path: '/auth/refresh' });
      res.status(401).json({ error: 'Sessão revogada. Faça login novamente.' });
      return;
    }

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

app.post('/auth/logout', (_req, res) => {
  res.clearCookie('access_token', COOKIE_OPTIONS.CLEAR);
  res.clearCookie('refresh_token', { ...COOKIE_OPTIONS.CLEAR, path: '/auth/refresh' });
  res.json({ success: true });
});

const requireAuth = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  let token = req.cookies?.access_token as string | undefined;
  if (!token && req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.substring(7);
  }

  if (!token) {
    res.status(401).json({ error: 'Não autorizado' });
    return;
  }

  try {
    const payload = verifyToken(token);
    if (!payload || !payload.userId) {
      res.status(401).json({ error: 'Token inválido' });
      return;
    }
    const revoked = await isTokenRevoked(payload.userId);
    if (revoked) {
      res.status(401).json({ error: 'Sessão revogada' });
      return;
    }
    next();
  } catch (error) {
    res.status(401).json({ error: 'Token inválido ou expirado' });
  }
};

const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const allowedMimeTypes = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv'
];

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de arquivo não permitido. Envie apenas imagens, PDFs, CSV, ou documentos Office.') as any, false);
    }
  }
});
app.post('/api/upload', requireAuth, (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo recebido' });
    }
    
    const fileUrl = `/api/uploads/${req.file.filename}`;
    res.json({ 
      url: fileUrl, 
      type: req.file.mimetype,
      filename: req.file.originalname 
    });
  });
});

app.get('/api/uploads/:filename', requireAuth, (req, res) => {
  const filename = req.params.filename as string;
  if (filename.includes('..') || filename.includes('/')) {
     res.status(400).json({ error: 'Caminho inválido' });
     return;
  }
  const filePath = path.join(uploadDir, filename);
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: 'Arquivo não encontrado' });
    return;
  }
  res.sendFile(filePath);
});


async function startServer() {
  await server.start();

  app.use(
    '/graphql',
    expressMiddleware(server, {
      context: async ({ req, res }: { req: express.Request; res: express.Response }): Promise<Context> => {
        // Internal bypass for workers and system tasks
        const internalKey = req.headers['x-internal-key'];
        const validInternalKey = process.env.INTERNAL_API_KEY || 'internal-secret-key';
        
        if (internalKey === validInternalKey) {
          return {
            user: {
              userId: 'system',
              email: 'system@crmed.internal',
              role: 'ADMIN',
            },
            res,
            ip: req.ip,
          };
        }

        let token = (req as Record<string, unknown> & express.Request).cookies?.access_token as string | undefined;

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
      logger.info('Security', 'Production mode active');
    }
  });
}

if (process.env.NODE_ENV !== 'test') {
  startServer();
}
