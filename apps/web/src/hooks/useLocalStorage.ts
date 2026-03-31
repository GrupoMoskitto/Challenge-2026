import { useState, useEffect, useCallback } from 'react';

/**
 * Hook para detectar mudanças no localStorage
 * Resolve o problema de storage event não disparar na mesma aba
 */
export function useLocalStorage(key: string): [string | null, (value: string | null) => void] {
  const [value, setValue] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(key);
  });

  // Função para atualizar o localStorage e o estado
  const updateValue = useCallback((newValue: string | null) => {
    if (newValue === null) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, newValue);
    }
    setValue(newValue);
    // Disparar evento customizado para a mesma aba
    window.dispatchEvent(new CustomEvent('local-storage-change', {
      detail: { key, newValue }
    }));
  }, [key]);

  // Escutar mudanças no localStorage (para outras abas)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === key) {
        setValue(e.newValue);
      }
    };

    // Escutar evento customizado (para mesma aba)
    const handleCustomChange = (e: CustomEvent) => {
      if (e.detail.key === key) {
        setValue(e.detail.newValue);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('local-storage-change', handleCustomChange as EventListener);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('local-storage-change', handleCustomChange as EventListener);
    };
  }, [key]);

  // Sincronizar com mudanças externas no localStorage
  useEffect(() => {
    const interval = setInterval(() => {
      const currentValue = localStorage.getItem(key);
      if (currentValue !== value) {
        setValue(currentValue);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [key, value]);

  return [value, updateValue];
}