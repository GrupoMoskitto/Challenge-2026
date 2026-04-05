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

// Mutex to prevent multiple simultaneous refresh attempts
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  // If a refresh is already in progress, wait for it instead of starting a new one
  if (refreshPromise) {
    return refreshPromise;
  }

  const refreshToken = localStorage.getItem('refresh_token');
  
  if (!refreshToken) {
    return null;
  }

  refreshPromise = (async () => {
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
    
    // Refresh failed — clear tokens but do NOT hard redirect.
    // Let AuthProvider and ProtectedRoute handle the redirect via React.
    localStorage.removeItem('auth_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    return null;
  })();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
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

// Operations that don't need authentication
const PUBLIC_OPERATIONS = ['Login', 'Register', 'RefreshToken'];

const authLink = setContext(async (operation, { headers }) => {
  // Don't try to attach/refresh tokens for public operations
  if (PUBLIC_OPERATIONS.includes(operation.operationName || '')) {
    return { headers };
  }

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
  // Skip security check for public operations and login page
  if (PUBLIC_OPERATIONS.includes(operation.operationName || '') || window.location.pathname === '/login') {
    return forward(operation);
  }

  const token = getAccessToken();
  const refreshToken = localStorage.getItem('refresh_token');
  
  // No tokens at all — clear storage and let React handle redirect
  if (!token && !refreshToken) {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    // Don't hard redirect — return empty observable, React/ProtectedRoute will handle it
    return new Observable(() => {});
  }
  
  return forward(operation);
});

const errorLink = onError(({ graphQLErrors, networkError, operation }) => {
  if (graphQLErrors) {
    graphQLErrors.forEach(({ message, locations, path, extensions }) => {
      console.error(
        `[GraphQL error]: Message: ${message}, Location: ${locations}, Path: ${path}`
      );
      // On auth errors, clear tokens — React/ProtectedRoute will redirect to login
      if (extensions?.code === 'UNAUTHENTICATED' || 
          message.includes('não autenticado')) {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
      }
    });
  }
  if (networkError) {
    console.error(`[Network error]: ${networkError}`);
    if ('statusCode' in networkError && networkError.statusCode === 401) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user');
    }
  }
});

export const apolloClient = new ApolloClient({
  link: errorLink.concat(securityLink).concat(authLink).concat(httpLink),
  cache: new InMemoryCache(),
  defaultOptions: {
    watchQuery: {
      fetchPolicy: 'cache-and-network',
      errorPolicy: 'all',
    },
    query: {
      fetchPolicy: 'cache-first',
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
