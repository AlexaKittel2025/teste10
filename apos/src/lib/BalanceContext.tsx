'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useSession } from 'next-auth/react';
// Não importamos o router diretamente aqui

interface BalanceContextType {
  userBalance: number;
  refreshBalance: () => Promise<void>;
  updateBalance: (newBalance: number) => void;
  isLoadingBalance: boolean;
}

const BalanceContext = createContext<BalanceContextType | undefined>(undefined);

export const BalanceProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { data: session, status } = useSession();
  const [userBalance, setUserBalance] = useState(0);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  // Verificar se estamos no cliente antes de usar funcionalidades que dependem do navegador
  useEffect(() => {
    setMounted(true);
  }, []);

  const redirectToLogin = () => {
    // Usar window.location apenas depois que o componente estiver montado no cliente
    if (mounted && typeof window !== 'undefined') {
      const currentPath = window.location.pathname;
      // Não redirecionar se já estiver na página de login ou registro
      if (!currentPath.startsWith('/auth/')) {
        window.location.href = '/auth/login';
      }
    }
  };

  const fetchBalance = async () => {
    // Não fazer a chamada se o usuário não estiver autenticado
    if (!session?.user?.id) {
      console.log("Sem sessão de usuário válida para buscar saldo");
      return userBalance;
    }

    // Implementar um sistema de debounce sem bloquear outras chamadas
    // Apenas registramos que uma atualização está em andamento
    const isCurrentlyLoading = isLoadingBalance;
    setIsLoadingBalance(true);
    setLastError(null);
    
    try {
      const timestamp = new Date().getTime();
      console.log(`Buscando saldo para usuário ${session.user.id} em ${timestamp}`);
      
      // Adicionar um parâmetro de tempo para evitar cache
      const response = await fetch(`/api/user/balance?_=${timestamp}&force=true`, {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        },
        // Adicionar o método GET explicitamente
        method: 'GET'
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log(`Saldo obtido: ${data.balance}`);
        
        // Verificar se o saldo mudou antes de atualizar o estado
        if (data.balance !== userBalance) {
          console.log(`Atualizando saldo visual de ${userBalance} para ${data.balance}`);
          setUserBalance(data.balance);
        } else {
          console.log('Saldo obtido igual ao atual, sem necessidade de atualização visual');
        }
        
        return data.balance;
      } else {
        const errorText = await response.text();
        setLastError(`Resposta não-OK: ${response.status}`);
        console.error('Erro ao buscar saldo:', response.status, errorText);
        
        // Se receber 401 ou 403, pode ser problema de autenticação
        if ((response.status === 401 || response.status === 403) && mounted) {
          console.log("Problema de autenticação detectado, redirecionando para login");
          redirectToLogin();
          return userBalance;
        }
        
        // Segunda tentativa com cabeçalhos diferentes
        try {
          console.log('Tentando buscar saldo novamente com outra abordagem...');
          const retryResponse = await fetch(`/api/user/balance?retry=1&_=${timestamp + 1}&nocache=true`, {
            headers: {
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache',
              'Expires': '0',
              'X-Requested-With': 'XMLHttpRequest'
            },
            method: 'GET'
          });
          
          if (retryResponse.ok) {
            const retryData = await retryResponse.json();
            console.log(`Saldo obtido na segunda tentativa: ${retryData.balance}`);
            setUserBalance(retryData.balance);
            return retryData.balance;
          } else {
            setLastError(`Falha na segunda tentativa: ${retryResponse.status}`);
          }
        } catch (retryError) {
          console.error('Erro na segunda tentativa de buscar saldo:', retryError);
          setLastError(`Erro de rede na segunda tentativa`);
        }
      }
    } catch (error) {
      console.error('Erro ao buscar saldo:', error);
      setLastError('Erro de rede ao buscar saldo');
    } finally {
      setIsLoadingBalance(false);
    }
    return userBalance;
  };

  // Atualizar saldo quando a sessão mudar
  useEffect(() => {
    if (!mounted) return; // Não executa no servidor ou antes da montagem
    
    const handleSessionChange = async () => {
      // Verificar se a sessão está completa e pronta
      if (status === 'authenticated' && session?.user?.id) {
        console.log('Sessão autenticada, buscando saldo inicial');
        await fetchBalance();
      } else if (status === 'unauthenticated') {
        console.log('Usuário não autenticado');
        redirectToLogin();
      }
    };

    handleSessionChange();
  }, [session, status, mounted]);

  // Função para atualizar o saldo manualmente com retry
  const refreshBalance = async () => {
    try {
      console.log("Iniciando atualização de saldo (refreshBalance)");
      // Primeira tentativa
      const balance = await fetchBalance();
      
      // Se falhar, tente novamente após um breve intervalo
      if (balance === undefined) {
        console.log("Primeira tentativa de atualização falhou, agendando nova tentativa...");
        // Usar setTimeout para tentar novamente
        setTimeout(async () => {
          console.log("Executando segunda tentativa de atualização...");
          await fetchBalance();
        }, 800);
      }
      
      return balance;
    } catch (error) {
      console.error("Erro ao atualizar saldo:", error);
      return userBalance;
    }
  };

  // Função para atualizar o saldo localmente (sem fazer chamada à API)
  const updateBalance = (newBalance: number) => {
    setUserBalance(newBalance);
  };

  return (
    <BalanceContext.Provider value={{ 
      userBalance, 
      refreshBalance, 
      updateBalance,
      isLoadingBalance 
    }}>
      {children}
    </BalanceContext.Provider>
  );
};

export const useBalance = () => {
  const context = useContext(BalanceContext);
  if (context === undefined) {
    throw new Error('useBalance deve ser usado dentro de um BalanceProvider');
  }
  return context;
}; 