'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Progress } from '@/components/ui/progress';
import { useBalance } from '@/lib/BalanceContext';

type PlayerLevel = {
  id: string;
  level: number;
  name: string;
  requiredXP: number;
  bonusMultiplier: number;
  loyaltyMultiplier: number;
  dailyBonus: number;
  description?: string | null;
  icon?: string | null;
};

type Reward = {
  id: string;
  name: string;
  description: string;
  pointsCost: number;
  type: string;
  value: number;
  icon?: string | null;
  isActive: boolean;
  minimumLevel: number;
};

type RedeemedReward = {
  id: string;
  name: string;
  type: string;
  value: number;
  createdAt: string;
};

type LevelData = {
  user: {
    id: string;
    name: string;
    level: number;
    xp: number;
    loyaltyPoints: number;
    totalPlayed: number;
    daysActive: number;
    lastActive: string;
  };
  currentLevel: PlayerLevel;
  nextLevel: PlayerLevel | null;
  progress: number;
  xpRequired: number;
  xpCurrent: number;
  availableRewards: Reward[];
  redeemedRewards: RedeemedReward[];
};

export default function LevelPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { refreshBalance } = useBalance();
  
  const [isLoading, setIsLoading] = useState(true);
  const [levelData, setLevelData] = useState<LevelData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [redemptionStatus, setRedemptionStatus] = useState<{ 
    loading: boolean; 
    success: boolean; 
    message: string | null;
    rewardId: string | null;
  }>({
    loading: false,
    success: false,
    message: null,
    rewardId: null
  });

  useEffect(() => {
    // Redirecionar se não estiver autenticado
    if (status === 'unauthenticated') {
      router.push('/auth/login');
    }
    
    // Carregar dados de nível
    if (status === 'authenticated' && session) {
      fetchLevelData();
    }
  }, [status, session, router]);

  const fetchLevelData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Definir um timeout para a requisição
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      // Fazer a requisição com timeout
      const response = await fetch('/api/user/level', {
        signal: controller.signal,
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' }
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        if (response.status === 401) {
          // Problema de autenticação
          throw new Error('Sessão expirada. Por favor, faça login novamente.');
        } else if (response.status === 404) {
          // Usuário não encontrado no banco de dados
          throw new Error('Dados de usuário não encontrados.');
        } else {
          // Outro erro do servidor
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || 'Falha ao carregar dados de nível');
        }
      }
      
      const data = await response.json();
      
      // Verificar se os dados são válidos e se o currentLevel existe
      if (!data.currentLevel) {
        console.warn('currentLevel não encontrado nos dados retornados:', data);
        
        // Se o usuário existir mas não tiver nível, pode ser um problema de inicialização
        if (data.user) {
          console.log('Tentando inicializar níveis de jogador...');
          
          try {
            // Tentar buscar ou criar dados de nível
            await populatePlayerLevels();
            
            // Tentar novamente depois de esperar um pouco
            setTimeout(() => fetchLevelData(), 2000);
          } catch (initError) {
            console.error('Erro ao inicializar níveis:', initError);
            throw new Error('Não foi possível carregar dados de nível. O sistema de níveis pode precisar ser inicializado.');
          }
          return;
        }
      }
      
      setLevelData(data);
    } catch (err: any) {
      console.error('Erro ao carregar dados de nível:', err);
      
      if (err.name === 'AbortError') {
        setError('A requisição demorou muito tempo. Por favor, tente novamente.');
      } else {
        setError(err.message || 'Não foi possível carregar seus dados de nível. Tente novamente mais tarde.');
      }
      
      // Criar dados mínimos para evitar mostrar mensagem de erro
      setLevelData({
        user: {
          id: session?.user?.id || 'temp-id',
          name: session?.user?.name || 'Usuário',
          level: 1,
          xp: 0,
          loyaltyPoints: 0,
          totalPlayed: 0,
          daysActive: 0,
          lastActive: new Date().toISOString()
        },
        currentLevel: {
          id: 'default-level',
          level: 1,
          name: 'Iniciante',
          requiredXP: 0,
          bonusMultiplier: 0,
          loyaltyMultiplier: 1,
          dailyBonus: 0,
          description: 'Nível inicial'
        },
        nextLevel: {
          id: 'next-level',
          level: 2,
          name: 'Amador',
          requiredXP: 1000,
          bonusMultiplier: 0.01,
          loyaltyMultiplier: 1.1,
          dailyBonus: 5,
          description: 'Próximo nível'
        },
        progress: 0,
        xpRequired: 1000,
        xpCurrent: 0,
        availableRewards: [],
        redeemedRewards: []
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Função para garantir que o sistema de níveis está inicializado
  const populatePlayerLevels = async () => {
    try {
      // Verificar se há níveis cadastrados
      const checkResponse = await fetch('/api/system/check-levels');
      const checkData = await checkResponse.json();
      
      if (!checkData.initialized) {
        console.log('Sistema de níveis não inicializado, tentando inicializar...');
        // Tentar inicializar o sistema de níveis
        const initResponse = await fetch('/api/system/init-levels');
        
        if (!initResponse.ok) {
          throw new Error('Não foi possível inicializar o sistema de níveis');
        }
        
        return true;
      }
      
      return checkData.initialized;
    } catch (error) {
      console.error('Erro ao verificar/inicializar níveis:', error);
      return false;
    }
  };

  const redeemReward = async (rewardId: string) => {
    try {
      setRedemptionStatus({
        loading: true,
        success: false,
        message: null,
        rewardId
      });
      
      console.log(`Iniciando resgate da recompensa ${rewardId}`);
      
      const response = await fetch('/api/user/rewards/redeem', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ rewardId })
      });
      
      const data = await response.json();
      console.log('Resposta do resgate:', data);
      
      if (!response.ok) {
        throw new Error(data.error || 'Falha ao resgatar recompensa');
      }
      
      // Verificar a transação gerada após o resgate
      await verifyRewardTransaction(data);
      
      // Atualizar os dados após resgate bem-sucedido
      refreshBalance();
      fetchLevelData();
      
      setRedemptionStatus({
        loading: false,
        success: true,
        message: data.message,
        rewardId: null
      });
      
      // Limpar mensagem após alguns segundos
      setTimeout(() => {
        setRedemptionStatus(prev => ({
          ...prev,
          message: null
        }));
      }, 5000);
    } catch (err: any) {
      console.error('Erro ao resgatar recompensa:', err);
      setRedemptionStatus({
        loading: false,
        success: false,
        message: err.message || 'Falha ao resgatar recompensa',
        rewardId: null
      });
    }
  };

  // Verificar se a transação relacionada foi criada
  const verifyRewardTransaction = async (redeemData: any) => {
    try {
      if (!redeemData.reward || !redeemData.updatedBalance) {
        console.log('Dados de recompensa incompletos:', redeemData);
        return;
      }
      
      // Aguardar um pouco para dar tempo da transação ser processada
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Buscar as transações recentes
      const response = await fetch('/api/transactions?limit=5');
      if (!response.ok) {
        console.warn('Não foi possível verificar transações recentes');
        return;
      }
      
      const transactions = await response.json();
      console.log('Transações recentes:', transactions);
      
      // Verificar se existe alguma transação relacionada à recompensa
      const rewardTransaction = transactions.find((tx: any) => {
        try {
          const details = JSON.parse(tx.details || '{}');
          return details.source === 'reward' && details.rewardId === redeemData.reward.id;
        } catch (e) {
          return false;
        }
      });
      
      if (rewardTransaction) {
        console.log('Transação de recompensa encontrada:', rewardTransaction);
      } else {
        console.warn('Transação de recompensa não encontrada nas transações recentes');
      }
    } catch (error) {
      console.error('Erro ao verificar transação:', error);
    }
  };

  // Renderizar badges para benefícios de nível
  const renderLevelBenefits = (level: any) => {
    if (!level) return null;
    
    return (
      <div className="flex flex-wrap gap-2 mt-3">
        {level.bonusMultiplier > 0 && (
          <div className="px-3 py-1 rounded-full bg-[#1a86c7] bg-opacity-20 border border-[#1a86c7] text-sm">
            +{(level.bonusMultiplier * 100).toFixed(0)}% Multiplicador
          </div>
        )}
        
        {level.loyaltyMultiplier > 1 && (
          <div className="px-3 py-1 rounded-full bg-[#3bc37a] bg-opacity-20 border border-[#3bc37a] text-sm">
            {level.loyaltyMultiplier.toFixed(1)}x Pontos
          </div>
        )}
        
        {level.dailyBonus > 0 && (
          <div className="px-3 py-1 rounded-full bg-[#d97706] bg-opacity-20 border border-[#d97706] text-sm">
            +{level.dailyBonus} Diário
          </div>
        )}
      </div>
    );
  };

  // Renderizar um ícone para o tipo de recompensa
  const getRewardTypeIcon = (type: string) => {
    switch (type) {
      case 'FREE_BET':
        return '🎮';
      case 'MULTIPLIER_BOOST':
        return '⚡';
      case 'CASH_BONUS':
        return '💰';
      case 'DAILY_LIMIT_BOOST':
        return '📈';
      default:
        return '🎁';
    }
  };

  // Formatar tipo de recompensa para exibição
  const formatRewardType = (type: string) => {
    switch (type) {
      case 'FREE_BET':
        return 'Aposta Grátis';
      case 'MULTIPLIER_BOOST':
        return 'Multiplicador';
      case 'CASH_BONUS':
        return 'Bônus em Dinheiro';
      case 'DAILY_LIMIT_BOOST':
        return 'Aumento de Limite';
      default:
        return type;
    }
  };
  
  // Formatar valor da recompensa para exibição
  const formatRewardValue = (type: string, value: number) => {
    switch (type) {
      case 'FREE_BET':
      case 'CASH_BONUS':
        return `R$ ${value.toFixed(2)}`;
      case 'MULTIPLIER_BOOST':
      case 'DAILY_LIMIT_BOOST':
        return `+${(value * 100).toFixed(0)}%`;
      default:
        return value.toString();
    }
  };

  // Renderizar data formatada
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-300 rounded w-1/4"></div>
          <div className="h-32 bg-gray-300 rounded"></div>
          <div className="h-64 bg-gray-300 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-12">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-red-500">
              <p>{error}</p>
              <div className="flex flex-col space-y-2 mt-4">
                <Button 
                  variant="outline"
                  onClick={() => fetchLevelData()}
                >
                  Tentar Novamente
                </Button>
                <Button 
                  variant="primary"
                  onClick={async () => {
                    try {
                      setError(null);
                      setIsLoading(true);
                      
                      // Tentar inicializar o sistema de níveis
                      await populatePlayerLevels();
                      
                      // Esperar um pouco e tentar novamente
                      setTimeout(() => fetchLevelData(), 1000);
                    } catch (err) {
                      setError('Falha ao inicializar sistema de níveis. Por favor, contate o suporte.');
                      setIsLoading(false);
                    }
                  }}
                >
                  Inicializar Sistema de Níveis
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!levelData) {
    return (
      <div className="container mx-auto px-4 py-12">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p>Não foi possível carregar seus dados de nível.</p>
              <div className="flex flex-col space-y-2 mt-4">
                <Button 
                  variant="outline"
                  onClick={() => fetchLevelData()}
                >
                  Tentar Novamente
                </Button>
                <Button 
                  variant="primary"
                  onClick={async () => {
                    try {
                      setIsLoading(true);
                      
                      // Tentar inicializar o sistema de níveis
                      await populatePlayerLevels();
                      
                      // Esperar um pouco e tentar novamente
                      setTimeout(() => fetchLevelData(), 1000);
                    } catch (err) {
                      setError('Falha ao inicializar sistema de níveis. Por favor, contate o suporte.');
                      setIsLoading(false);
                    }
                  }}
                >
                  Inicializar Sistema de Níveis
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { user, currentLevel, nextLevel, progress, xpRequired, xpCurrent, availableRewards, redeemedRewards } = levelData;

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Seu Nível e Recompensas</h1>
      
      {/* Card do Nível */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>
            Nível {user?.level || '?'}: {currentLevel?.name || 'Carregando...'}
          </CardTitle>
          <CardDescription>
            XP: {user?.xp || 0} pontos • Jogou: {user?.totalPlayed || 0} rodadas • Ativo por: {user?.daysActive || 0} dias
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-6">
            {/* Informações do nível atual */}
            <div className="flex-1">
              <div className="p-4 bg-[#1e1e1e] rounded-lg">
                <div className="flex items-center gap-4">
                  {currentLevel?.icon && (
                    <div className="w-16 h-16 rounded-full bg-[#2a2a2a] flex items-center justify-center overflow-hidden">
                      <img 
                        src={currentLevel?.icon || '/images/levels/default.png'} 
                        alt={`Nível ${currentLevel?.level || '?'}`} 
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                          const parent = (e.target as HTMLElement).parentElement;
                          if (parent) {
                            parent.innerHTML = '👤';
                          }
                        }}
                      />
                    </div>
                  )}
                  <div>
                    <h3 className="text-xl font-semibold">{currentLevel?.name}</h3>
                    <p className="text-sm text-gray-400">{currentLevel?.description}</p>
                  </div>
                </div>
                
                {renderLevelBenefits(currentLevel)}
              </div>
            </div>
            
            {/* Progresso para o próximo nível */}
            <div className="flex-1">
              {nextLevel ? (
                <div className="p-4 bg-[#1e1e1e] rounded-lg">
                  <div className="mb-4">
                    <div className="flex justify-between mb-2">
                      <span className="text-sm">Progresso para Nível {nextLevel?.level || 'próximo'}</span>
                      <span className="text-sm font-medium">{progress}%</span>
                    </div>
                    <Progress value={progress} className="h-2" />
                    <div className="flex justify-between mt-1">
                      <span className="text-xs text-gray-400">{xpCurrent} / {xpRequired} XP</span>
                      <span className="text-xs text-gray-400">Faltam: {xpRequired - xpCurrent} XP</span>
                    </div>
                  </div>
                  
                  <div className="mt-4">
                    <h4 className="text-sm font-medium mb-2">Próximo Nível: {nextLevel?.name || 'Carregando...'}</h4>
                    <p className="text-xs text-gray-400 mb-2">{nextLevel?.description || ''}</p>
                    
                    {renderLevelBenefits(nextLevel)}
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-[#1e1e1e] rounded-lg flex items-center justify-center h-full">
                  <div className="text-center">
                    <h3 className="text-xl font-semibold mb-2">Nível Máximo Atingido!</h3>
                    <p className="text-sm text-gray-400">
                      Parabéns! Você alcançou o nível máximo.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Pontos de Fidelidade */}
      <div className="mb-6 p-4 bg-gradient-to-r from-[#1a86c7] to-[#3bc37a] rounded-lg text-white">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div>
            <h2 className="text-xl font-bold">Seus Pontos de Fidelidade</h2>
            <p className="text-sm opacity-90">Use seus pontos para resgatar recompensas especiais</p>
          </div>
          <div className="text-3xl font-bold mt-2 md:mt-0">
            {user?.loyaltyPoints || 0} pontos
          </div>
        </div>
      </div>
      
      {/* Recompensas Disponíveis */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Recompensas Disponíveis</CardTitle>
          <CardDescription>Use seus pontos para resgatar estas recompensas</CardDescription>
        </CardHeader>
        <CardContent>
          {availableRewards.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {availableRewards.map((reward) => (
                <div 
                  key={reward.id} 
                  className={`p-4 border rounded-lg ${
                    user?.loyaltyPoints >= reward.pointsCost
                      ? 'border-[#3bc37a] bg-[#3bc37a] bg-opacity-5'
                      : 'border-gray-700 bg-[#1e1e1e]'
                  }`}
                >
                  <div className="flex gap-3 items-start mb-2">
                    <div className="w-10 h-10 flex items-center justify-center rounded-full bg-[#2a2a2a] text-xl">
                      {reward.icon ? (
                        <img 
                          src={reward.icon} 
                          alt={reward.name}
                          className="w-full h-full object-cover rounded-full"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                            const parent = (e.target as HTMLElement).parentElement;
                            if (parent) {
                              parent.innerHTML = '👤';
                            }
                          }}
                        />
                      ) : getRewardTypeIcon(reward.type)}
                    </div>
                    <div>
                      <h3 className="font-medium">{reward.name}</h3>
                      <p className="text-xs text-gray-400">{formatRewardType(reward.type)}: {formatRewardValue(reward.type, reward.value)}</p>
                    </div>
                  </div>
                  
                  <p className="text-sm text-gray-300 mb-4">{reward.description}</p>
                  
                  <div className="flex justify-between items-center">
                    <div className="text-sm font-medium">
                      {reward.pointsCost} pontos
                    </div>
                    <Button
                      variant={user?.loyaltyPoints >= reward.pointsCost ? "primary" : "secondary"}
                      size="sm"
                      disabled={
                        user?.loyaltyPoints < reward.pointsCost || 
                        redemptionStatus.loading ||
                        redemptionStatus.rewardId === reward.id
                      }
                      onClick={() => redeemReward(reward.id)}
                    >
                      {redemptionStatus.loading && redemptionStatus.rewardId === reward.id
                        ? 'Resgatando...'
                        : 'Resgatar'}
                    </Button>
                  </div>
                  
                  {user?.loyaltyPoints < reward.pointsCost && (
                    <div className="mt-2 text-xs text-gray-400">
                      Você precisa de mais {reward.pointsCost - user?.loyaltyPoints} pontos
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-400">Nenhuma recompensa disponível para seu nível atual.</p>
              <p className="text-sm text-gray-500 mt-2">Continue jogando para subir de nível e desbloquear recompensas!</p>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Mensagem de Status da Redenção */}
      {redemptionStatus.message && (
        <div className={`p-4 rounded-lg mb-6 ${
          redemptionStatus.success ? 'bg-green-900 bg-opacity-20 border border-green-700' : 'bg-red-900 bg-opacity-20 border border-red-700'
        }`}>
          <p className={redemptionStatus.success ? 'text-green-400' : 'text-red-400'}>
            {redemptionStatus.message}
          </p>
        </div>
      )}
      
      {/* Histórico de Recompensas Resgatadas */}
      {redeemedRewards.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Histórico de Resgates</CardTitle>
            <CardDescription>Recompensas que você já resgatou</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[400px]">
                <thead>
                  <tr className="border-b border-gray-800">
                    <th className="text-left py-2 px-4">Recompensa</th>
                    <th className="text-left py-2 px-4">Tipo</th>
                    <th className="text-left py-2 px-4">Valor</th>
                    <th className="text-left py-2 px-4">Data</th>
                  </tr>
                </thead>
                <tbody>
                  {redeemedRewards.map((reward) => (
                    <tr key={reward.id} className="border-b border-gray-800">
                      <td className="py-2 px-4">{reward.name}</td>
                      <td className="py-2 px-4">{formatRewardType(reward.type)}</td>
                      <td className="py-2 px-4">{formatRewardValue(reward.type, reward.value)}</td>
                      <td className="py-2 px-4">{formatDate(reward.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
} 