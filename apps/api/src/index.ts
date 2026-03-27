import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@as-integrations/express5';
import { typeDefs } from './graphql/schema';
import { resolvers, Context } from './graphql/resolvers';
import { verifyToken } from './auth';
import { prisma } from '@crmed/database';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

const app = express();

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  limit: 200, 
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Muitas requisições deste IP, por favor tente novamente mais tarde'
});

const server = new ApolloServer<Context>({
  typeDefs,
  resolvers,
});

async function startServer() {
  await server.start();

  app.use(cors());
  app.use(express.json());
  
  // Apply rate limiting to all requests
  app.use(limiter);

  app.use(
    '/graphql',
    expressMiddleware(server, {
      context: async ({ req }: { req: express.Request }): Promise<Context> => {
        const authHeader = req.headers.authorization;
        
        if (authHeader?.startsWith('Bearer ')) {
          const token = authHeader.substring(7);
          const payload = verifyToken(token);
          
          if (payload && payload.userId) {
            try {
              const dbUser = await prisma.user.findUnique({
                where: { id: payload.userId }
              });

              if (dbUser && dbUser.isActive) {
                return { user: payload };
              }
            } catch (error) {
              console.error('Error verifying user in context:', error);
            }
          }
        }
        
        return {};
      },
    })
  );

  const port = process.env.PORT || 3001;
  app.listen(port, () => {
    console.log(`🚀 GraphQL Server ready at: http://localhost:${port}/graphql`);
  });
}

if (process.env.NODE_ENV !== 'test') {
  startServer();
}
