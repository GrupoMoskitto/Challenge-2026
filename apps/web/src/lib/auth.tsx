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
  loading: false,
  refetch: () => {},
});

const hasAuthToken = (): boolean => {
  return localStorage.getItem('auth_token') !== null;
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const storedUser = localStorage.getItem('user');
  const initialUser = storedUser ? JSON.parse(storedUser) : null;
  
  const [user, setUser] = useState<User | null>(initialUser);
  const [shouldQuery, setShouldQuery] = useState(hasAuthToken());
  
  const { data, loading, refetch } = useQuery<{ me: User }>(GET_ME, {
    skip: !shouldQuery,
    fetchPolicy: 'network-only',
    onError: () => {
      // If query fails, don't retry
      setShouldQuery(false);
      setUser(null);
      localStorage.removeItem('user');
    }
  });

  useEffect(() => {
    if (data?.me) {
      setUser(data.me);
      localStorage.setItem('user', JSON.stringify(data.me));
    }
  }, [data]);

  // Listen for token changes (login/logout)
  useEffect(() => {
    const handleStorageChange = () => {
      const hasToken = hasAuthToken();
      setShouldQuery(hasToken);
      if (!hasToken) {
        setUser(null);
        localStorage.removeItem('user');
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const value: AuthContextType = {
    user,
    loading: shouldQuery && loading,
    refetch: () => {
      if (hasAuthToken()) {
        setShouldQuery(true);
        refetch();
      }
    }
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
