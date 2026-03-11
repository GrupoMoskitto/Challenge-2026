import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import { typeDefs } from './graphql/schema';
import { resolvers, Context } from './graphql/resolvers';
import { verifyToken } from './auth';
import { prisma } from '@crmed/database';

const server = new ApolloServer({
  typeDefs,
  resolvers,
});

async function startServer() {
  const { url } = await startStandaloneServer(server, {
    listen: { port: 3001 },
    context: async ({ req }): Promise<Context> => {
      const authHeader = req.headers.authorization;
      
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        const payload = verifyToken(token);
        
        if (payload && payload.userId) {
          try {
            // Verify if user still exists and is active in the database
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
  });

  console.log(`🚀 GraphQL Server ready at: ${url}`);
  console.log(`📊 GraphQL Playground: ${url}graphql`);
}

// Only start the server if this file is run directly (not imported)
if (process.env.NODE_ENV !== 'test') {
  startServer();
}
