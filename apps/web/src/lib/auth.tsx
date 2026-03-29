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

export function AuthProvider({ children }: { children: ReactNode }) {
  const storedUser = localStorage.getItem('user');
  const initialUser = storedUser ? JSON.parse(storedUser) : null;
  
  const [user, setUser] = useState<User | null>(initialUser);
  const { data, loading, refetch } = useQuery<{ me: User }>(GET_ME, {
    fetchPolicy: 'network-only',
  });

  useEffect(() => {
    if (data?.me) {
      setUser(data.me);
      localStorage.setItem('user', JSON.stringify(data.me));
    } else if (!loading && !data?.me) {
      // User not authenticated, clear localStorage
      localStorage.removeItem('user');
      setUser(null);
    }
  }, [data, loading]);

  return (
    <AuthContext.Provider value={{ user, loading, refetch }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
