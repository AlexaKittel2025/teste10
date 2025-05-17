'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useBalance } from '@/lib/BalanceContext';
import ChatSupport from '@/components/ChatSupport';
import Tooltip from '@/components/Tooltip';

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { userBalance, updateBalance, refreshBalance, isLoadingBalance } = useBalance();
  
  // Referência para o input de detalhes de saque
  const withdrawDetailsRef = React.useRef<HTMLInputElement>(null);
  
  // Estados para os modais
  const [showEditModal, setShowEditModal] = useState(false);
  const [showRechargeModal, setShowRechargeModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [showChatModal, setShowChatModal] = useState(false);
  
  // Estados para os formulários
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
  });
  
  const [rechargeAmount, setRechargeAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawDetailsValue, setWithdrawDetailsValue] = useState('');
  
  // Estados para feedback
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Estado para as transações do usuário
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  
  // Estados para totais financeiros
  const [totalDeposits, setTotalDeposits] = useState<number>(0);
  const [totalWithdrawals, setTotalWithdrawals] = useState<number>(0);
  const [totalBets, setTotalBets] = useState<number>(0);
  const [loadingBets, setLoadingBets] = useState<boolean>(false);
  
  // Estado para o limite diário de apostas
  const [dailyBetLimit, setDailyBetLimit] = useState<number>(5000);
  const [savingBetLimit, setSavingBetLimit] = useState(false);
  const [showBetLimitModal, setShowBetLimitModal] = useState(false);
  const [newBetLimit, setNewBetLimit] = useState('');
  
  // Estado para o nível do usuário
  const [userLevel, setUserLevel] = useState<number>(1);
  
  // Função para obter o nome do nível com base no número
  const getLevelName = (level: number): string => {
    switch(level) {
      case 1: return 'Iniciante';
      case 2: return 'Amador';
      case 3: return 'Aprendiz';
      case 4: return 'Competidor';
      case 5: return 'Especialista';
      case 6: return 'Prata';
      case 7: return 'Ouro';
      case 8: return 'Platina';
      case 9: return 'Diamante';
      case 10: return 'Mestre';
      default: return `Nível ${level}`;
    }
  };
  
  // Carregar o nível do usuário
  useEffect(() => {
    if (session?.user?.id) {
      // Buscar o nível do usuário da API
      fetch('/api/user/level')
        .then(response => {
          if (response.ok) {
            return response.json();
          }
          return { user: { level: 1 } };
        })
        .then(data => {
          if (data?.user?.level) {
            setUserLevel(data.user.level);
          }
        })
        .catch(error => {
          console.error('Erro ao buscar nível do usuário:', error);
        });
    }
  }, [session?.user?.id]);
  
  // Função para buscar todas as apostas do usuário
  const fetchUserBets = async () => {
    if (!session) return;
    
    try {
      setLoadingBets(true);
      // Usando o novo endpoint específico para estatísticas de apostas
      const response = await fetch('/api/user/bet-stats?' + new Date().getTime(), {
        // Adicionar um parâmetro de cache-busting para evitar cache
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      // Mesmo com status não-ok, tentamos parsear a resposta
      const data = await response.json().catch(() => ({ totalBets: 0, error: 'Erro ao parsear resposta' }));
      
      if (!response.ok) {
        console.error('Erro ao carregar estatísticas de apostas do usuário:', data.message || 'Erro desconhecido');
        // Mesmo com erro, podemos usar os dados se existirem
        if (data && typeof data.totalBets === 'number') {
          setTotalBets(data.totalBets);
        }
        return;
      }
      
      // Verificar se o total de apostas está presente na resposta
      if (data && typeof data.totalBets === 'number') {
        console.log('Total de apostas carregado:', data.totalBets);
        setTotalBets(data.totalBets);
      } else {
        console.error('Formato de resposta inválido - totalBets não encontrado:', data);
        // Se não temos dados válidos mas a resposta foi ok, assumimos zero
        setTotalBets(0);
      }
    } catch (error) {
      console.error('Erro ao buscar estatísticas de apostas do usuário:', error);
      // Em caso de erro, não alteramos o valor atual
    } finally {
      setLoadingBets(false);
    }
  };
  
  // Atualizar periodicamente o total de apostas
  useEffect(() => {
    if (!session) return;
    
    // Atualizar imediatamente na primeira carga
    fetchUserBets();
    
    // Configurar atualização periódica a cada 15 segundos
    const intervalId = setInterval(() => {
      fetchUserBets();
    }, 15000);
    
    // Limpar o intervalo quando o componente for desmontado
    return () => clearInterval(intervalId);
  }, [session]);
  
  // Evento de visibilidade para atualizar quando a aba ficar visível novamente
  useEffect(() => {
    if (!session) return;
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchUserBets();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [session]);
  
  // Atualizar formulário quando a sessão for carregada
  useEffect(() => {
    if (session && session.user) {
      // Carregar dados do usuário diretamente do banco para garantir dados atualizados
      const loadUserData = async () => {
        try {
          const response = await fetch('/api/auth/refresh-session');
          if (response.ok) {
            const data = await response.json();
            if (data.user) {
              // Atualizar o formulário com os dados mais recentes do banco
              setEditForm({
                name: data.user.name || '',
                email: data.user.email || '',
                phone: data.user.phone || '',
                address: data.user.address || '',
              });
              
              // Atualizar também os dados na sessão, se necessário
              session.user.name = data.user.name;
              session.user.phone = data.user.phone;
              session.user.address = data.user.address;
            } else {
              // Fallback para os dados da sessão
              setEditForm({
                name: session.user.name || '',
                email: session.user.email || '',
                phone: session.user.phone || '',
                address: session.user.address || '',
              });
            }
          } else {
            // Fallback para os dados da sessão em caso de erro
            setEditForm({
              name: session.user.name || '',
              email: session.user.email || '',
              phone: session.user.phone || '',
              address: session.user.address || '',
            });
          }
        } catch (error) {
          console.error('Erro ao carregar dados do usuário:', error);
          // Fallback para os dados da sessão em caso de erro
          setEditForm({
            name: session.user.name || '',
            email: session.user.email || '',
            phone: session.user.phone || '',
            address: session.user.address || '',
          });
        }
      };
      
      loadUserData();
      
      // Carregar transações do usuário
      fetchTransactions();
      
      // Carregar limite diário de apostas
      fetchDailyBetLimit();
    }
  }, [session]);
  
  // Recalcular totais sempre que as transações mudarem
  useEffect(() => {
    if (transactions.length > 0) {
      let deposits = 0;
      let withdrawals = 0;
      
      transactions.forEach((transaction) => {
        if (transaction.type === 'DEPOSIT' && transaction.status === 'COMPLETED') {
          deposits += transaction.amount;
        } else if (transaction.type === 'WITHDRAWAL' && transaction.status === 'COMPLETED') {
          withdrawals += transaction.amount;
        }
      });
      
      setTotalDeposits(deposits);
      setTotalWithdrawals(withdrawals);
    }
  }, [transactions]);
  
  // Função utilitária para tentar uma operação várias vezes
  const retryOperation = async (operation: () => Promise<any>, maxRetries = 3, delay = 1000) => {
    let lastError;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        console.error(`Tentativa ${attempt + 1} falhou:`, error);
        lastError = error;
        
        if (attempt < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError;
  };
  
  // Redirecionar se não estiver autenticado
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login');
    }
  }, [status, router]);
  
  // Função para buscar transações
  const fetchTransactions = async () => {
    if (!session) return;
    
    try {
      setLoadingTransactions(true);
      
      // Resetar para a primeira página sempre que buscar novas transações
      setCurrentPage(1);
      
      const response = await fetch('/api/transactions', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Erro ao processar resposta do servidor' }));
        console.error('Erro ao carregar transações:', response.status, errorData);
        console.error('URL completa:', `/api/transactions`);
        console.error('Detalhes do erro:', errorData);
        setErrorMessage(errorData.message || `Erro ao carregar transações (${response.status})`);
        setTimeout(() => setErrorMessage(''), 8000);
        return;
      }
      
      const data = await response.json().catch(() => {
        console.error('Erro ao parsear JSON da resposta');
        return [];
      });
      
      // Validar se a resposta é um array
      if (!Array.isArray(data)) {
        console.error('Resposta inválida - esperado um array de transações:', data);
        setErrorMessage('Formato de dados inválido recebido do servidor');
        setTimeout(() => setErrorMessage(''), 5000);
        // Usar array vazio como fallback
        setTransactions([]);
        return;
      }
      
      console.log('Transações carregadas com sucesso:', data.length);
      setTransactions(data);
      
      // Calcular totais de depósitos e saques
      let deposits = 0;
      let withdrawals = 0;
      
      data.forEach((transaction) => {
        if (transaction.type === 'DEPOSIT' && transaction.status === 'COMPLETED') {
          deposits += transaction.amount;
        } else if (transaction.type === 'WITHDRAWAL' && transaction.status === 'COMPLETED') {
          withdrawals += transaction.amount;
        }
      });
      
      setTotalDeposits(deposits);
      setTotalWithdrawals(withdrawals);
      
      // Atualizar o saldo do usuário após buscar transações
      await refreshBalance();
    } catch (error) {
      console.error('Erro ao buscar transações:', error);
      console.error('Tipo de erro:', error instanceof Error ? error.constructor.name : typeof error);
      console.error('Mensagem de erro:', error instanceof Error ? error.message : String(error));
      
      // Se for erro de rede ou timeout, tentar novamente depois de um tempo
      if (error instanceof TypeError && error.message.includes('fetch')) {
        setErrorMessage('Erro de conexão. Tentando novamente em 3 segundos...');
        setTimeout(() => {
          fetchTransactions();
        }, 3000);
      } else {
        setErrorMessage('Erro ao carregar transações. Por favor, recarregue a página.');
      }
      
      setTimeout(() => setErrorMessage(''), 8000);
    } finally {
      setLoadingTransactions(false);
    }
  };
  
  // Função para carregar o limite diário de apostas
  const fetchDailyBetLimit = async () => {
    if (!session) return;
    
    try {
      const response = await fetch('/api/user/bet-limit');
      
      if (!response.ok) {
        throw new Error('Falha ao carregar o limite de apostas');
      }
      
      const data = await response.json();
      setDailyBetLimit(data.dailyBetLimit);
    } catch (error) {
      console.error('Erro ao carregar limite de apostas:', error);
    }
  };
  
  // Função para atualizar o limite diário de apostas
  const handleUpdateBetLimit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newBetLimit) {
      setErrorMessage('Por favor, informe um valor para o novo limite.');
      setTimeout(() => setErrorMessage(''), 5000);
      return;
    }
    
    try {
      setSavingBetLimit(true);
      
      const response = await fetch('/api/user/bet-limit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ dailyBetLimit: newBetLimit }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Falha ao atualizar o limite');
      }
      
      setDailyBetLimit(data.dailyBetLimit);
      setNewBetLimit('');
      
      let message = 'Limite diário de apostas atualizado com sucesso!';
      if (data.isPersisted === false) {
        message += ' (Nota: Esta alteração será temporária até a próxima atualização do sistema)';
      }
      
      setSuccessMessage(message);
      setTimeout(() => setSuccessMessage(''), 5000);
      setShowBetLimitModal(false);
    } catch (error: any) {
      console.error('Erro ao atualizar limite de apostas:', error);
      setErrorMessage(error.message || 'Erro ao atualizar limite. Tente novamente.');
      setTimeout(() => setErrorMessage(''), 5000);
    } finally {
      setSavingBetLimit(false);
    }
  };
  
  // Se estiver carregando ou não autenticado, mostrar loading ou nada
  if (status === 'loading') {
    return (
      <div className="container mx-auto px-4 py-12 flex justify-center">
        <div className="animate-pulse">Carregando...</div>
      </div>
    );
  }
  
  if (status === 'unauthenticated' || !session) {
    return null;
  }
  
  // Funções para lidar com os formulários
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    setLoading(true);
    setErrorMessage('');
    setSuccessMessage('');
    
    try {
      console.log('Enviando dados para atualização:', editForm);
      
      // Verificando se há dados válidos para atualizar
      if (!editForm.name.trim() && !editForm.phone.trim() && !editForm.address.trim()) {
        throw new Error('Nenhum dado válido para atualização. Por favor, preencha pelo menos um campo.');
      }
      
      // Usando o endpoint de persistência real
      const response = await fetch('/api/user/update', { 
        method: 'POST', 
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: editForm.name.trim() || undefined,
          phone: editForm.phone.trim() || undefined,
          address: editForm.address.trim() || undefined
        })
      });
      
      const responseData = await response.json();
      
      if (!response.ok) {
        console.error('Erro na resposta da API:', responseData);
        throw new Error(responseData.message || 'Erro ao atualizar perfil');
      }
      
      console.log('Perfil atualizado com sucesso:', responseData);
      
      // Atualizar os dados da sessão para refletir as mudanças
      if (session && session.user) {
        session.user.name = responseData.name || session.user.name;
        session.user.phone = responseData.phone || session.user.phone;
        session.user.address = responseData.address || session.user.address;
        
        // Atualizar o formulário com os dados retornados para garantir consistência
        setEditForm({
          name: responseData.name || '',
          email: responseData.email || '',
          phone: responseData.phone || '',
          address: responseData.address || ''
        });
      }
      
      setSuccessMessage(responseData.message || 'Perfil atualizado com sucesso!');
      setTimeout(() => setSuccessMessage(''), 3000);
      setShowEditModal(false);
      
      // Forçar atualização da sessão e da página
      try {
        // Usando o novo endpoint de atualização de sessão
        const sessionResponse = await fetch('/api/auth/refresh-session');
        
        if (sessionResponse.ok) {
          const sessionData = await sessionResponse.json();
          console.log('Sessão atualizada com sucesso:', sessionData);
          
          // Atualizar a sessão com os novos dados
          if (session && sessionData.user) {
            session.user.name = sessionData.user.name;
            session.user.phone = sessionData.user.phone;
            session.user.address = sessionData.user.address;
          }
        }
        
        // Forçar atualização da página para mostrar os dados atualizados
        router.refresh();
        
        // Se necessário, recarregar a página completamente após um breve delay
        setTimeout(() => {
          window.location.reload();
        }, 500);
      } catch (refreshError) {
        console.error('Erro ao atualizar sessão:', refreshError);
      }
    } catch (error: any) {
      console.error('Erro ao atualizar perfil:', error);
      setErrorMessage(error.message || 'Erro ao atualizar perfil. Tente novamente.');
      setTimeout(() => setErrorMessage(''), 3000);
    } finally {
      setLoading(false);
    }
  };
  
  const handleRechargeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      // Aqui você implementaria a chamada de API para recarregar o saldo
      // const response = await fetch('/api/transactions/recharge', { method: 'POST', body: JSON.stringify({ amount: rechargeAmount }) });
      
      // Simulando sucesso
      const amount = parseFloat(rechargeAmount);
      updateBalance(userBalance + amount);
      
      // Atualizar o total de depósitos
      setTotalDeposits(prevTotal => prevTotal + amount);
      
      setSuccessMessage(`Recarga de R$ ${amount.toFixed(2)} realizada com sucesso!`);
      setTimeout(() => setSuccessMessage(''), 3000);
      setShowRechargeModal(false);
      setRechargeAmount('');
      
      // Recarregar transações para mostrar o novo depósito
      fetchTransactions();
    } catch (error) {
      setErrorMessage('Erro ao processar recarga. Tente novamente.');
      setTimeout(() => setErrorMessage(''), 3000);
    }
  };
  
  const handleWithdrawSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const amount = parseFloat(withdrawAmount);
    
    // Limpar mensagens anteriores
    setErrorMessage('');
    setSuccessMessage('');
    
    if (isNaN(amount) || amount <= 0) {
      setErrorMessage('Valor de saque inválido. Por favor, insira um valor positivo.');
      setTimeout(() => setErrorMessage(''), 5000);
      return;
    }
    
    if (amount > userBalance) {
      setErrorMessage('Saldo insuficiente para realizar este saque.');
      setTimeout(() => setErrorMessage(''), 5000);
      return;
    }

    if (!withdrawDetailsValue) {
      setErrorMessage('Por favor, informe os dados para o saque (chave PIX ou dados bancários).');
      setTimeout(() => setErrorMessage(''), 5000);
      return;
    }
    
    try {
      setLoading(true);
      
      // Obter o método de saque selecionado
      const methodElement = document.querySelector('input[name="withdrawMethod"]:checked') as HTMLInputElement;
      const method = methodElement ? methodElement.id : 'pixWithdraw';
      
      console.log('Enviando solicitação de saque:', {
        amount,
        type: 'WITHDRAWAL',
        pixKey: withdrawDetailsValue,
        method
      });
      
      // Fazer a requisição diretamente sem retry
      const response = await fetch('/api/transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          amount: amount,
          type: 'WITHDRAWAL',
          pixKey: withdrawDetailsValue,
          method: method
        }),
      });
      
      // Se chegou aqui, processar a resposta
      const transactionData = await response.json();
      
      if (!response.ok) {
        console.error('Resposta de erro:', transactionData);
        throw new Error(transactionData.message || 'Erro ao processar saque');
      }
      
      console.log('Saque processado com sucesso:', transactionData);
      
      // Limpar formulário
      setWithdrawAmount('');
      setWithdrawDetailsValue('');
      
      // Atualizar o saldo imediatamente (já foi debitado no backend)
      await refreshBalance();
      
      // Mostrar mensagem de sucesso
      setSuccessMessage(`Saque de R$ ${amount.toFixed(2)} solicitado com sucesso! Status: Pendente`);
      setTimeout(() => setSuccessMessage(''), 5000);
      
      // Fechar modal
      setShowWithdrawModal(false);
      
      // Recarregar transações para mostrar o novo saque
      fetchTransactions();
    } catch (error: any) {
      console.error('Erro ao processar saque:', error);
      
      // Mensagem de erro mais específica
      let errorMsg = 'Erro ao processar saque. ';
      if (error.message.includes('saldo') || error.message.includes('balance')) {
        errorMsg = 'Saldo insuficiente para realizar este saque.';
      } else {
        errorMsg += error.message || 'Tente novamente.';
      }
      
      setErrorMessage(errorMsg);
      setTimeout(() => setErrorMessage(''), 5000);
    } finally {
      setLoading(false);
    }
  };
  
  // Função para formatação de dados de transação
  const getTransactionDescription = (transaction: any) => {
    if (!transaction) return 'Desconhecido';
    
    try {
      // Tentar extrair detalhes se existirem e forem uma string JSON válida
      let details = {};
      
      if (transaction.details) {
        if (typeof transaction.details === 'string') {
          details = JSON.parse(transaction.details);
        } else if (typeof transaction.details === 'object') {
          details = transaction.details;
        }
      }
      
      if (transaction.type === 'DEPOSIT') {
        const methodName = (details as any)?.method || 'PIX';
        return `Depósito via ${methodName === 'pix' ? 'PIX' : methodName}`;
      } else {
        const pixKey = (details as any)?.pixKey || 'conta bancária';
        const methodName = (details as any)?.method || 'pixWithdraw';
        return `Saque para ${pixKey} via ${methodName === 'pixWithdraw' ? 'PIX' : methodName === 'bankAccount' ? 'Conta Bancária' : methodName}`;
      }
    } catch (error) {
      console.error('Erro ao analisar detalhes da transação:', error);
      // Em caso de erro na análise JSON, retornar descrição padrão
      return transaction.type === 'DEPOSIT' ? 'Depósito' : 'Saque';
    }
  };
  
  // Componente para mostrar mensagens de sucesso/erro
  const AlertMessage = ({ message, type }: { message: string, type: 'success' | 'error' }) => {
    if (!message) return null;
    
    return (
      <div className={`p-3 rounded-md mb-4 ${type === 'success' ? 'bg-[#3bc37a]' : 'bg-red-500'} bg-opacity-10 border ${type === 'success' ? 'border-[#3bc37a]' : 'border-red-500'}`}>
        <p className={`text-sm ${type === 'success' ? 'text-[#3bc37a]' : 'text-red-400'}`}>{message}</p>
      </div>
    );
  };
  
  // Componente de carregamento
  const LoadingSpinner = () => (
    <div className="flex justify-center items-center py-4">
      <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-green-500"></div>
    </div>
  );
  
  // Componente de Modal
  const Modal = ({ title, isOpen, onClose, children }: { title: string, isOpen: boolean, onClose: () => void, children: React.ReactNode }) => {
    return (
      <div
        className={`fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-70 transition-all duration-200 ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      >
        <div
          className="bg-[#121212] rounded-lg shadow-xl max-w-md w-full border border-gray-800"
          onClick={e => e.stopPropagation()}
        >
          <div className="p-4 border-b border-gray-800 flex justify-between items-center">
            <h3 className="text-lg font-medium">{title}</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <div className="p-6">
            {children}
          </div>
        </div>
      </div>
    );
  };
  
  return (
    <div className="container mx-auto px-4 py-12">
      {/* Mensagens de alerta */}
      {successMessage && <AlertMessage message={successMessage} type="success" />}
      {errorMessage && <AlertMessage message={errorMessage} type="error" />}
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Cartão de informações do usuário */}
        <Card variant="bordered" className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Informações Pessoais</CardTitle>
            <CardDescription>Seus dados e configurações de conta</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row">
              <div className="mb-6 md:mb-0 md:mr-8">
                <div className="w-32 h-32 bg-[#1e1e1e] rounded-full mx-auto md:mx-0 flex items-center justify-center overflow-hidden">
                  {/* Avatar placeholder ou imagem do usuário */}
                  <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                  </svg>
                </div>
              </div>
              
              <div className="flex-1">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-400">Nome</p>
                    <p className="font-medium">{session.user.name || 'Não informado'}</p>
                  </div>
                  
                  <div>
                    <p className="text-sm text-gray-400">Email</p>
                    <p className="font-medium">{session.user.email}</p>
                  </div>
                  
                  <div>
                    <p className="text-sm text-gray-400">Telefone</p>
                    <p className="font-medium">{session.user.phone || 'Não informado'}</p>
                  </div>
                  
                  <div>
                    <p className="text-sm text-gray-400">Endereço</p>
                    <p className="font-medium">{session.user.address || 'Não informado'}</p>
                  </div>
                  
                  <div>
                    <p className="text-sm text-gray-400">Tipo de Conta</p>
                    <p className="font-medium">{session.user.role === 'ADMIN' ? 'Administrador' : 'Usuário'}</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button onClick={() => setShowEditModal(true)}>Editar Perfil</Button>
          </CardFooter>
        </Card>
        
        {/* Cartão de informações financeiras */}
        <Card variant="bordered">
          <CardHeader>
            <CardTitle>Informações Financeiras</CardTitle>
            <CardDescription>Seu saldo e transações</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-6">
              <p className="text-sm text-gray-400 mb-1">Saldo Disponível</p>
              <p className="text-3xl font-bold bg-gradient-to-r from-[#1a86c7] to-[#3bc37a] bg-clip-text text-transparent">
                {isLoadingBalance ? (
                  <span className="flex items-center">
                    <span className="mr-2 animate-spin h-4 w-4 border-t-2 border-b-2 border-green-500 rounded-full"></span>
                    Carregando...
                  </span>
                ) : `R$ ${userBalance.toFixed(2)}`}
              </p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-400 mb-1">Saques Realizados</p>
                <p className="font-medium text-red-400">
                  {loadingTransactions ? (
                    <span className="flex items-center">
                      <span className="mr-2 animate-spin h-3 w-3 border-t-2 border-b-2 border-red-500 rounded-full"></span>
                      Carregando...
                    </span>
                  ) : `R$ ${totalWithdrawals.toFixed(2)}`}
                </p>
              </div>
              
              <div>
                <p className="text-sm text-gray-400 mb-1">Recargas Feitas</p>
                <p className="font-medium text-green-400">
                  {loadingTransactions ? (
                    <span className="flex items-center">
                      <span className="mr-2 animate-spin h-3 w-3 border-t-2 border-b-2 border-green-500 rounded-full"></span>
                      Carregando...
                    </span>
                  ) : `R$ ${totalDeposits.toFixed(2)}`}
                </p>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex flex-wrap justify-between gap-2">
            {/* Bubble tooltip usando CSS puro e classes para controle de hover/focus */}
            <div className="relative w-full md:w-auto group">
              <Button 
                variant="primary" 
                onClick={(e) => e.preventDefault()}
                className="w-full md:w-auto min-w-[160px] bg-gradient-to-r from-[#1a86c7] to-[#3bc37a] hover:opacity-90 flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-[#3bc37a] focus:ring-opacity-50"
                aria-describedby="deposit-tooltip"
              >
                <span>Fazer Recarga</span>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" />
                </svg>
              </Button>
              
              {/* Bubble tooltip com estilo circular, visível com hover/focus no botão */}
              <div 
                id="deposit-tooltip"
                role="tooltip"
                className="absolute z-[1000] right-0 md:left-1/2 transform md:-translate-x-1/2 -translate-y-2 bottom-full mb-3 w-72 md:w-80 
                           opacity-0 invisible scale-95 origin-bottom 
                           group-hover:opacity-100 group-hover:visible group-hover:scale-100 group-focus-within:opacity-100 group-focus-within:visible group-focus-within:scale-100 
                           transition-all duration-200 ease-out"
              >
                {/* Container do tooltip com sombra circular */}
                <div className="relative bg-[#101010] text-white text-sm p-4 rounded-2xl shadow-xl border border-[#3bc37a]/30">
                  <div className="space-y-2">
                    <div className="flex items-start space-x-2">
                      <span className="text-lg">⚠️</span>
                      <p className="font-medium text-[#3bc37a]">Depósito Automático Temporariamente Indisponível</p>
                    </div>
                    <p className="text-gray-200 leading-5 ml-7">
                      Devido ao elevado volume de acessos, o depósito automático foi temporariamente desativado. Para continuar, realize seu depósito diretamente com um de nossos atendentes através do Chat Online disponível no jogo.
                    </p>
                  </div>
                  
                  {/* Seta do tooltip em formato de triângulo */}
                  <div className="absolute h-4 w-4 bg-[#101010] transform rotate-45 border-r border-b border-[#3bc37a]/30
                                  right-10 md:left-1/2 md:-translate-x-1/2 bottom-[-8px]"></div>
                </div>
              </div>
            </div>
            <Button variant="secondary" onClick={() => setShowWithdrawModal(true)}>
              Realizar Saque
            </Button>
          </CardFooter>
        </Card>
        
        {/* Configurações de Jogo */}
        <Card variant="bordered" className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Configurações de Jogo</CardTitle>
            <CardDescription>Defina seus limites e preferências</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-4">
              <div className="bg-gray-800 bg-opacity-30 rounded-lg p-4">
                <h3 className="text-lg font-medium mb-2">Limite Diário de Apostas</h3>
                <p className="text-sm text-gray-400 mb-4">Estabeleça um limite diário para controlar seus gastos com apostas.</p>
                
                <div className="mb-2">
                  <p className="text-sm text-gray-400">Valor atual:</p>
                  <p className="text-xl font-bold text-[#3bc37a]">R$ {dailyBetLimit.toFixed(2)}</p>
                </div>
                
                <Button 
                  variant="secondary"
                  onClick={() => setShowBetLimitModal(true)}
                  className="w-full mt-2"
                >
                  Alterar Limite
                </Button>
              </div>
              
              {/* Novo card de Níveis e Recompensas */}
              <div className="bg-gray-800 bg-opacity-30 rounded-lg p-4">
                <h3 className="text-lg font-medium mb-2">Níveis e Recompensas</h3>
                <p className="text-sm text-gray-400 mb-4">Suba de nível, ganhe bônus e resgate recompensas exclusivas.</p>
                
                <div className="mb-4">
                  <p className="text-sm text-gray-400">Seu nível atual:</p>
                  <div className="flex items-center space-x-2 mt-1">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-r from-[#1a86c7] to-[#3bc37a] flex items-center justify-center text-white font-bold">
                      {userLevel}
                    </div>
                    <div>
                      <p className="font-medium">{getLevelName(userLevel)}</p>
                    </div>
                  </div>
                </div>
                
                <Button 
                  variant="primary"
                  onClick={() => router.push('/profile/level')}
                  className="w-full"
                >
                  Ver Níveis e Recompensas
                </Button>
              </div>
              
              <div className="bg-gray-800 bg-opacity-30 rounded-lg p-4">
                <h3 className="text-lg font-medium mb-2">Jogo Responsável</h3>
                <p className="text-sm text-gray-400 mb-4">Lembre-se de jogar com moderação, estabelecendo limites saudáveis.</p>
                
                <ul className="text-sm text-gray-400 space-y-2">
                  <li className="flex items-start">
                    <div className="text-[#3bc37a] mr-2">✓</div>
                    <p>Estabeleça um orçamento antes de jogar</p>
                  </li>
                  <li className="flex items-start">
                    <div className="text-[#3bc37a] mr-2">✓</div>
                    <p>Jogue por diversão, não como fonte de renda</p>
                  </li>
                  <li className="flex items-start">
                    <div className="text-[#3bc37a] mr-2">✓</div>
                    <p>Faça pausas regulares enquanto joga</p>
                  </li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Histórico de Transações */}
        <Card variant="bordered" className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Histórico de Transações</CardTitle>
            <CardDescription>Seus depósitos e saques recentes (10 por página)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              {loadingTransactions ? (
                <LoadingSpinner />
              ) : transactions.filter(t => t.type === 'DEPOSIT' || t.type === 'WITHDRAWAL').length === 0 ? (
                <div className="py-8 text-center text-gray-500">Nenhuma transação encontrada</div>
              ) : (
                <>
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-800">
                        <th className="px-4 py-3 text-left text-sm text-gray-400">Data</th>
                        <th className="px-4 py-3 text-left text-sm text-gray-400">Tipo</th>
                        <th className="px-4 py-3 text-left text-sm text-gray-400">Descrição</th>
                        <th className="px-4 py-3 text-right text-sm text-gray-400">Valor</th>
                        <th className="px-4 py-3 text-right text-sm text-gray-400">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions
                        .filter(transaction => transaction.type === 'DEPOSIT' || transaction.type === 'WITHDRAWAL')
                        .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                        .map((transaction) => (
                          <tr key={transaction.id} className="border-b border-gray-800">
                            <td className="px-4 py-3 text-sm">{new Date(transaction.createdAt).toLocaleDateString()}</td>
                            <td className="px-4 py-3 text-sm">
                              {transaction.type === 'DEPOSIT' ? 'Depósito' : 'Saque'}
                            </td>
                            <td className="px-4 py-3 text-sm">
                              {getTransactionDescription(transaction)}
                            </td>
                            <td className={`px-4 py-3 text-sm ${transaction.type === 'DEPOSIT' ? 'text-green-400' : 'text-red-400'} text-right`}>
                              {transaction.type === 'DEPOSIT' ? '+ ' : '- '}
                              R$ {transaction.amount.toFixed(2)}
                            </td>
                            <td className="px-4 py-3 text-sm text-right">
                              <span 
                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                  transaction.status === 'COMPLETED' 
                                    ? 'bg-green-100 text-green-800 dark:bg-green-800/20 dark:text-green-400' 
                                    : transaction.status === 'REJECTED'
                                    ? 'bg-red-100 text-red-800 dark:bg-red-800/20 dark:text-red-400'
                                    : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-800/20 dark:text-yellow-400'
                                }`}
                              >
                                {transaction.status === 'COMPLETED' 
                                  ? 'Concluído' 
                                  : transaction.status === 'REJECTED'
                                  ? 'Rejeitado'
                                  : 'Pendente'}
                              </span>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                  
                  {/* Paginação */}
                  {transactions.filter(t => t.type === 'DEPOSIT' || t.type === 'WITHDRAWAL').length > itemsPerPage && (
                    <div className="flex justify-center mt-6">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                          disabled={currentPage === 1}
                          className="px-3 py-1 rounded-md bg-gray-800 text-white opacity-80 hover:opacity-100 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          Anterior
                        </button>
                        
                        <span className="text-sm text-gray-400">
                          Página {currentPage} de {Math.ceil(transactions.filter(t => t.type === 'DEPOSIT' || t.type === 'WITHDRAWAL').length / itemsPerPage)}
                        </span>
                        
                        <button
                          onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(transactions.filter(t => t.type === 'DEPOSIT' || t.type === 'WITHDRAWAL').length / itemsPerPage)))}
                          disabled={currentPage >= Math.ceil(transactions.filter(t => t.type === 'DEPOSIT' || t.type === 'WITHDRAWAL').length / itemsPerPage)}
                          className="px-3 py-1 rounded-md bg-gray-800 text-white opacity-80 hover:opacity-100 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          Próxima
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button variant="secondary" onClick={fetchTransactions}>
              Atualizar Transações
            </Button>
            
            {transactions.filter(t => t.type === 'DEPOSIT' || t.type === 'WITHDRAWAL').length > 0 && (
              <div className="text-sm text-gray-400">
                Mostrando {Math.min(itemsPerPage, transactions.filter(t => t.type === 'DEPOSIT' || t.type === 'WITHDRAWAL').length - (currentPage - 1) * itemsPerPage)} de {transactions.filter(t => t.type === 'DEPOSIT' || t.type === 'WITHDRAWAL').length} transações
              </div>
            )}
          </CardFooter>
        </Card>
      </div>
      
      {/* Modal de Edição de Perfil - Reimplementado */}
      <div
        className={`fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-70 transition-all duration-200 ${showEditModal ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setShowEditModal(false)}
      >
        <div
          className="bg-[#121212] rounded-lg shadow-xl max-w-md w-full border border-gray-800"
          onClick={e => e.stopPropagation()}
        >
          <div className="p-4 border-b border-gray-800 flex justify-between items-center">
            <h3 className="text-lg font-medium">Editar Perfil</h3>
            <button
              onClick={() => setShowEditModal(false)}
              className="text-gray-400 hover:text-white"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <div className="p-6">
            <form onSubmit={handleEditSubmit}>
              <div className="mb-4">
                <label htmlFor="name" className="block text-sm font-medium text-gray-400 mb-1">
                  Nome Completo
                </label>
                <input
                  id="name"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  placeholder="Seu nome completo"
                  className="w-full bg-gray-800 border border-gray-700 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
              
              <div className="mb-4">
                <label htmlFor="email" className="block text-sm font-medium text-gray-400 mb-1">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  placeholder="seu@email.com"
                  disabled
                  className="w-full bg-gray-700 border border-gray-700 rounded-md py-2 px-3 text-gray-400 focus:outline-none cursor-not-allowed"
                />
              </div>
              
              <div className="mb-4">
                <label htmlFor="phone" className="block text-sm font-medium text-gray-400 mb-1">
                  Telefone
                </label>
                <input
                  id="phone"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  placeholder="(00) 00000-0000"
                  className="w-full bg-gray-800 border border-gray-700 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
              
              <div className="mb-4">
                <label htmlFor="address" className="block text-sm font-medium text-gray-400 mb-1">
                  Endereço
                </label>
                <input
                  id="address"
                  value={editForm.address}
                  onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                  placeholder="Seu endereço completo"
                  className="w-full bg-gray-800 border border-gray-700 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
              
              <div className="flex justify-end mt-6 space-x-2">
                <button 
                  type="button" 
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-600 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-500 transition-colors"
                >
                  Salvar Alterações
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
      
      {/* Modal de Recarga */}
      <div
        className={`fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-70 transition-all duration-200 ${showRechargeModal ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setShowRechargeModal(false)}
      >
        <div
          className="bg-[#121212] rounded-lg shadow-xl max-w-md w-full border border-gray-800"
          onClick={e => e.stopPropagation()}
        >
          <div className="p-4 border-b border-gray-800 flex justify-between items-center">
            <h3 className="text-lg font-medium">Fazer Recarga</h3>
            <button
              onClick={() => setShowRechargeModal(false)}
              className="text-gray-400 hover:text-white"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <div className="p-6">
            <form onSubmit={handleRechargeSubmit}>
              <div className="mb-4">
                <label htmlFor="amount" className="block text-sm font-medium text-gray-400 mb-1">
                  Valor da Recarga
                </label>
                <input
                  id="amount"
                  type="number"
                  min="10"
                  step="0.01"
                  value={rechargeAmount}
                  onChange={(e) => setRechargeAmount(e.target.value)}
                  placeholder="0,00"
                  className="w-full bg-gray-800 border border-gray-700 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
              
              <div className="mt-4 mb-4">
                <p className="text-sm text-gray-400 mb-2">Método de Pagamento</p>
                
                <div className="space-y-2">
                  <div className="flex items-center p-3 border border-gray-800 rounded-md">
                    <input
                      type="radio"
                      id="pix"
                      name="paymentMethod"
                      className="h-4 w-4 text-[#3bc37a] border-gray-600 focus:ring-[#3bc37a]"
                      defaultChecked
                    />
                    <label htmlFor="pix" className="ml-3 block text-sm">
                      PIX
                    </label>
                  </div>
                  
                  <div className="flex items-center p-3 border border-gray-800 rounded-md">
                    <input
                      type="radio"
                      id="creditCard"
                      name="paymentMethod"
                      className="h-4 w-4 text-[#3bc37a] border-gray-600 focus:ring-[#3bc37a]"
                    />
                    <label htmlFor="creditCard" className="ml-3 block text-sm">
                      Cartão de Crédito
                    </label>
                  </div>
                  
                  <div className="flex items-center p-3 border border-gray-800 rounded-md">
                    <input
                      type="radio"
                      id="bankTransfer"
                      name="paymentMethod"
                      className="h-4 w-4 text-[#3bc37a] border-gray-600 focus:ring-[#3bc37a]"
                    />
                    <label htmlFor="bankTransfer" className="ml-3 block text-sm">
                      Transferência Bancária
                    </label>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end mt-4 space-x-2">
                <button 
                  type="button" 
                  onClick={() => setShowRechargeModal(false)}
                  className="px-4 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-600 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-500 transition-colors"
                >
                  Confirmar Recarga
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
      
      {/* Modal de Saque */}
      <div
        className={`fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-70 transition-all duration-200 ${showWithdrawModal ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setShowWithdrawModal(false)}
      >
        <div
          className="bg-[#121212] rounded-lg shadow-xl max-w-md w-full border border-gray-800"
          onClick={e => e.stopPropagation()}
        >
          <div className="p-4 border-b border-gray-800 flex justify-between items-center">
            <h3 className="text-lg font-medium">Realizar Saque</h3>
            <button
              onClick={() => setShowWithdrawModal(false)}
              className="text-gray-400 hover:text-white"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <div className="p-6">
            <form onSubmit={handleWithdrawSubmit}>
              <div className="mb-4">
                <label htmlFor="withdrawAmount" className="block text-sm font-medium text-gray-400 mb-1">
                  Valor do Saque
                </label>
                <input
                  id="withdrawAmount"
                  type="number"
                  min="10"
                  max={userBalance.toString()}
                  step="0.01"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder="0,00"
                  className="w-full bg-gray-800 border border-gray-700 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
              
              <div className="mt-4 mb-4">
                <p className="text-sm text-gray-400 mb-2">Método de Saque</p>
                
                <div className="space-y-2">
                  <div className="flex items-center p-3 border border-gray-800 rounded-md">
                    <input
                      type="radio"
                      id="pixWithdraw"
                      name="withdrawMethod"
                      className="h-4 w-4 text-[#3bc37a] border-gray-600 focus:ring-[#3bc37a]"
                      defaultChecked
                    />
                    <label htmlFor="pixWithdraw" className="ml-3 block text-sm">
                      PIX
                    </label>
                  </div>
                  
                  <div className="flex items-center p-3 border border-gray-800 rounded-md">
                    <input
                      type="radio"
                      id="bankAccount"
                      name="withdrawMethod"
                      className="h-4 w-4 text-[#3bc37a] border-gray-600 focus:ring-[#3bc37a]"
                    />
                    <label htmlFor="bankAccount" className="ml-3 block text-sm">
                      Conta Bancária
                    </label>
                  </div>
                </div>
              </div>
              
              <div className="mb-4">
                <label htmlFor="withdrawDetails" className="block text-sm font-medium text-gray-400 mb-1">
                  Chave PIX ou Dados Bancários
                </label>
                <input
                  id="withdrawDetails"
                  value={withdrawDetailsValue}
                  onChange={(e) => setWithdrawDetailsValue(e.target.value)}
                  placeholder="CPF, Email, Telefone ou Dados da Conta"
                  className="w-full bg-gray-800 border border-gray-700 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
              
              <div className="flex justify-end mt-4 space-x-2">
                <button 
                  type="button" 
                  onClick={() => setShowWithdrawModal(false)}
                  disabled={loading}
                  className="px-4 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-600 transition-colors disabled:bg-gray-800 disabled:text-gray-500"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-500 transition-colors disabled:bg-gray-800 disabled:text-gray-500"
                >
                  {loading ? (
                    <span className="flex items-center">
                      <span className="mr-2 animate-spin h-4 w-4 border-t-2 border-b-2 border-white rounded-full"></span>
                      Processando...
                    </span>
                  ) : 'Confirmar Saque'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
      
      {/* Modal de Chat de Suporte */}
      <div
        className={`fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-70 transition-all duration-200 ${showChatModal ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setShowChatModal(false)}
      >
        <div
          className="bg-[#121212] rounded-lg shadow-xl max-w-4xl w-full border border-gray-800"
          onClick={e => e.stopPropagation()}
        >
          <div className="p-4 border-b border-gray-800 flex justify-between items-center">
            <h3 className="text-lg font-medium">Chat de Suporte - Realizar Depósito</h3>
            <button
              onClick={() => setShowChatModal(false)}
              className="text-gray-400 hover:text-white"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <div className="p-6">
            <ChatSupport 
              isAdmin={false} 
              title="Chat de Suporte - Realizar Depósito"
              height="400px"
              autoFocus={true}
            />
            <div className="mt-6 text-sm text-gray-400">
              <p>Entre em contato com nosso suporte para receber instruções de depósito e enviar comprovantes.</p>
              <p className="mt-2">Nosso atendimento está disponível das 8h às 22h todos os dias.</p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Modal de Configuração do Limite Diário */}
      <div
        className={`fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-70 transition-all duration-200 ${showBetLimitModal ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setShowBetLimitModal(false)}
      >
        <div
          className="bg-[#121212] rounded-lg shadow-xl max-w-md w-full border border-gray-800"
          onClick={e => e.stopPropagation()}
        >
          <div className="p-4 border-b border-gray-800 flex justify-between items-center">
            <h3 className="text-lg font-medium">Alterar Limite Diário de Apostas</h3>
            <button
              onClick={() => setShowBetLimitModal(false)}
              className="text-gray-400 hover:text-white"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <div className="p-6">
            <form onSubmit={handleUpdateBetLimit}>
              <div className="mb-6">
                <p className="text-sm text-gray-400 mb-2">Limite diário atual:</p>
                <p className="text-2xl font-bold text-[#3bc37a] mb-4">R$ {dailyBetLimit.toFixed(2)}</p>
                
                <label htmlFor="newBetLimit" className="block text-sm font-medium text-gray-400 mb-1">
                  Novo limite diário
                </label>
                <input
                  id="newBetLimit"
                  type="number"
                  min="100"
                  step="100"
                  value={newBetLimit}
                  onChange={(e) => setNewBetLimit(e.target.value)}
                  placeholder="0,00"
                  className="w-full bg-gray-800 border border-gray-700 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
                <p className="mt-2 text-xs text-gray-400">Limite mínimo: R$ 100,00 • Limite máximo: R$ 50.000,00</p>
              </div>
              
              <div className="p-4 bg-gray-800 bg-opacity-30 rounded-md mb-6">
                <h4 className="font-medium mb-2 flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2 text-yellow-500">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                    <line x1="12" y1="9" x2="12" y2="13"></line>
                    <line x1="12" y1="17" x2="12.01" y2="17"></line>
                  </svg>
                  Informações Importantes
                </h4>
                <ul className="text-sm text-gray-400 space-y-1">
                  <li>• Este limite se aplica ao total de apostas em um período de 24 horas</li>
                  <li>• Definir um limite ajuda você a manter o controle sobre seus gastos</li>
                  <li>• Você pode alterar este limite a qualquer momento</li>
                </ul>
              </div>
              
              <div className="flex justify-end space-x-2">
                <button 
                  type="button" 
                  onClick={() => setShowBetLimitModal(false)}
                  disabled={savingBetLimit}
                  className="px-4 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-600 transition-colors disabled:bg-gray-800 disabled:text-gray-500"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  disabled={savingBetLimit}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-500 transition-colors disabled:bg-gray-800 disabled:text-gray-500"
                >
                  {savingBetLimit ? (
                    <span className="flex items-center">
                      <span className="mr-2 animate-spin h-4 w-4 border-t-2 border-b-2 border-white rounded-full"></span>
                      Salvando...
                    </span>
                  ) : 'Confirmar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
} 