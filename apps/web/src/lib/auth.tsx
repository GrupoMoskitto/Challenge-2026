import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { gql, useQuery, useMutation } from '@apollo/client';

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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  
  const { data, loading, refetch } = useQuery<{ me: User }>(GET_ME, {
    skip: !hasAuthToken(),
    fetchPolicy: 'network-only',
    onCompleted: (data) => {
      if (data?.me) {
        setUser(data.me);
        localStorage.setItem('user', JSON.stringify(data.me));
      }
      setIsInitialized(true);
    },
    onError: () => {
      setUser(null);
      localStorage.removeItem('user');
      setIsInitialized(true);
    }
  });

  // Initialize user from localStorage on mount
  useEffect(() => {
    if (!hasAuthToken()) {
      setIsInitialized(true);
      setUser(null);
      return;
    }

    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
      } catch {
        localStorage.removeItem('user');
      }
    }
  }, []);

  // Update user when data changes
  useEffect(() => {
    if (data?.me) {
      setUser(data.me);
      localStorage.setItem('user', JSON.stringify(data.me));
    }
  }, [data]);

  // Listen for token changes (login/logout)
  useEffect(() => {
    const handleStorageChange = () => {
      if (!hasAuthToken()) {
        setUser(null);
        localStorage.removeItem('user');
      } else {
        refetch();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [refetch]);

  const value: AuthContextType = {
    user,
    loading: !isInitialized || (hasAuthToken() && loading),
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
