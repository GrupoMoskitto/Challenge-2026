import { ApolloClient, InMemoryCache, createHttpLink, ApolloLink, Observable } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';

const httpLink = createHttpLink({
  uri: import.meta.env.VITE_API_URL || 'http://localhost:3001/graphql',
});

const authLink = setContext((_, { headers }) => {
  const token = localStorage.getItem('auth_token');
  
  if (!token) {
    return { headers };
  }
  
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const isExpired = payload.exp * 1000 < Date.now();
    
    if (isExpired) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user');
      window.location.href = '/login';
      return { headers };
    }
    
    return {
      headers: {
        ...headers,
        authorization: `Bearer ${token}`,
      },
    };
  } catch {
    localStorage.removeItem('auth_token');
    return { headers };
  }
});

const securityLink = new ApolloLink((operation, forward) => {
  const token = localStorage.getItem('auth_token');
  
  if (!token && operation.operationName !== 'Login' && operation.operationName !== 'Register') {
    window.location.href = '/login';
    return new Observable(() => {});
  }
  
  return forward(operation);
});

export const apolloClient = new ApolloClient({
  link: securityLink.concat(authLink).concat(httpLink),
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
  const token = localStorage.getItem('auth_token');
  
  if (!token) {
    return null;
  }
  
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const isExpired = payload.exp * 1000 < Date.now();
    
    if (isExpired) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user');
      return null;
    }
    
    return token;
  } catch {
    localStorage.removeItem('auth_token');
    return null;
  }
};

export const setAuthToken = (token: string) => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const isExpired = payload.exp * 1000 < Date.now();
    
    if (isExpired) {
      console.error('Token expirado');
      return;
    }
    
    localStorage.setItem('auth_token', token);
  } catch {
    console.error('Token inválido');
  }
};

export const removeAuthToken = () => {
  localStorage.removeItem('auth_token');
  localStorage.removeItem('user');
};

export const isAuthenticated = (): boolean => {
  return getAuthToken() !== null;
};
