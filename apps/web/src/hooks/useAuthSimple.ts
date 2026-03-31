import { useState, useEffect, useMemo } from 'react';
import { useQuery, gql } from '@apollo/client';
import { useLocalStorage } from './useLocalStorage';

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
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

/**
 * Hook simplificado de autenticação que resolve problemas de loop
 */
export function useAuthSimple() {
  const [storedUser, setStoredUser] = useLocalStorage('user');
  const [authToken] = useLocalStorage('auth_token');
  
  const hasToken = !!authToken;
  
  const { data, loading, refetch, error } = useQuery<{ me: User }>(GET_ME, {
    skip: !hasToken,
    fetchPolicy: 'network-only',
  });

  // Determinar se ainda está verificando
  const isChecking = useMemo(() => {
    if (!hasToken) return false;
    if (loading) return true;
    if (error || data) return false;
    return true;
  }, [hasToken, loading, error, data]);

  // Processar resultado da query
  useEffect(() => {
    if (error) {
      console.error('Auth error:', error);
      // Se token inválido, limpar tudo
      if (error.graphQLErrors.some(e => 
        e.message.includes('não autenticado') || 
        e.message.includes('Credenciais inválidas')
      )) {
        setStoredUser(null);
        localStorage.removeItem('auth_token');
        localStorage.removeItem('refresh_token');
      }
      return;
    }

    if (data) {
      if (data.me) {
        // Usuário válido - atualizar storage
        setStoredUser(JSON.stringify(data.me));
      } else {
        // Usuário null - token inválido ou não existe
        setStoredUser(null);
        localStorage.removeItem('auth_token');
        localStorage.removeItem('refresh_token');
      }
    }
  }, [data, error, setStoredUser]);

  // Determinar estado do usuário
  const user = storedUser ? JSON.parse(storedUser) : null;
  const isLoading = hasToken && !user && loading;
  const isAuthenticated = !!user && !!authToken;

  return {
    user,
    loading: isLoading,
    isChecking,
    isAuthenticated,
    refetch,
  };
}