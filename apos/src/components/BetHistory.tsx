'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/Tabs';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

type BetHistoryProps = {
  userId: string;
};

type Bet = {
  id: string;
  amount: number;
  type: 'ABOVE' | 'BELOW';
  result: number;
  won: boolean;
  profit: number;
  timestamp: string;
  roundId: string;
};

type BetStats = {
  totalBets: number;
  totalWagered: number;
  totalWon: number;
  totalLost: number;
  netProfit: number;
  winRate: number;
  averageBetSize: number;
  biggestWin: number;
  biggestLoss: number;
  streakWin: number;
  streakLoss: number;
  betsByType: { ABOVE: number; BELOW: number };
};

type PieChartDataItem = {
  name: string;
  value: number;
};

interface PieChartCustomLabelProps {
  name: string;
  percent: number;
}

const COLORS = ['#3bc37a', '#1a86c7', '#f59e0b', '#ef4444'];

const BetHistory: React.FC<BetHistoryProps> = ({ userId }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [bets, setBets] = useState<Bet[]>([]);
  const [stats, setStats] = useState<BetStats>({
    totalBets: 0,
    totalWagered: 0,
    totalWon: 0,
    totalLost: 0,
    netProfit: 0,
    winRate: 0,
    averageBetSize: 0,
    biggestWin: 0,
    biggestLoss: 0,
    streakWin: 0,
    streakLoss: 0,
    betsByType: { ABOVE: 0, BELOW: 0 },
  });
  const [period, setPeriod] = useState<'day' | 'week' | 'month' | 'all'>('day');
  const [activeTab, setActiveTab] = useState('resumo');
  const [dataInitialized, setDataInitialized] = useState(false);

  // Carregar apostas do usuário com otimização de carga
  useEffect(() => {
    if (!userId) return;
    
    if (!dataInitialized) {
      // Em primeiro carregamento, adiar um pouco para não competir com recursos do jogo
      setTimeout(() => {
        fetchBets();
        setDataInitialized(true);
      }, 2000); // Atrasar a carga inicial em 2 segundos
    } else {
      fetchBets();
    }
  }, [userId, period, dataInitialized]);

  const fetchBets = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/user/bets?period=${period}`);
      if (response.ok) {
        const data = await response.json();
        setBets(data.bets);
        calculateStats(data.bets);
      }
    } catch (error) {
      console.error('Erro ao carregar histórico de apostas:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Calcular estatísticas com base nas apostas
  const calculateStats = (betData: Bet[]) => {
    if (!betData.length) return;

    let totalWagered = 0;
    let totalWon = 0;
    let totalLost = 0;
    let wins = 0;
    let biggestWin = 0;
    let biggestLoss = 0;
    let currentWinStreak = 0;
    let currentLossStreak = 0;
    let maxWinStreak = 0;
    let maxLossStreak = 0;
    const betsByType = { ABOVE: 0, BELOW: 0 };

    betData.forEach((bet) => {
      totalWagered += bet.amount;
      betsByType[bet.type]++;

      if (bet.won) {
        wins++;
        totalWon += bet.profit;
        biggestWin = Math.max(biggestWin, bet.profit);
        currentWinStreak++;
        currentLossStreak = 0;
        maxWinStreak = Math.max(maxWinStreak, currentWinStreak);
      } else {
        totalLost += bet.amount;
        biggestLoss = Math.max(biggestLoss, bet.amount);
        currentLossStreak++;
        currentWinStreak = 0;
        maxLossStreak = Math.max(maxLossStreak, currentLossStreak);
      }
    });

    const netProfit = totalWon - totalLost;
    const winRate = (wins / betData.length) * 100;
    const averageBetSize = totalWagered / betData.length;

    setStats({
      totalBets: betData.length,
      totalWagered,
      totalWon,
      totalLost,
      netProfit,
      winRate,
      averageBetSize,
      biggestWin,
      biggestLoss,
      streakWin: maxWinStreak,
      streakLoss: maxLossStreak,
      betsByType,
    });
  };

  // Preparar dados para o gráfico de lucro/prejuízo
  const prepareProfitChartData = () => {
    if (!bets.length) return [];

    // Ordenar por data/hora
    const sortedBets = [...bets].sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    // Calcular lucro acumulado
    let cumulativeProfit = 0;
    return sortedBets.map((bet, index) => {
      cumulativeProfit += bet.won ? bet.profit : -bet.amount;
      return {
        index: index + 1,
        profit: cumulativeProfit.toFixed(2),
        betAmount: bet.amount,
        won: bet.won,
        timestamp: new Date(bet.timestamp).toLocaleString(),
      };
    });
  };

  // Preparar dados para o gráfico de distribuição de apostas
  const prepareBetDistributionData = (): PieChartDataItem[] => {
    return [
      { name: 'Acima', value: stats.betsByType.ABOVE },
      { name: 'Abaixo', value: stats.betsByType.BELOW },
    ];
  };

  // Preparar dados para o gráfico de resultados
  const prepareResultsData = (): PieChartDataItem[] => {
    return [
      { name: 'Vitórias', value: stats.totalBets > 0 ? parseFloat((stats.winRate).toFixed(1)) : 0 },
      { name: 'Derrotas', value: stats.totalBets > 0 ? parseFloat((100 - stats.winRate).toFixed(1)) : 0 },
    ];
  };

  // Agrupar apostas por dia para gráfico de barras
  const prepareDailyBetsData = () => {
    if (!bets.length) return [];

    const betsByDay: { [key: string]: { date: string; bets: number; won: number; lost: number } } = {};

    bets.forEach(bet => {
      const date = new Date(bet.timestamp).toLocaleDateString();
      
      if (!betsByDay[date]) {
        betsByDay[date] = {
          date,
          bets: 0,
          won: 0,
          lost: 0
        };
      }
      
      betsByDay[date].bets++;
      if (bet.won) {
        betsByDay[date].won++;
      } else {
        betsByDay[date].lost++;
      }
    });

    return Object.values(betsByDay);
  };

  // Formatar valor para exibição
  const formatCurrency = (value: number) => {
    return `R$ ${value.toFixed(2)}`;
  };

  // Formato para tooltip
  const formatTooltipValue = (value: string) => {
    return [`R$ ${value}`, 'Lucro'];
  };

  // Formato para tooltip do gráfico pie
  const formatPieTooltipValue = (value: number) => {
    return [`${value}%`, 'Porcentagem'];
  };

  // Label customizado para os gráficos de pizza
  const renderCustomizedPieLabel = ({ name, percent }: PieChartCustomLabelProps) => {
    return `${name}: ${(percent * 100).toFixed(1)}%`;
  };

  // Otimizar renders condicionais para gráficos pesados
  const renderGraphs = () => {
    if (activeTab !== 'graficos') return null;
    
    return (
      <div className="space-y-8">
        <div>
          <h3 className="text-lg font-medium mb-3">Lucro ao Longo do Tempo</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={prepareProfitChartData()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="index" label={{ value: 'Aposta', position: 'insideBottomRight', offset: 0 }} />
                <YAxis label={{ value: 'Lucro (R$)', angle: -90, position: 'insideLeft' }} />
                <Tooltip
                  formatter={formatTooltipValue}
                  labelFormatter={(index) => `Aposta ${index}`}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="profit"
                  stroke="#3bc37a"
                  activeDot={{ r: 8 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-lg font-medium mb-3">Apostas por Dia</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={prepareDailyBetsData()}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="won" name="Vitórias" fill="#3bc37a" />
                  <Bar dataKey="lost" name="Derrotas" fill="#ef4444" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-medium mb-3">Distribuição de Apostas</h3>
            <div className="h-72 flex justify-center items-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={prepareResultsData()}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={renderCustomizedPieLabel}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {prepareResultsData().map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index === 0 ? '#3bc37a' : '#ef4444'} />
                    ))}
                  </Pie>
                  <Tooltip formatter={formatPieTooltipValue} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-medium mb-3">Tipo de Apostas</h3>
            <div className="h-72 flex justify-center items-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={prepareBetDistributionData()}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={renderCustomizedPieLabel}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {prepareBetDistributionData().map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [`${value} apostas`, 'Quantidade']} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Otimizar renders condicionais para listagem de apostas
  const renderBetsList = () => {
    if (activeTab !== 'apostas') return null;
    
    return (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b dark:border-gray-700">
              <th className="py-2 px-4 text-left">Data/Hora</th>
              <th className="py-2 px-4 text-left">Valor</th>
              <th className="py-2 px-4 text-left">Tipo</th>
              <th className="py-2 px-4 text-left">Resultado</th>
              <th className="py-2 px-4 text-left">Lucro</th>
            </tr>
          </thead>
          <tbody>
            {bets.map((bet) => (
              <tr key={bet.id} className="border-b dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800">
                <td className="py-2 px-4 text-sm">
                  {new Date(bet.timestamp).toLocaleString()}
                </td>
                <td className="py-2 px-4">{formatCurrency(bet.amount)}</td>
                <td className="py-2 px-4">
                  <span className={bet.type === 'ABOVE' ? 'text-[#3bc37a]' : 'text-[#1a86c7]'}>
                    {bet.type === 'ABOVE' ? 'ACIMA' : 'ABAIXO'}
                  </span>
                </td>
                <td className="py-2 px-4">
                  <span className={bet.won ? 'text-[#3bc37a]' : 'text-red-500'}>
                    {bet.won ? 'Vitória' : 'Derrota'}
                  </span>
                </td>
                <td className="py-2 px-4">
                  <span className={bet.won ? 'text-[#3bc37a]' : 'text-red-500'}>
                    {bet.won 
                      ? formatCurrency(bet.profit) 
                      : `-${formatCurrency(bet.amount)}`}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // Renderizar componente
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Histórico e Análise de Apostas</CardTitle>
        <CardDescription>Estatísticas detalhadas de suas apostas</CardDescription>
        
        <div className="flex space-x-2 mt-2">
          <Button 
            variant={period === 'day' ? 'primary' : 'outline'} 
            onClick={() => setPeriod('day')}
            className="text-xs px-2 py-1"
          >
            Hoje
          </Button>
          <Button 
            variant={period === 'week' ? 'primary' : 'outline'} 
            onClick={() => setPeriod('week')}
            className="text-xs px-2 py-1"
          >
            Semana
          </Button>
          <Button 
            variant={period === 'month' ? 'primary' : 'outline'} 
            onClick={() => setPeriod('month')}
            className="text-xs px-2 py-1"
          >
            Mês
          </Button>
          <Button 
            variant={period === 'all' ? 'primary' : 'outline'} 
            onClick={() => setPeriod('all')}
            className="text-xs px-2 py-1"
          >
            Tudo
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="flex justify-center items-center h-60">
            <div className="animate-pulse">Carregando estatísticas...</div>
          </div>
        ) : bets.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            Nenhuma aposta encontrada para o período selecionado.
          </div>
        ) : (
          <Tabs defaultValue="resumo" value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-6">
              <TabsTrigger value="resumo">Resumo</TabsTrigger>
              <TabsTrigger value="graficos">Gráficos</TabsTrigger>
              <TabsTrigger value="apostas">Apostas</TabsTrigger>
            </TabsList>

            <TabsContent value="resumo">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded-lg">
                  <div className="text-sm text-gray-500 dark:text-gray-400">Total Apostado</div>
                  <div className="font-bold text-lg">{formatCurrency(stats.totalWagered)}</div>
                </div>
                <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded-lg">
                  <div className="text-sm text-gray-500 dark:text-gray-400">Lucro Líquido</div>
                  <div className={`font-bold text-lg ${stats.netProfit >= 0 ? 'text-[#3bc37a]' : 'text-red-500'}`}>
                    {formatCurrency(stats.netProfit)}
                  </div>
                </div>
                <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded-lg">
                  <div className="text-sm text-gray-500 dark:text-gray-400">Taxa de Vitória</div>
                  <div className="font-bold text-lg">{stats.winRate.toFixed(1)}%</div>
                </div>
                <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded-lg">
                  <div className="text-sm text-gray-500 dark:text-gray-400">Total de Apostas</div>
                  <div className="font-bold text-lg">{stats.totalBets}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <h3 className="text-lg font-medium mb-3">Desempenho</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Maior vitória</span>
                      <span className="font-medium text-[#3bc37a]">{formatCurrency(stats.biggestWin)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Maior perda</span>
                      <span className="font-medium text-red-500">{formatCurrency(stats.biggestLoss)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Total ganho</span>
                      <span className="font-medium text-[#3bc37a]">{formatCurrency(stats.totalWon)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Total perdido</span>
                      <span className="font-medium text-red-500">{formatCurrency(stats.totalLost)}</span>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h3 className="text-lg font-medium mb-3">Sequências e Médias</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Média por aposta</span>
                      <span className="font-medium">{formatCurrency(stats.averageBetSize)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Sequência de vitórias</span>
                      <span className="font-medium">{stats.streakWin}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Sequência de derrotas</span>
                      <span className="font-medium">{stats.streakLoss}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Preferência</span>
                      <span className="font-medium">
                        {stats.betsByType.ABOVE > stats.betsByType.BELOW 
                          ? 'ACIMA' 
                          : stats.betsByType.BELOW > stats.betsByType.ABOVE 
                            ? 'ABAIXO' 
                            : 'Equilibrado'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="graficos">
              {renderGraphs()}
            </TabsContent>

            <TabsContent value="apostas">
              {renderBetsList()}
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
};

export default BetHistory; 