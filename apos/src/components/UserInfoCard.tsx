'use client';

import React, { useState, useEffect } from 'react';

interface UserInfoProps {
  userId: string;
}

interface UserDetails {
  id: string;
  email: string;
  name: string;
  phone?: string;
  address?: string;
  balance: number;
  createdAt: string;
  totalBets: number;
  dailyBetLimit: number;
  role: string;
  _count: {
    bets: number;
    transactions: number;
  };
  statistics: {
    totalBetsCount: number;
    totalBetsAmount: number;
    totalDeposits: number;
    totalDepositsCount: number;
    totalWithdrawals: number;
    totalWithdrawalsCount: number;
  };
}

export default function UserInfoCard({ userId }: UserInfoProps) {
  const [userInfo, setUserInfo] = useState<UserDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    // Resetar quando o usuário mudar
    setUserInfo(null);
    setError('');
    
    if (userId) {
      fetchUserInfo(userId);
    }
  }, [userId]);

  const fetchUserInfo = async (id: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/users/details?id=${id}`);
      
      if (response.ok) {
        const data = await response.json();
        setUserInfo(data);
        setError('');
      } else {
        setError('Falha ao carregar informações do usuário');
      }
    } catch (err) {
      console.error('Erro ao buscar informações do usuário:', err);
      setError('Erro ao carregar informações');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !userInfo) {
    return (
      <div className="bg-[#1a1a1a] rounded-lg p-3 border border-gray-800 mb-3">
        <div className="animate-pulse space-y-2">
          <div className="h-4 bg-gray-700 rounded w-1/2"></div>
          <div className="h-4 bg-gray-700 rounded w-3/4"></div>
          <div className="h-4 bg-gray-700 rounded w-2/3"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-[#1a1a1a] rounded-lg p-3 border border-gray-800 mb-3">
        <p className="text-red-400 text-sm">{error}</p>
      </div>
    );
  }

  if (!userInfo) {
    return null;
  }

  // Formatando a data de criação
  const createdDate = new Date(userInfo.createdAt);
  const formattedDate = createdDate.toLocaleDateString('pt-BR');
  
  // Calcular último depósito ou saque
  const hasTransactions = userInfo.statistics.totalDepositsCount > 0 || userInfo.statistics.totalWithdrawalsCount > 0;

  return (
    <div className="bg-[#1a1a1a] rounded-lg p-3 border border-gray-800 mb-3">
      <div 
        className="flex justify-between items-center mb-2 cursor-pointer" 
        onClick={() => setExpanded(!expanded)}
      >
        <h3 className="text-sm font-medium text-gray-300">Informações do Usuário</h3>
        <button className="text-gray-400 hover:text-white">
          {expanded ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="18 15 12 9 6 15"></polyline>
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          )}
        </button>
      </div>

      <div className={`space-y-2 transition-all duration-300 overflow-hidden ${expanded ? 'max-h-[800px]' : 'max-h-[72px]'}`}>
        <div className="flex flex-col">
          <div className="flex justify-between">
            <span className="text-gray-400 text-xs">Nome:</span>
            <span className="text-white text-xs font-medium">{userInfo.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400 text-xs">Email:</span>
            <span className="text-white text-xs">{userInfo.email}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400 text-xs">Saldo:</span>
            <span className="text-green-400 text-xs font-medium">R$ {userInfo.balance.toFixed(2)}</span>
          </div>
        </div>

        {expanded && (
          <>
            <div className="border-t border-gray-700 my-2 pt-2">
              <div className="flex justify-between">
                <span className="text-gray-400 text-xs">ID:</span>
                <span className="text-white text-xs">{userInfo.id}</span>
              </div>
              {userInfo.phone && (
                <div className="flex justify-between">
                  <span className="text-gray-400 text-xs">Telefone:</span>
                  <span className="text-white text-xs">{userInfo.phone}</span>
                </div>
              )}
              {userInfo.address && (
                <div className="flex justify-between">
                  <span className="text-gray-400 text-xs">Endereço:</span>
                  <span className="text-white text-xs">{userInfo.address}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-400 text-xs">Total de Apostas:</span>
                <span className="text-white text-xs">{userInfo.totalBets}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400 text-xs">Limite Diário:</span>
                <span className="text-white text-xs">R$ {userInfo.dailyBetLimit.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400 text-xs">Cadastrado em:</span>
                <span className="text-white text-xs">{formattedDate}</span>
              </div>
            </div>

            {/* Estatísticas adicionais */}
            <div className="border-t border-gray-700 mt-2 pt-2">
              <h4 className="text-xs font-medium text-gray-300 mb-1">Estatísticas</h4>
              
              <div className="grid grid-cols-2 gap-2 mb-2">
                <div className="bg-gray-800 rounded p-2">
                  <div className="text-xs text-gray-400">Apostas</div>
                  <div className="text-sm font-medium text-white">{userInfo.statistics.totalBetsCount}</div>
                  <div className="text-xs text-green-400">R$ {userInfo.statistics.totalBetsAmount.toFixed(2)}</div>
                </div>
                
                <div className="bg-gray-800 rounded p-2">
                  <div className="text-xs text-gray-400">Depósitos</div>
                  <div className="text-sm font-medium text-white">{userInfo.statistics.totalDepositsCount}</div>
                  <div className="text-xs text-green-400">R$ {userInfo.statistics.totalDeposits.toFixed(2)}</div>
                </div>
                
                <div className="bg-gray-800 rounded p-2">
                  <div className="text-xs text-gray-400">Saques</div>
                  <div className="text-sm font-medium text-white">{userInfo.statistics.totalWithdrawalsCount}</div>
                  <div className="text-xs text-red-400">R$ {userInfo.statistics.totalWithdrawals.toFixed(2)}</div>
                </div>
                
                <div className="bg-gray-800 rounded p-2">
                  <div className="text-xs text-gray-400">Nível</div>
                  <div className="text-sm font-medium text-white capitalize">{userInfo.role}</div>
                  <div className="text-xs text-gray-400">{hasTransactions ? 'Ativo' : 'Novo'}</div>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-700 mt-2 pt-2">
              <div className="flex justify-end gap-2">
                <a 
                  href={`/admin?tab=recharge&email=${encodeURIComponent(userInfo.email)}`}
                  className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white text-xs rounded"
                >
                  Adicionar Saldo
                </a>
                <button 
                  onClick={() => fetchUserInfo(userId)}
                  className="px-2 py-1 bg-gray-600 hover:bg-gray-700 text-white text-xs rounded"
                >
                  Atualizar
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
} 