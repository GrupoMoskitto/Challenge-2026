import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { gql, useQuery } from '@apollo/client';

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  refetch: () => void;
}

const GET_ME = gql`
  query GetMe {
    me {
      id
      name
      email
      role
      isActive
      createdAt
    }
  }
`;

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  refetch: () => {},
});

const hasAuthToken = (): boolean => {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('auth_token') !== null;
};

const getStoredUser = (): User | null => {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(getStoredUser);
  const hasToken = hasAuthToken();
  
  const { data, loading, refetch, error } = useQuery<{ me: User }>(GET_ME, {
    skip: !hasToken,
    fetchPolicy: 'network-only',
    onError: (error) => {
      console.error('GET_ME query error:', error);
      // If any GraphQL error occurs (likely auth error), clear tokens and redirect
      if (error.graphQLErrors.some(e => e.message.includes('não autenticado') || e.message.includes('Credenciais inválidas'))) {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }
  });

  // Sync user from query result
  useEffect(() => {
    if (data?.me) {
      setUser(data.me);
      localStorage.setItem('user', JSON.stringify(data.me));
    } else if (data && data.me === null) {
      // Query returned but user is null (invalid token or user not found)
      setUser(null);
      localStorage.removeItem('user');
      localStorage.removeItem('auth_token');
      localStorage.removeItem('refresh_token');
      window.location.href = '/login';
    }
  }, [data]);

  // Redirect on auth error
  useEffect(() => {
    if (error) {
      console.error('Auth error:', error);
      localStorage.removeItem('auth_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
  }, [error]);

  // Clear user if no token
  useEffect(() => {
    if (!hasToken) {
      setUser(null);
      localStorage.removeItem('user');
    }
  }, [hasToken]);

  // Listen for token changes (login/logout)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'auth_token' || e.key === 'user') {
        if (!hasAuthToken()) {
          setUser(null);
          localStorage.removeItem('user');
        } else {
          const storedUser = getStoredUser();
          if (storedUser) {
            setUser(storedUser);
          }
          refetch();
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [refetch]);

  // Determine loading state
  // If we have a stored user, show it immediately (optimistic)
  // Only show loading if we have token but no stored user yet
  const isLoading = hasToken && !user && loading;

  console.log('AuthProvider state:', { user: !!user, loading: isLoading, hasToken, data: !!data, error: !!error });

  const value: AuthContextType = {
    user,
    loading: isLoading,
    refetch
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
