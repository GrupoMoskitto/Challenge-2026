import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import { typeDefs } from './graphql/schema';
import { resolvers } from './graphql/resolvers';

const server = new ApolloServer({
  typeDefs,
  resolvers,
});

async function startServer() {
  const { url } = await startStandaloneServer(server, {
    listen: { port: 3001 },
  });

  console.log(`🚀 GraphQL Server ready at: ${url}`);
  console.log(`📊 GraphQL Playground: ${url}graphql`);
}

startServer();
