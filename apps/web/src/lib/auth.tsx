import { createContext, useContext, ReactNode } from 'react';
import { useAuthSimple, User } from '../hooks/useAuthSimple';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isChecking: boolean;
  isAuthenticated: boolean;
  refetch: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  isChecking: true,
  isAuthenticated: false,
  refetch: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const { 
    user, 
    loading, 
    isChecking, 
    isAuthenticated,
    refetch
  } = useAuthSimple();

  const value: AuthContextType = {
    user,
    loading,
    isChecking,
    isAuthenticated,
    refetch,
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
