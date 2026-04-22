import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { gql, useQuery } from '@apollo/client';
import { serverLogout } from './apollo';

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
  login: (userData: User) => void;
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

  // We always try to fetch the current user — cookies are sent automatically
  const hasStoredUser = typeof window !== 'undefined' && !!localStorage.getItem('user');
  
  const { data, loading, error, refetch } = useQuery<{ me: User }>(GET_ME, {
    skip: !hasStoredUser,
    fetchPolicy: 'network-only',
  });

  useEffect(() => {
    if (data?.me) {
      setUser(data.me);
      localStorage.setItem('user', JSON.stringify(data.me));
    } else if (data && !data.me) {
      // User null - invalid/expired session
      setUser(null);
      localStorage.removeItem('user');
    }
  }, [data]);

  // Clean up stale auth when GetMe fails
  useEffect(() => {
    if (error && hasStoredUser) {
      const isAuthError = error.graphQLErrors?.some(
        (e) => e.extensions?.code === 'UNAUTHENTICATED' || e.message.includes('não autenticado')
      ) || error.networkError;
      if (isAuthError) {
        setUser(null);
        localStorage.removeItem('user');
      }
    }
  }, [error, hasStoredUser]);

  // Clear user if no stored user data
  useEffect(() => {
    if (!hasStoredUser) {
      setUser(null);
    }
  }, [hasStoredUser]);

  /**
   * Called after a successful login mutation.
   * Tokens are set as HTTP-Only cookies by the server — we only store the user data.
   */
  const login = (userData: User) => {
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
  };

  /**
   * Logout: calls the server to clear HTTP-Only cookies, then clears local state.
   */
  const logout = async () => {
    await serverLogout();
    setUser(null);
  };

  const value: AuthContextType = {
    user,
    loading: hasStoredUser && !user && loading,
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
