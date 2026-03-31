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
  isChecking: boolean;
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
  isChecking: true,
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
  const [isChecking, setIsChecking] = useState(true);
  const hasToken = hasAuthToken();
  
  const { data, loading, refetch, error } = useQuery<{ me: User }>(GET_ME, {
    skip: !hasToken,
    fetchPolicy: 'network-only',
    onCompleted: (data) => {
      console.log('GET_ME completed:', data);
      setIsChecking(false);
      if (data?.me) {
        console.log('User authenticated:', data.me.email);
        setUser(data.me);
        localStorage.setItem('user', JSON.stringify(data.me));
      } else if (data && data.me === null) {
        console.log('GET_ME returned null - clearing tokens');
        setUser(null);
        localStorage.removeItem('user');
        localStorage.removeItem('auth_token');
        localStorage.removeItem('refresh_token');
      }
    },
    onError: (error) => {
      console.error('GET_ME query error:', error);
      setIsChecking(false);
      // If any GraphQL error occurs (likely auth error), clear tokens
      if (error.graphQLErrors.some(e => e.message.includes('não autenticado') || e.message.includes('Credenciais inválidas'))) {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
        setUser(null);
      }
    }
  });

  // Clear user if no token
  useEffect(() => {
    console.log('hasToken changed:', hasToken);
    if (!hasToken) {
      setUser(null);
      localStorage.removeItem('user');
      setIsChecking(false);
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

  console.log('AuthProvider state:', { user: !!user, loading: isLoading, hasToken, data: !!data, error: !!error, isChecking });

  const value: AuthContextType = {
    user,
    loading: isLoading,
    isChecking,
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
