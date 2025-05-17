import React, { useEffect, useState, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import ChatSupport from '@/components/ChatSupport';
import Link from 'next/link';

interface GameStats {
  totalBets: number;
  totalAmount: number;
  houseProfit: number;
  currentRound: {
    id: string;
    result: number;
    endTime: string;
    houseProfit: number;
  };
  // Propriedades para o jogo Multiplicador
  houseBalance?: number;
  totalMultiplierBets?: number;
  totalMultiplierAmount?: number;
  totalMultiplierPayout?: number;
  recentRounds?: Array<{
    id: string;
    startTime: string;
    endTime?: string;
    result?: number;
    status: string;
    totalBets?: number;
    totalAmount?: number;
  }>;
}

interface User {
  id: string;
  email: string;
  name: string;
  balance: number;
}

// Definir interface para mensagens
interface MessageType {
  id?: string;
  text: string;
  sender: 'USER' | 'ADMIN' | 'SYSTEM';
  userId?: string;
  userName?: string;
  userEmail?: string;
  recipientId?: string | null;
  timestamp: Date | string;
  read?: boolean;
  isFinal?: boolean;
  isImage?: boolean;
  fileInfo?: {
    originalName: string;
    url: string;
  };
}

export default function AdminPanel() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [stats, setStats] = useState<GameStats | null>(null);
  const [houseProfit, setHouseProfit] = useState(0);
  const [userEmail, setUserEmail] = useState('');
  const [foundUser, setFoundUser] = useState<User | null>(null);
  const [searchingUser, setSearchingUser] = useState(false);
  const [rechargeAmount, setRechargeAmount] = useState(100);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  
  // Dados para as abas de Saques e Depósitos
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [deposits, setDeposits] = useState<any[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<string | null>(null);
  
  // Adicionar contador de jogadores online
  const [playerCount, setPlayerCount] = useState(0);
  
  // Tabs de navegação
  const [activeTab, setActiveTab] = useState('stats'); // 'stats', 'recharge', 'house-profit', 'withdrawals', 'deposits', 'chat', 'maintenance'
  
  // Estado para modal de detalhes da transação
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  
  // Estado para rastrear o usuário selecionado no chat
  const [selectedChatUser, setSelectedChatUser] = useState<string | undefined>(undefined);
  
  // Estado para a manutenção
  const [maintenanceStatus, setMaintenanceStatus] = useState({
    enabled: false,
    plannedEndTime: '',
    title: 'Sistema em Manutenção',
    message: 'Estamos trabalhando para melhorar o sistema. Voltaremos em breve!'
  });
  const [loadingMaintenance, setLoadingMaintenance] = useState(false);
  
  // Adicionar efeito para verificar parâmetros na URL
  useEffect(() => {
    // Verificar se há parâmetros na URL para pré-selecionar abas
    if (router.query.tab) {
      setActiveTab(router.query.tab as string);
      
      // Se for a aba de recarga e tiver email, preencher automaticamente
      if (router.query.tab === 'recharge' && router.query.email) {
        setUserEmail(router.query.email as string);
        searchUserByEmail(router.query.email as string);
      }
    }
  }, [router.query]);

  // Versão modificada da função searchUser para ser usada programaticamente
  const searchUserByEmail = async (email: string) => {
    if (!email) return;
    
    try {
      setSearchingUser(true);
      setErrorMessage('');
      
      const response = await fetch(`/api/admin/users?email=${encodeURIComponent(email)}`);
      
      if (response.ok) {
        const user = await response.json();
        setFoundUser(user);
      } else {
        const error = await response.json();
        setErrorMessage(error.message || 'Usuário não encontrado');
        setFoundUser(null);
      }
    } catch (error) {
      console.error('Erro ao buscar usuário:', error);
      setErrorMessage('Erro ao buscar usuário');
      setFoundUser(null);
    } finally {
      setSearchingUser(false);
    }
  };

  // Função para extrair detalhes da transação
  const getTransactionDetails = (transaction: any) => {
    if (!transaction?.details) return { pixKey: 'Não informado', method: 'Não informado' };
    
    try {
      let details = {};
      
      if (typeof transaction.details === 'string') {
        details = JSON.parse(transaction.details);
      } else if (typeof transaction.details === 'object') {
        details = transaction.details;
      }
      
      const pixKey = (details as any)?.pixKey || 'Não informado';
      const methodName = (details as any)?.method || 'pixWithdraw';
      
      const formattedMethod = methodName === 'pixWithdraw' 
        ? 'PIX' 
        : methodName === 'bankAccount' 
          ? 'Conta Bancária' 
          : methodName;
      
      return { pixKey, method: formattedMethod };
    } catch (error) {
      console.error('Erro ao analisar detalhes da transação:', error);
      return { pixKey: 'Erro ao processar', method: 'Erro ao processar' };
    }
  };

  useEffect(() => {
    if (status === 'loading') return;

    if (!session || session.user.role !== 'ADMIN') {
      router.push('/');
      return;
    }

    fetchStats();
    
    // Conectar ao socket para receber atualizações de jogadores online
    const connectToSocket = async () => {
      try {
        // Garantir que a API de socket está inicializada
        await fetch('/api/socket');
        
        // Importar Socket.IO dinamicamente
        const { io } = await import('socket.io-client');
        const socket = io();
        
        // Receber contagem de jogadores
        socket.on('playerCount', (count: number) => {
          console.log('Jogadores conectados:', count);
          setPlayerCount(count);
        });
        
        // Limpar ao desmontar
        return () => {
          socket.off('playerCount');
          socket.disconnect();
        };
      } catch (error) {
        console.error('Erro ao conectar ao socket:', error);
      }
    };
    
    // Iniciar conexão com o socket
    const cleanupSocket = connectToSocket();
    
    // Limpar ao desmontar
    return () => {
      cleanupSocket.then(cleanup => cleanup && cleanup());
    };
  }, [session, status]);

  // Adicionar um efeito para carregar transações quando a aba for selecionada
  useEffect(() => {
    if (activeTab === 'withdrawals') {
      fetchWithdrawals();
    } else if (activeTab === 'deposits') {
      fetchDeposits();
    }
  }, [activeTab]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/stats');
      const data = await response.json();
      setStats(data);
      if (data?.currentRound?.houseProfit !== undefined) {
        setHouseProfit(data.currentRound.houseProfit);
      }
      setLoading(false);
    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error);
      setLoading(false);
    }
  };

  // Função para atualizar as estatísticas, incluindo dados do Multiplicador
  const refreshStats = async () => {
    try {
      setLoading(true);
      setSuccessMessage('');
      setErrorMessage('');
      
      const response = await fetch('/api/admin/stats?game=multiplicador');
      
      if (response.ok) {
        const data = await response.json();
        setStats(data);
        setSuccessMessage('Estatísticas atualizadas com sucesso!');
      } else {
        const error = await response.json();
        setErrorMessage(error.message || 'Erro ao atualizar estatísticas');
      }
    } catch (error) {
      console.error('Erro ao atualizar estatísticas:', error);
      setErrorMessage('Erro ao atualizar estatísticas');
    } finally {
      setLoading(false);
    }
  };

  const fetchWithdrawals = async () => {
    try {
      setLoadingTransactions(true);
      const response = await fetch('/api/admin/transactions?type=WITHDRAWAL');
      if (response.ok) {
        const data = await response.json();
        setWithdrawals(data);
      }
    } catch (error) {
      console.error('Erro ao buscar saques:', error);
      setErrorMessage('Erro ao carregar saques');
    } finally {
      setLoadingTransactions(false);
    }
  };

  const fetchDeposits = async () => {
    try {
      setLoadingTransactions(true);
      const response = await fetch('/api/admin/transactions?type=DEPOSIT');
      if (response.ok) {
        const data = await response.json();
        setDeposits(data);
      }
    } catch (error) {
      console.error('Erro ao buscar depósitos:', error);
      setErrorMessage('Erro ao carregar depósitos');
    } finally {
      setLoadingTransactions(false);
    }
  };

  const updateWithdrawalStatus = async (transactionId: string, status: string) => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/transactions/update-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transactionId,
          status
        }),
      });

      if (response.ok) {
        fetchWithdrawals();
        setSuccessMessage('Status do saque atualizado com sucesso');
      } else {
        const error = await response.json();
        setErrorMessage(error.message || 'Erro ao atualizar status');
      }
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      setErrorMessage('Erro ao atualizar status');
    } finally {
      setLoading(false);
    }
  };

  const updateHouseProfit = async () => {
    try {
      setLoading(true);
      setSuccessMessage('');
      setErrorMessage('');
      
      // URL do endpoint depende da aba ativa
      const endpoint = activeTab === 'multiplicador' 
        ? '/api/admin/multiplier-config'
        : '/api/rounds';
      
      // Dados para enviar dependem da aba ativa
      const requestData = activeTab === 'multiplicador'
        ? { profitMargin: houseProfit }
        : { houseProfit };
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      if (response.ok) {
        setSuccessMessage('Lucro da casa atualizado com sucesso!');
        if (activeTab === 'multiplicador') {
          refreshStats();
        } else {
          fetchStats();
        }
      } else {
        const error = await response.json();
        setErrorMessage(error.message || 'Erro ao atualizar lucro da casa');
      }
      setLoading(false);
    } catch (error) {
      console.error('Erro ao atualizar lucro da casa:', error);
      setErrorMessage('Erro ao atualizar lucro da casa');
      setLoading(false);
    }
  };

  const rechargeUserBalance = async () => {
    if (!foundUser || rechargeAmount <= 0) return;
    
    try {
      setLoading(true);
      setSuccessMessage('');
      setErrorMessage('');
      
      const response = await fetch('/api/admin/recharge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: foundUser.id,
          amount: rechargeAmount
        }),
      });

      if (response.ok) {
        const updatedUser = await response.json();
        setFoundUser(updatedUser);
        setSuccessMessage(`Saldo adicionado com sucesso! Novo saldo: R$ ${updatedUser.balance.toFixed(2)}`);
      } else {
        const error = await response.json();
        setErrorMessage(error.message || 'Erro ao adicionar saldo');
      }
    } catch (error) {
      console.error('Erro ao adicionar saldo:', error);
      setErrorMessage('Erro ao adicionar saldo');
    } finally {
      setLoading(false);
    }
  };

  // Função para abrir o modal de detalhes
  const openTransactionDetails = (transaction: any) => {
    setSelectedTransaction(transaction);
    setShowDetailsModal(true);
  };

  // Adicionar função para carregar status de manutenção
  const fetchMaintenanceStatus = async () => {
    try {
      setLoadingMaintenance(true);
      const token = localStorage.getItem('admin-api-token');
      
      const response = await fetch('/api/admin/maintenance', {
        headers: {
          Authorization: `Bearer ${token || ''}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setMaintenanceStatus(data);
      } else {
        console.error('Erro ao carregar status de manutenção');
      }
    } catch (error) {
      console.error('Erro ao carregar status de manutenção:', error);
    } finally {
      setLoadingMaintenance(false);
    }
  };

  // Adicionar efeito para carregar manutenção quando a aba for selecionada
  useEffect(() => {
    if (activeTab === 'maintenance') {
      fetchMaintenanceStatus();
    }
  }, [activeTab]);

  // Adicionar efeito para carregar estatísticas do Multiplicador quando a aba for selecionada
  useEffect(() => {
    if (activeTab === 'multiplicador') {
      refreshStats();
    }
  }, [activeTab]);

  if (status === 'loading' || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
        <div className="text-2xl">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-[#1a86c7] to-[#3bc37a] bg-clip-text text-transparent">Painel Administrativo</h1>
          <div className="text-sm">
            Logado como: <span className="text-[#3bc37a]">{session?.user?.email}</span>
          </div>
        </div>

        {/* Navegação por tabs */}
        <div className="flex border-b border-gray-800 mb-8 overflow-x-auto">
          <button
            className={`px-4 py-2 ${activeTab === 'stats' ? 'text-[#3bc37a] border-b-2 border-[#3bc37a]' : 'text-gray-400 hover:text-white'}`}
            onClick={() => setActiveTab('stats')}
          >
            Estatísticas
          </button>
          <button
            className={`px-4 py-2 ${activeTab === 'recharge' ? 'text-[#3bc37a] border-b-2 border-[#3bc37a]' : 'text-gray-400 hover:text-white'}`}
            onClick={() => setActiveTab('recharge')}
          >
            Recarga de Saldo
          </button>
          <button
            className={`px-4 py-2 ${activeTab === 'house-profit' ? 'text-[#3bc37a] border-b-2 border-[#3bc37a]' : 'text-gray-400 hover:text-white'}`}
            onClick={() => setActiveTab('house-profit')}
          >
            Lucro da Casa
          </button>
          <button
            className={`px-4 py-2 ${activeTab === 'withdrawals' ? 'text-[#3bc37a] border-b-2 border-[#3bc37a]' : 'text-gray-400 hover:text-white'}`}
            onClick={() => setActiveTab('withdrawals')}
          >
            Saques
          </button>
          <button
            className={`px-4 py-2 ${activeTab === 'deposits' ? 'text-[#3bc37a] border-b-2 border-[#3bc37a]' : 'text-gray-400 hover:text-white'}`}
            onClick={() => setActiveTab('deposits')}
          >
            Depósitos
          </button>
          <button
            className={`px-4 py-2 ${activeTab === 'chat' ? 'text-[#3bc37a] border-b-2 border-[#3bc37a]' : 'text-gray-400 hover:text-white'}`}
            onClick={() => setActiveTab('chat')}
          >
            Chat
          </button>
          <button
            className={`px-4 py-2 ${activeTab === 'maintenance' ? 'text-[#3bc37a] border-b-2 border-[#3bc37a]' : 'text-gray-400 hover:text-white'}`}
            onClick={() => setActiveTab('maintenance')}
          >
            Manutenção
          </button>
          <Link href="/admin/multiplier" legacyBehavior>
            <a className="px-4 py-2 text-gray-400 hover:text-white flex items-center">
              <span>Multiplicador</span>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" viewBox="0 0 20 20" fill="currentColor">
                <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
                <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
              </svg>
            </a>
          </Link>
        </div>

        {/* Mensagens de sucesso ou erro */}
        {successMessage && (
          <div className="bg-[#3bc37a] bg-opacity-20 border border-[#3bc37a] text-[#3bc37a] px-4 py-2 rounded-lg mb-4">
            {successMessage}
          </div>
        )}
        
        {errorMessage && (
          <div className="bg-red-500 bg-opacity-20 border border-red-500 text-red-300 px-4 py-2 rounded-lg mb-4">
            {errorMessage}
          </div>
        )}

        {/* Conteúdo da aba Estatísticas */}
        {activeTab === 'stats' && stats && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <div className="bg-gray-800 p-6 rounded-lg">
                <h2 className="text-xl font-semibold mb-2">Total de Apostas</h2>
                <p className="text-3xl font-bold text-green-500">
                  {stats.totalBets}
                </p>
              </div>

              <div className="bg-gray-800 p-6 rounded-lg">
                <h2 className="text-xl font-semibold mb-2">Valor Total Apostado</h2>
                <p className="text-3xl font-bold text-green-500">
                  R$ {stats.totalAmount?.toFixed(2) || '0.00'}
                </p>
              </div>

              <div className="bg-gray-800 p-6 rounded-lg">
                <h2 className="text-xl font-semibold mb-2">Lucro Total da Casa</h2>
                <p className="text-3xl font-bold text-green-500">
                  R$ {stats.houseProfit?.toFixed(2) || '0.00'}
                </p>
              </div>
              
              <div className="bg-gradient-to-r from-[#1a86c7] to-[#3bc37a] bg-opacity-20 p-6 rounded-lg">
                <h2 className="text-xl font-semibold mb-2">Jogadores Online</h2>
                <div className="flex items-center">
                  <p className="text-3xl font-bold text-white">
                    {playerCount}
                  </p>
                  <div className="ml-3 flex items-center">
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                    </span>
                    <span className="ml-2 text-sm text-gray-300">ao vivo</span>
                  </div>
                </div>
              </div>
            </div>

            {stats.currentRound && (
              <div className="bg-gray-800 p-6 rounded-lg mb-8">
                <h2 className="text-xl font-semibold mb-4">Rodada Atual</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-gray-400">ID da Rodada</p>
                    <p className="text-lg">{stats.currentRound.id}</p>
                  </div>
                  <div>
                    <p className="text-gray-400">Resultado Atual</p>
                    <p className="text-lg">{stats.currentRound.result?.toFixed(2) || 'Não definido'}</p>
                  </div>
                  <div>
                    <p className="text-gray-400">Término Previsto</p>
                    <p className="text-lg">
                      {stats.currentRound.endTime ? new Date(stats.currentRound.endTime).toLocaleString() : 'Não definido'}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-400">Lucro da Casa na Rodada</p>
                    <p className="text-lg">R$ {stats.currentRound.houseProfit?.toFixed(2) || '0.00'}</p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Conteúdo da aba Recarga de Saldo */}
        {activeTab === 'recharge' && (
          <div className="bg-gray-800 p-6 rounded-lg mb-8">
            <h2 className="text-xl font-semibold mb-4">Adicionar Saldo a Usuário</h2>
            
            <div className="mb-6">
              <div className="flex items-end gap-2 mb-4">
                <div className="flex-grow">
                  <label htmlFor="email" className="block text-sm font-medium text-gray-400 mb-1">
                    Email do Usuário
                  </label>
                  <input
                    type="email"
                    id="email"
                    value={userEmail}
                    onChange={(e) => setUserEmail(e.target.value)}
                    className="w-full bg-gray-700 text-white px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="email@exemplo.com"
                  />
                </div>
                <button
                  onClick={() => searchUserByEmail(userEmail)}
                  disabled={!userEmail || searchingUser}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white disabled:bg-gray-600"
                >
                  {searchingUser ? 'Buscando...' : 'Buscar'}
                </button>
              </div>
              
              {foundUser && (
                <div className="bg-gray-700 p-4 rounded mb-4">
                  <h3 className="font-semibold mb-2">Usuário Encontrado</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-gray-400">Nome:</span> {foundUser.name}
                    </div>
                    <div>
                      <span className="text-gray-400">Email:</span> {foundUser.email}
                    </div>
                    <div>
                      <span className="text-gray-400">ID:</span> {foundUser.id}
                    </div>
                    <div>
                      <span className="text-gray-400">Saldo Atual:</span> <span className="text-green-400">R$ {foundUser.balance.toFixed(2)}</span>
                    </div>
                  </div>
                  
                  <div className="mt-4">
                    <label htmlFor="amount" className="block text-sm font-medium text-gray-400 mb-1">
                      Valor a Adicionar (R$)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        id="amount"
                        value={rechargeAmount}
                        onChange={(e) => setRechargeAmount(Number(e.target.value))}
                        min="1"
                        step="1"
                        className="w-40 bg-gray-800 text-white px-3 py-2 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
                      <button
                        onClick={rechargeUserBalance}
                        disabled={rechargeAmount <= 0 || loading}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded text-white disabled:bg-gray-600"
                      >
                        Adicionar Saldo
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Conteúdo da aba Lucro da Casa */}
        {activeTab === 'house-profit' && stats && (
          <div className="bg-gray-800 p-6 rounded-lg mb-8">
            <h2 className="text-xl font-semibold mb-4">Configuração de Lucro da Casa</h2>
            
            <div className="grid grid-cols-1 gap-6 mb-8">
              <div className="bg-gray-900 p-4 rounded-lg border border-gray-700">
                <h3 className="flex items-center text-lg font-medium text-green-400 mb-3">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                  </svg>
                  Visão Geral Financeira
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-gray-800 p-3 rounded-lg">
                    <p className="text-gray-400 text-sm">Lucro Total da Casa</p>
                    <p className="text-3xl font-bold text-green-500">
                      R$ {stats.houseProfit?.toFixed(2) || '0.00'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">Acumulado de todas as rodadas</p>
                  </div>
                  
                  <div className="bg-gray-800 p-3 rounded-lg">
                    <p className="text-gray-400 text-sm">Valor Total Apostado</p>
                    <p className="text-3xl font-bold text-blue-400">
                      R$ {stats.totalAmount?.toFixed(2) || '0.00'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">Total de {stats.totalBets || 0} apostas realizadas</p>
                  </div>
                  
                  <div className="bg-gray-800 p-3 rounded-lg">
                    <p className="text-gray-400 text-sm">Taxa de Lucratividade</p>
                    <p className="text-3xl font-bold text-yellow-400">
                      {stats.totalAmount && stats.totalAmount > 0
                        ? `${((stats.houseProfit / stats.totalAmount) * 100).toFixed(2)}%`
                        : '0.00%'
                      }
                    </p>
                    <p className="text-xs text-gray-500 mt-1">Retorno sobre valor apostado</p>
                  </div>
                </div>
              </div>
              
              {stats.currentRound && (
                <div className="bg-gray-900 p-4 rounded-lg border border-gray-700">
                  <h3 className="flex items-center text-lg font-medium text-blue-400 mb-3">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                    </svg>
                    Rodada Atual
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div className="bg-gray-800 p-3 rounded-lg">
                      <p className="text-gray-400 text-sm">ID da Rodada</p>
                      <p className="text-md font-medium text-white truncate">{stats.currentRound.id}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        Término: {new Date(stats.currentRound.endTime).toLocaleTimeString()}
                      </p>
                    </div>
                    
                    <div className="bg-gray-800 p-3 rounded-lg">
                      <p className="text-gray-400 text-sm">Resultado Atual</p>
                      <p className="text-2xl font-bold text-white">
                        {stats.currentRound.result?.toFixed(2) || 'Aguardando'}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">Multiplicador final</p>
                    </div>
                    
                    <div className="bg-gray-800 p-3 rounded-lg">
                      <p className="text-gray-400 text-sm">Lucro da Casa (Rodada)</p>
                      <p className="text-2xl font-bold text-green-500">
                        {stats.currentRound.houseProfit}%
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Margem aplicada à rodada atual
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="bg-gray-900 p-4 rounded-lg border border-gray-700">
                <h3 className="flex items-center text-lg font-medium text-purple-400 mb-3">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                  </svg>
                  Ajustar Lucro da Casa
                </h3>
                <div className="mb-4">
                  <p className="text-sm text-gray-300 mb-3">
                    Defina a porcentagem de lucro da casa para a rodada atual. Este valor determina a vantagem 
                    matemática da casa sobre os jogadores.
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <div className="mb-3">
                        <div className="flex justify-between mb-1">
                          <label htmlFor="houseProfit" className="text-sm font-medium text-gray-400">
                            Lucro da Casa (%)
                          </label>
                          <span className="text-sm text-white">{houseProfit}%</span>
                        </div>
                        <input
                          type="range"
                          id="houseProfit"
                          value={houseProfit}
                          onChange={(e) => setHouseProfit(Number(e.target.value))}
                          min="0"
                          max="15"
                          step="0.5"
                          className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-500"
                        />
                        <div className="flex justify-between mt-1 text-xs text-gray-500">
                          <span>0%</span>
                          <span>Recomendado: 3-5%</span>
                          <span>15%</span>
                        </div>
                      </div>
                      
                      <div className="flex flex-wrap gap-2 my-4">
                        <button 
                          onClick={() => setHouseProfit(1)}
                          className="px-2 py-1 bg-gray-700 rounded text-xs hover:bg-gray-600 transition-colors"
                        >
                          1%
                        </button>
                        <button 
                          onClick={() => setHouseProfit(3)}
                          className="px-2 py-1 bg-gray-700 rounded text-xs hover:bg-gray-600 transition-colors"
                        >
                          3%
                        </button>
                        <button 
                          onClick={() => setHouseProfit(5)}
                          className="px-2 py-1 bg-gray-700 rounded text-xs hover:bg-gray-600 transition-colors"
                        >
                          5%
                        </button>
                        <button 
                          onClick={() => setHouseProfit(7)}
                          className="px-2 py-1 bg-gray-700 rounded text-xs hover:bg-gray-600 transition-colors"
                        >
                          7%
                        </button>
                        <button 
                          onClick={() => setHouseProfit(10)}
                          className="px-2 py-1 bg-gray-700 rounded text-xs hover:bg-gray-600 transition-colors"
                        >
                          10%
                        </button>
                      </div>
                      
                      <button
                        onClick={updateHouseProfit}
                        disabled={loading}
                        className="w-full px-4 py-2 bg-gradient-to-r from-blue-500 to-green-500 text-white rounded-md hover:opacity-90 disabled:opacity-50 transition-colors"
                      >
                        {loading ? 'Atualizando...' : 'Aplicar Configurações'}
                      </button>
                    </div>
                    
                    <div className="bg-gray-800 p-4 rounded-lg">
                      <h4 className="text-sm font-medium text-yellow-400 mb-2">Guia de Margem de Lucro</h4>
                      <ul className="text-sm space-y-2 text-gray-300">
                        <li className="flex items-start">
                          <span className="text-blue-400 mr-2">•</span>
                          <span><strong>1-2%:</strong> Muito baixo - quase equilibrado entre jogador e casa</span>
                        </li>
                        <li className="flex items-start">
                          <span className="text-green-400 mr-2">•</span>
                          <span><strong>3-5%:</strong> Recomendado - boa experiência para jogadores com lucro sustentável</span>
                        </li>
                        <li className="flex items-start">
                          <span className="text-yellow-400 mr-2">•</span>
                          <span><strong>6-10%:</strong> Alto - lucro maior para a casa, menor retorno aos jogadores</span>
                        </li>
                        <li className="flex items-start">
                          <span className="text-red-400 mr-2">•</span>
                          <span><strong>10-15%:</strong> Muito alto - jogadores terão dificuldade em ganhar a longo prazo</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="bg-gray-900 p-4 rounded-lg border border-gray-700">
                <h3 className="flex items-center text-lg font-medium text-amber-400 mb-3">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  Informações sobre Lucro da Casa
                </h3>
                <div className="text-sm text-gray-300 space-y-3">
                  <p>
                    O <strong>lucro da casa</strong> (ou house edge) é a vantagem matemática que o cassino tem sobre os jogadores.
                    É calculado como uma porcentagem do valor total apostado que o cassino espera ganhar a longo prazo.
                  </p>
                  <p>
                    <strong>Como funciona:</strong> Um lucro da casa de 5% significa que, para cada R$100 apostados, a casa espera 
                    ganhar R$5 a longo prazo. Quanto menor o lucro da casa, mais justo é o jogo para os jogadores.
                  </p>
                  <p>
                    <strong>Recomendação:</strong> Para oferecer uma boa experiência aos jogadores enquanto mantém a 
                    sustentabilidade financeira, recomendamos manter o lucro da casa entre 3% e 5%.
                  </p>
                  <p>
                    Um valor muito alto pode afastar jogadores ao perceberem que têm poucas chances de ganhar, enquanto 
                    um valor muito baixo pode não gerar receita suficiente para cobrir custos operacionais.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Conteúdo da aba Saques */}
        {activeTab === 'withdrawals' && (
          <div className="bg-gray-800 p-6 rounded-lg mb-8">
            <h2 className="text-xl font-semibold mb-4">Gerenciamento de Saques</h2>
            
            {loadingTransactions ? (
              <div className="text-center py-8">Carregando saques...</div>
            ) : withdrawals.length === 0 ? (
              <div className="text-center py-8 text-gray-400">Nenhum saque encontrado</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="px-4 py-3 text-left text-sm text-gray-400">ID</th>
                      <th className="px-4 py-3 text-left text-sm text-gray-400">Usuário</th>
                      <th className="px-4 py-3 text-left text-sm text-gray-400">Data</th>
                      <th className="px-4 py-3 text-left text-sm text-gray-400">Método</th>
                      <th className="px-4 py-3 text-left text-sm text-gray-400">Chave/Dados</th>
                      <th className="px-4 py-3 text-right text-sm text-gray-400">Valor</th>
                      <th className="px-4 py-3 text-center text-sm text-gray-400">Status</th>
                      <th className="px-4 py-3 text-right text-sm text-gray-400">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {withdrawals.map((withdrawal) => {
                      const { pixKey, method } = getTransactionDetails(withdrawal);
                      return (
                        <tr key={withdrawal.id} className="border-b border-gray-700 hover:bg-gray-700 cursor-pointer" onClick={() => openTransactionDetails(withdrawal)}>
                          <td className="px-4 py-3 text-sm">{withdrawal.id.substring(0, 8)}...</td>
                          <td className="px-4 py-3 text-sm">{withdrawal.user?.email || 'N/A'}</td>
                          <td className="px-4 py-3 text-sm">{new Date(withdrawal.createdAt).toLocaleString()}</td>
                          <td className="px-4 py-3 text-sm">{method}</td>
                          <td className="px-4 py-3 text-sm">{pixKey}</td>
                          <td className="px-4 py-3 text-sm text-red-400 text-right">R$ {withdrawal.amount.toFixed(2)}</td>
                          <td className="px-4 py-3 text-sm text-center">
                            <span 
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                withdrawal.status === 'COMPLETED' 
                                  ? 'bg-green-100 text-green-800' 
                                  : withdrawal.status === 'REJECTED'
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-yellow-100 text-yellow-800'
                              }`}
                            >
                              {withdrawal.status === 'COMPLETED' 
                                ? 'Concluído' 
                                : withdrawal.status === 'REJECTED'
                                ? 'Rejeitado'
                                : 'Pendente'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-right" onClick={(e) => e.stopPropagation()}>
                            {withdrawal.status === 'PENDING' && (
                              <div className="flex justify-end space-x-2">
                                <button
                                  onClick={() => updateWithdrawalStatus(withdrawal.id, 'COMPLETED')}
                                  className="px-2 py-1 bg-green-600 text-xs rounded hover:bg-green-700"
                                  disabled={loading}
                                >
                                  Aprovar
                                </button>
                                <button
                                  onClick={() => updateWithdrawalStatus(withdrawal.id, 'REJECTED')}
                                  className="px-2 py-1 bg-red-600 text-xs rounded hover:bg-red-700"
                                  disabled={loading}
                                >
                                  Rejeitar
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Conteúdo da aba Depósitos */}
        {activeTab === 'deposits' && (
          <div className="bg-gray-800 p-6 rounded-lg mb-8">
            <h2 className="text-xl font-semibold mb-4">Gerenciamento de Depósitos</h2>
            
            {loadingTransactions ? (
              <div className="text-center py-8">Carregando depósitos...</div>
            ) : deposits.length === 0 ? (
              <div className="text-center py-8 text-gray-400">Nenhum depósito encontrado</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="px-4 py-3 text-left text-sm text-gray-400">ID</th>
                      <th className="px-4 py-3 text-left text-sm text-gray-400">Usuário</th>
                      <th className="px-4 py-3 text-left text-sm text-gray-400">Data</th>
                      <th className="px-4 py-3 text-right text-sm text-gray-400">Valor</th>
                      <th className="px-4 py-3 text-center text-sm text-gray-400">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deposits.map((deposit) => (
                      <tr key={deposit.id} className="border-b border-gray-700">
                        <td className="px-4 py-3 text-sm">{deposit.id.substring(0, 8)}...</td>
                        <td className="px-4 py-3 text-sm">{deposit.user?.email || 'N/A'}</td>
                        <td className="px-4 py-3 text-sm">{new Date(deposit.createdAt).toLocaleString()}</td>
                        <td className="px-4 py-3 text-sm text-green-400 text-right">R$ {deposit.amount.toFixed(2)}</td>
                        <td className="px-4 py-3 text-sm text-center">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Concluído
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Conteúdo da aba 'chat' */}
        {activeTab === 'chat' && (
          <div>
            <h2 className="text-2xl font-bold mb-6">Chat de Suporte</h2>
            <div className="bg-[#121212] p-6 rounded-lg shadow-xl">
              <ChatSupport 
                isAdmin={true} 
                selectedUserId={selectedChatUser}
                onUserChange={setSelectedChatUser}
                title="Painel de Suporte"
                height="700px"
              />
            </div>
          </div>
        )}

        {/* Conteúdo da aba Manutenção */}
        {activeTab === 'maintenance' && (
          <div className="bg-gray-800 p-6 rounded-lg mb-8">
            <h2 className="text-xl font-semibold mb-4">Controle de Manutenção do Sistema</h2>
            
            {loadingMaintenance ? (
              <div className="text-center py-8">Carregando informações de manutenção...</div>
            ) : (
              <>
                <div className="mb-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-3 h-3 rounded-full ${maintenanceStatus.enabled ? 'bg-red-500' : 'bg-green-500'}`}></div>
                    <span className="font-medium">
                      Status atual: {maintenanceStatus.enabled ? 'Em manutenção' : 'Sistema online'}
                    </span>
                  </div>
                  
                  {maintenanceStatus.enabled && (
                    <div className="bg-red-900 bg-opacity-30 border border-red-700 p-4 rounded-lg mb-4">
                      <h3 className="text-red-400 font-medium mb-2">Sistema em Modo de Manutenção</h3>
                      <p className="text-sm mb-2">O sistema está atualmente em manutenção e indisponível para usuários.</p>
                      
                      {maintenanceStatus.plannedEndTime && (
                        <div className="mt-2">
                          <p className="text-sm">Retorno previsto: <span className="font-medium">{new Date(maintenanceStatus.plannedEndTime).toLocaleString()}</span></p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                
                <div className="bg-gray-700 p-5 rounded-lg mb-6">
                  <h3 className="text-lg font-medium mb-4">Configurações de Manutenção</h3>
                  
                  <div className="space-y-2 mb-4">
                    <p><span className="text-gray-400">Título:</span> {maintenanceStatus.title}</p>
                    <p><span className="text-gray-400">Mensagem:</span> {maintenanceStatus.message}</p>
                    <p>
                      <span className="text-gray-400">Previsão de término:</span>{' '}
                      {maintenanceStatus.plannedEndTime 
                        ? new Date(maintenanceStatus.plannedEndTime).toLocaleString() 
                        : 'Não definido'}
                    </p>
                  </div>
                  
                  <Link href="/admin/maintenance" legacyBehavior>
                    <a className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white">
                      Editar Configurações de Manutenção
                    </a>
                  </Link>
                </div>
                
                <div className="bg-gray-700 p-5 rounded-lg">
                  <h3 className="text-lg font-medium mb-4">Recursos de Manutenção</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-gray-800 p-4 rounded-lg">
                      <h4 className="font-medium mb-2">Notificação de Manutenção</h4>
                      <p className="text-sm mb-3">
                        O banner de manutenção informa automaticamente os usuários quando uma manutenção está programada.
                      </p>
                      {maintenanceStatus.enabled ? (
                        <div className="bg-red-500 text-white px-3 py-2 rounded text-sm">
                          Banner de manutenção ativo
                        </div>
                      ) : (
                        <div className="bg-gray-600 text-gray-300 px-3 py-2 rounded text-sm">
                          Banner de manutenção inativo
                        </div>
                      )}
                    </div>
                    
                    <div className="bg-gray-800 p-4 rounded-lg">
                      <h4 className="font-medium mb-2">Monitoramento do Sistema</h4>
                      <p className="text-sm mb-3">
                        Verifique o status atual do sistema, incluindo uso de recursos e conectividade.
                      </p>
                      <Link href="/admin/system-status" legacyBehavior>
                        <a className="inline-block px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm">
                          Ver Status do Sistema
                        </a>
                      </Link>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Conteúdo da aba Multiplicador */}
        {activeTab === 'multiplicador' && (
          <div className="bg-gray-800 p-6 rounded-lg mb-8">
            <h2 className="text-xl font-semibold mb-4">Administração do Jogo Multiplicador</h2>
            
            <div className="grid grid-cols-1 gap-6 mb-8">
              {/* Configurações do Jogo */}
              <div className="bg-gray-900 p-4 rounded-lg border border-gray-700">
                <h3 className="flex items-center text-lg font-medium text-green-400 mb-3">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                  </svg>
                  Configurações do Jogo
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  {/* Configuração de Lucro da Casa */}
                  <div className="bg-gray-800 p-3 rounded-lg">
                    <p className="text-gray-400 text-sm">Margem de Lucro da Casa</p>
                    <div className="mb-3">
                      <div className="flex justify-between mb-1">
                        <label htmlFor="multiplierProfit" className="text-sm font-medium text-gray-400">
                          Margem (%)
                        </label>
                        <span className="text-sm text-white">{houseProfit}%</span>
                      </div>
                      <input
                        type="range"
                        id="multiplierProfit"
                        value={houseProfit}
                        onChange={(e) => setHouseProfit(Number(e.target.value))}
                        min="0"
                        max="15"
                        step="0.5"
                        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-500"
                      />
                      <div className="flex justify-between mt-1 text-xs text-gray-500">
                        <span>0%</span>
                        <span>Recomendado: 3-5%</span>
                        <span>15%</span>
                      </div>
                    </div>
                    
                    <button
                      onClick={updateHouseProfit}
                      disabled={loading}
                      className="w-full px-4 py-2 bg-gradient-to-r from-blue-500 to-green-500 text-white rounded-md hover:opacity-90 disabled:opacity-50 transition-colors"
                    >
                      {loading ? 'Atualizando...' : 'Aplicar Margem de Lucro'}
                    </button>
                  </div>
                  
                  {/* Saldo da Casa */}
                  <div className="bg-gray-800 p-3 rounded-lg">
                    <p className="text-gray-400 text-sm mb-2">Saldo da Casa</p>
                    <p className="text-3xl font-bold text-green-400">R$ {stats?.houseBalance?.toFixed(2) || '100,000.00'}</p>
                    <p className="text-xs text-gray-500 mt-1">Saldo disponível para pagamento de prêmios</p>
                    
                    <button
                      onClick={refreshStats}
                      disabled={loading}
                      className="w-full mt-4 px-4 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-600 disabled:opacity-50 transition-colors"
                    >
                      Atualizar Estatísticas
                    </button>
                  </div>
                </div>
              </div>
              
              {/* Estatísticas do Jogo */}
              <div className="bg-gray-900 p-4 rounded-lg border border-gray-700">
                <h3 className="flex items-center text-lg font-medium text-blue-400 mb-3">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M2 10a8 8 0 018-8v8h8a8 8 0 11-16 0z" />
                    <path d="M12 2.252A8.014 8.014 0 0117.748 8H12V2.252z" />
                  </svg>
                  Estatísticas do Jogo Multiplicador
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-gray-800 p-3 rounded-lg">
                    <p className="text-gray-400 text-sm">Total de Apostas</p>
                    <p className="text-2xl font-bold text-white">{stats?.totalMultiplierBets || 0}</p>
                    <p className="text-xs text-gray-500 mt-1">Número total de apostas realizadas</p>
                  </div>
                  
                  <div className="bg-gray-800 p-3 rounded-lg">
                    <p className="text-gray-400 text-sm">Valor Total Apostado</p>
                    <p className="text-2xl font-bold text-white">R$ {stats?.totalMultiplierAmount?.toFixed(2) || '0.00'}</p>
                    <p className="text-xs text-gray-500 mt-1">Soma de todas as apostas</p>
                  </div>
                  
                  <div className="bg-gray-800 p-3 rounded-lg">
                    <p className="text-gray-400 text-sm">Total de Pagamentos</p>
                    <p className="text-2xl font-bold text-white">R$ {stats?.totalMultiplierPayout?.toFixed(2) || '0.00'}</p>
                    <p className="text-xs text-gray-500 mt-1">Soma de todos os prêmios pagos</p>
                  </div>
                </div>
              </div>
              
              {/* Últimas Rodadas */}
              <div className="bg-gray-900 p-4 rounded-lg border border-gray-700">
                <h3 className="flex items-center text-lg font-medium text-purple-400 mb-3">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                  </svg>
                  Últimas Rodadas
                </h3>
                
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-700">
                        <th className="px-4 py-2 text-left text-sm text-gray-400">ID</th>
                        <th className="px-4 py-2 text-left text-sm text-gray-400">Horário</th>
                        <th className="px-4 py-2 text-center text-sm text-gray-400">Multiplicador</th>
                        <th className="px-4 py-2 text-right text-sm text-gray-400">Apostas</th>
                        <th className="px-4 py-2 text-right text-sm text-gray-400">Valor Total</th>
                        <th className="px-4 py-2 text-center text-sm text-gray-400">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats?.recentRounds?.map((round, index) => (
                        <tr key={round.id} className="border-b border-gray-700 hover:bg-gray-700">
                          <td className="px-4 py-2 text-sm">{round.id.substring(0, 8)}...</td>
                          <td className="px-4 py-2 text-sm">{new Date(round.endTime || round.startTime).toLocaleString()}</td>
                          <td className="px-4 py-2 text-sm text-center">
                            <span className={`font-medium ${
                              round.result && round.result >= 1.5 ? 'text-green-500' :
                              round.result && round.result >= 1.0 ? 'text-blue-400' :
                              round.result && round.result > 0 ? 'text-red-500' : 'text-gray-400'
                            }`}>
                              {round.result ? round.result.toFixed(2) + 'x' : 'N/A'}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-sm text-right">{round.totalBets || 0}</td>
                          <td className="px-4 py-2 text-sm text-right">R$ {round.totalAmount?.toFixed(2) || '0.00'}</td>
                          <td className="px-4 py-2 text-sm text-center">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              round.status === 'FINISHED' 
                                ? 'bg-green-100 text-green-800' 
                                : round.status === 'RUNNING'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-yellow-100 text-yellow-800'
                            }`}>
                              {round.status === 'FINISHED' 
                                ? 'Finalizada' 
                                : round.status === 'RUNNING'
                                ? 'Em Andamento'
                                : 'Apostas'}
                            </span>
                          </td>
                        </tr>
                      ))}
                      
                      {(!stats?.recentRounds || stats.recentRounds.length === 0) && (
                        <tr>
                          <td colSpan={6} className="px-4 py-4 text-center text-gray-500">
                            Nenhuma rodada recente encontrada
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              
              {/* Guia de Gestão do Jogo */}
              <div className="bg-gray-900 p-4 rounded-lg border border-gray-700">
                <h3 className="flex items-center text-lg font-medium text-amber-400 mb-3">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  Guia de Administração
                </h3>
                <div className="text-sm text-gray-300 space-y-3">
                  <p>
                    <strong>Jogo Multiplicador</strong> é baseado em um multiplicador que varia entre 0.0x e 2.0x, onde os jogadores apostam e podem fazer cash-out a qualquer momento para garantir seus ganhos.
                  </p>
                  <p>
                    <strong>Margem de Lucro:</strong> Define a vantagem matemática da casa. Uma margem de 5% significa que, a longo prazo, a casa terá um lucro de 5% sobre o valor total apostado.
                  </p>
                  <p>
                    <strong>Recomendações:</strong>
                  </p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>Mantenha a margem entre 3% e 5% para um equilíbrio entre lucratividade e experiência do jogador.</li>
                    <li>Monitore o saldo da casa para garantir que haja fundos suficientes para pagar prêmios.</li>
                    <li>Acompanhe as estatísticas regularmente para identificar tendências e ajustar configurações se necessário.</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Modal de Detalhes da Transação */}
      <div
        className={`fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-70 transition-all duration-200 ${showDetailsModal ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setShowDetailsModal(false)}
      >
        <div className="bg-gray-800 rounded-lg shadow-xl max-w-lg w-full border border-gray-700" onClick={e => e.stopPropagation()}>
          <div className="p-4 border-b border-gray-700 flex justify-between items-center">
            <h3 className="text-lg font-medium">Detalhes do Saque</h3>
            <button 
              onClick={() => setShowDetailsModal(false)} 
              className="text-gray-400 hover:text-white"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <div className="p-6">
            {selectedTransaction && (
              <div className="space-y-4">
                <div className="bg-gray-700 p-4 rounded-lg">
                  <h3 className="text-lg font-medium mb-3">Informações Gerais</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-sm text-gray-400">ID da Transação</p>
                      <p className="font-medium break-all">{selectedTransaction.id}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-400">Data/Hora</p>
                      <p className="font-medium">{new Date(selectedTransaction.createdAt).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-400">Valor</p>
                      <p className="font-medium text-red-400">R$ {selectedTransaction.amount.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-400">Status</p>
                      <p className={`font-medium ${
                        selectedTransaction.status === 'COMPLETED' 
                          ? 'text-green-400' 
                          : selectedTransaction.status === 'REJECTED'
                          ? 'text-red-400'
                          : 'text-yellow-400'
                      }`}>
                        {selectedTransaction.status === 'COMPLETED' 
                          ? 'Concluído' 
                          : selectedTransaction.status === 'REJECTED'
                          ? 'Rejeitado'
                          : 'Pendente'}
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-gray-700 p-4 rounded-lg">
                  <h3 className="text-lg font-medium mb-3">Dados do Usuário</h3>
                  <div className="grid grid-cols-1 gap-3">
                    <div>
                      <p className="text-sm text-gray-400">Nome</p>
                      <p className="font-medium">{selectedTransaction.user?.name || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-400">Email</p>
                      <p className="font-medium">{selectedTransaction.user?.email || 'N/A'}</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-gray-700 p-4 rounded-lg">
                  <h3 className="text-lg font-medium mb-3">Dados do Saque</h3>
                  {(() => {
                    const { pixKey, method } = getTransactionDetails(selectedTransaction);
                    return (
                      <div className="grid grid-cols-1 gap-3">
                        <div>
                          <p className="text-sm text-gray-400">Método</p>
                          <p className="font-medium">{method}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-400">Chave PIX / Dados Bancários</p>
                          <p className="font-medium break-all">{pixKey}</p>
                        </div>
                      </div>
                    );
                  })()}
                </div>
                
                {selectedTransaction.status === 'PENDING' && (
                  <div className="flex justify-end space-x-3 mt-6">
                    <button
                      onClick={() => {
                        updateWithdrawalStatus(selectedTransaction.id, 'REJECTED');
                        setShowDetailsModal(false);
                      }}
                      className="px-4 py-2 bg-red-600 rounded hover:bg-red-700"
                      disabled={loading}
                    >
                      Rejeitar Saque
                    </button>
                    <button
                      onClick={() => {
                        updateWithdrawalStatus(selectedTransaction.id, 'COMPLETED');
                        setShowDetailsModal(false);
                      }}
                      className="px-4 py-2 bg-green-600 rounded hover:bg-green-700"
                      disabled={loading}
                    >
                      Aprovar Saque
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 