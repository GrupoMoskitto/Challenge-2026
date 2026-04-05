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
  login: (token: string, refreshToken: string, userData: User) => void;
  logout: () => void;
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
  login: () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    if (typeof window === 'undefined') return null;
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  });

  const hasToken = typeof window !== 'undefined' && !!localStorage.getItem('auth_token');
  
  const { data, loading, error, refetch } = useQuery<{ me: User }>(GET_ME, {
    skip: !hasToken,
    fetchPolicy: 'network-only',
  });

  useEffect(() => {
    if (data?.me) {
      setUser(data.me);
      localStorage.setItem('user', JSON.stringify(data.me));
    } else if (data && !data.me) {
      // User null - invalid token
      setUser(null);
      localStorage.removeItem('user');
      localStorage.removeItem('auth_token');
      localStorage.removeItem('refresh_token');
    }
  }, [data]);

  // Clean up stale auth when GetMe fails (e.g. after server restart with old tokens)
  useEffect(() => {
    if (error && hasToken) {
      const isAuthError = error.graphQLErrors?.some(
        (e) => e.extensions?.code === 'UNAUTHENTICATED' || e.message.includes('não autenticado')
      ) || error.networkError;
      if (isAuthError) {
        setUser(null);
        localStorage.removeItem('user');
        localStorage.removeItem('auth_token');
        localStorage.removeItem('refresh_token');
      }
    }
  }, [error, hasToken]);

  // Clear user if no token
  useEffect(() => {
    if (!hasToken) {
      setUser(null);
      localStorage.removeItem('user');
    }
  }, [hasToken]);

  const login = (token: string, refreshToken: string, userData: User) => {
    localStorage.setItem('auth_token', token);
    localStorage.setItem('refresh_token', refreshToken);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    setUser(null);
  };

  const value: AuthContextType = {
    user,
    loading: hasToken && !user && loading,
    refetch,
    login,
    logout,
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
