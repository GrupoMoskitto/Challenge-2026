import { ApolloClient, InMemoryCache, createHttpLink, ApolloLink, Observable } from '@apollo/client';
import { onError } from '@apollo/client/link/error';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/graphql';
const API_BASE = API_URL.replace('/graphql', '');

const httpLink = createHttpLink({
  uri: API_URL,
  credentials: 'include', // Send cookies with every request
});

// Operations that don't need authentication
const PUBLIC_OPERATIONS = ['Login', 'Register', 'RefreshToken'];

// Mutex to prevent multiple simultaneous refresh attempts
let refreshPromise: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const response = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        credentials: 'include', // Send cookies
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        return true; // Cookies are automatically updated by the browser
      }
    } catch (error) {
      console.error('Failed to refresh token:', error);
    }

    // Refresh failed — clear local user data
    localStorage.removeItem('user');
    return false;
  })();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

// Link to handle token refresh on auth errors
const refreshLink = new ApolloLink((operation, forward) => {
  return new Observable((observer) => {
    forward(operation).subscribe({
      next: observer.next.bind(observer),
      error: async (error) => {
        // If we get an auth error, try refreshing the token
        const isAuthError = error?.statusCode === 401 ||
          error?.message?.includes('não autenticado');

        if (isAuthError && !PUBLIC_OPERATIONS.includes(operation.operationName || '')) {
          const refreshed = await refreshAccessToken();
          if (refreshed) {
            // Retry the original operation
            forward(operation).subscribe({
              next: observer.next.bind(observer),
              error: observer.error.bind(observer),
              complete: observer.complete.bind(observer),
            });
            return;
          }
        }
        observer.error(error);
      },
      complete: observer.complete.bind(observer),
    });
  });
});

const errorLink = onError(({ graphQLErrors, networkError }) => {
  if (graphQLErrors) {
    graphQLErrors.forEach(({ message, locations, path, extensions }) => {
      console.error(
        `[GraphQL error]: Message: ${message}, Location: ${locations}, Path: ${path}`
      );
      // On auth errors, clear local user data (cookies are managed server-side)
      if (extensions?.code === 'UNAUTHENTICATED' || 
          message.includes('não autenticado')) {
        localStorage.removeItem('user');
      }
    });
  }
  if (networkError) {
    console.error(`[Network error]: ${networkError}`);
    if ('statusCode' in networkError && networkError.statusCode === 401) {
      localStorage.removeItem('user');
    }
  }
});

export const apolloClient = new ApolloClient({
  link: errorLink.concat(refreshLink).concat(httpLink),
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

/**
 * Logout — calls the server to clear HTTP-Only cookies
 */
export async function serverLogout(): Promise<void> {
  try {
    await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    });
  } catch (error) {
    console.error('Logout request failed:', error);
  }
  localStorage.removeItem('user');
}

/**
 * Check if user appears to be authenticated
 * (actual token validation happens server-side via cookies)
 */
export const isAuthenticated = (): boolean => {
  return !!localStorage.getItem('user');
};
