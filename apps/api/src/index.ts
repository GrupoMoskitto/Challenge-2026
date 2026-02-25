import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import { typeDefs } from './graphql/schema';
import { resolvers, Context } from './graphql/resolvers';
import { verifyToken } from './auth';

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
        
        if (payload) {
          return { user: payload };
        }
      }
      
      return {};
    },
  });

  console.log(`🚀 GraphQL Server ready at: ${url}`);
  console.log(`📊 GraphQL Playground: ${url}graphql`);
}

startServer();
