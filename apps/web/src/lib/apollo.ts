import { ApolloClient, InMemoryCache, createHttpLink, ApolloLink, Observable } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { onError } from '@apollo/client/link/error';
import { gql } from '@apollo/client';

const httpLink = createHttpLink({
  uri: import.meta.env.VITE_API_URL || 'http://localhost:3001/graphql',
});

const REFRESH_TOKEN_MUTATION = gql`
  mutation RefreshToken($token: String!) {
    refreshToken(token: $token) {
      token
      refreshToken
    }
  }
`;

const TOKEN_EXPIRY_BUFFER = 60 * 1000;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem('refresh_token');
  
  if (!refreshToken) {
    return null;
  }
  
  try {
    const response = await fetch(import.meta.env.VITE_API_URL || 'http://localhost:3001/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        operationName: 'RefreshToken',
        query: REFRESH_TOKEN_MUTATION.loc?.source.body,
        variables: { token: refreshToken },
      }),
    });
    
    const result = await response.json();
    
    if (result.data?.refreshToken) {
      const { token, refreshToken: newRefreshToken } = result.data.refreshToken;
      localStorage.setItem('auth_token', token);
      localStorage.setItem('refresh_token', newRefreshToken);
      return token;
    }
  } catch (error) {
    console.error('Failed to refresh token:', error);
  }
  
  localStorage.removeItem('auth_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('user');
  window.location.href = '/login';
  return null;
}

function getAccessToken(): string | null {
  const token = localStorage.getItem('auth_token');
  
  if (!token) {
    return null;
  }
  
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const isExpired = payload.exp * 1000 < Date.now();
    
    if (isExpired) {
      return null;
    }
    
    return token;
  } catch {
    return null;
  }
}

const authLink = setContext(async (_, { headers }) => {
  let token = getAccessToken();
  
  if (!token) {
    token = await refreshAccessToken();
  }
  
  if (!token) {
    return { headers };
  }
  
  return {
    headers: {
      ...headers,
      authorization: `Bearer ${token}`,
    },
  };
});

const securityLink = new ApolloLink((operation, forward) => {
  const token = getAccessToken();
  const refreshToken = localStorage.getItem('refresh_token');
  const isOnLoginPage = window.location.pathname === '/login';
  
  if (!token && !refreshToken && operation.operationName !== 'Login' && operation.operationName !== 'Register' && operation.operationName !== 'RefreshToken' && !isOnLoginPage) {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    window.location.href = '/login';
    return new Observable(() => {});
  }
  
  return forward(operation);
});

const errorLink = onError(({ graphQLErrors, networkError }) => {
  if (graphQLErrors) {
    graphQLErrors.forEach(({ message, locations, path, extensions }) => {
      console.error(
        `[GraphQL error]: Message: ${message}, Location: ${locations}, Path: ${path}`
      );
      // Check for authentication errors
      if (extensions?.code === 'UNAUTHENTICATED' || 
          message.includes('não autenticado') || 
          message.includes('Credenciais inválidas')) {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    });
  }
  if (networkError) {
    console.error(`[Network error]: ${networkError}`);
    // If network error is 401 Unauthorized, redirect to login
    if ('statusCode' in networkError && networkError.statusCode === 401) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
  }
});

export const apolloClient = new ApolloClient({
  link: errorLink.concat(securityLink).concat(authLink).concat(httpLink),
  cache: new InMemoryCache(),
  defaultOptions: {
    watchQuery: {
      fetchPolicy: 'network-only',
      errorPolicy: 'all',
    },
    query: {
      fetchPolicy: 'network-only',
      errorPolicy: 'all',
    },
    mutate: {
      errorPolicy: 'all',
    },
  },
});

export const getAuthToken = (): string | null => {
  return getAccessToken();
};

export const setAuthToken = (token: string, refreshToken: string) => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const isExpired = payload.exp * 1000 < Date.now();
    
    if (isExpired) {
      console.error('Token expirado');
      return;
    }
    
    localStorage.setItem('auth_token', token);
    localStorage.setItem('refresh_token', refreshToken);
  } catch {
    console.error('Token inválido');
  }
};

export const removeAuthToken = () => {
  localStorage.removeItem('auth_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('user');
};

export const isAuthenticated = (): boolean => {
  return getAccessToken() !== null;
};
