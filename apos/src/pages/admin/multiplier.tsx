import React, { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Link from 'next/link';

interface MultiplierConfig {
  profitMargin: number;         // Margem de lucro da casa (%)
  initialMultiplier: number;    // Multiplicador inicial
  maxMultiplier: number;        // Multiplicador máximo
  minMultiplier: number;        // Multiplicador mínimo
  bettingPhaseDuration: number; // Duração da fase de apostas (ms)
  roundDuration: number;        // Duração da rodada (ms)
  aboveOneProbability: number;  // Probabilidade de resultado acima de 1.0 (0-1)
  volatility: number;           // Volatilidade (0-1)
  crashProbability: number;     // Probabilidade de quebra (0-1)
  trendStrength: number;        // Força das tendências (0-1)
  balance?: number;             // Saldo da casa
  gameType?: string;            // Tipo do jogo
}

// Dados para estatísticas do jogo
interface GameStats {
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

export default function MultiplierAdmin() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  // Estados para configurações e estatísticas
  const [config, setConfig] = useState<MultiplierConfig>({
    profitMargin: 5,
    initialMultiplier: 1.0,
    maxMultiplier: 2.0,
    minMultiplier: 0.0,
    bettingPhaseDuration: 5000,
    roundDuration: 20000,
    aboveOneProbability: 0.3,
    volatility: 0.75,
    crashProbability: 0.25,
    trendStrength: 0.7,
    balance: 100000
  });
  
  // Estados para estatísticas
  const [stats, setStats] = useState<GameStats>({
    totalMultiplierBets: 0,
    totalMultiplierAmount: 0,
    totalMultiplierPayout: 0,
    recentRounds: []
  });
  
  // Estados para UI
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  
  // Verificar autenticação
  useEffect(() => {
    if (status === 'loading') return;
    
    if (!session || session.user.role !== 'ADMIN') {
      router.push('/');
      return;
    }
    
    // Carregar configurações iniciais
    fetchConfig();
    fetchStats();
  }, [session, status]);
  
  // Buscar configurações
  const fetchConfig = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/multiplier-config');
      
      if (response.ok) {
        const data = await response.json();
        setConfig(data);
      } else {
        setErrorMessage('Erro ao carregar configurações');
      }
    } catch (error) {
      console.error('Erro ao buscar configurações:', error);
      setErrorMessage('Erro ao carregar configurações');
    } finally {
      setLoading(false);
    }
  };
  
  // Buscar estatísticas
  const fetchStats = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/stats?game=multiplicador');
      
      if (response.ok) {
        const data = await response.json();
        setStats({
          totalMultiplierBets: data.totalMultiplierBets || 0,
          totalMultiplierAmount: data.totalMultiplierAmount || 0,
          totalMultiplierPayout: data.totalMultiplierPayout || 0,
          recentRounds: data.recentRounds || []
        });
        
        // Atualizar saldo da casa se disponível
        if (data.houseBalance) {
          setConfig(prev => ({
            ...prev,
            balance: data.houseBalance
          }));
        }
      } else {
        setErrorMessage('Erro ao carregar estatísticas');
      }
    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error);
      setErrorMessage('Erro ao carregar estatísticas');
    } finally {
      setLoading(false);
    }
  };
  
  // Salvar configurações
  const saveConfig = async () => {
    try {
      setLoading(true);
      setSuccessMessage('');
      setErrorMessage('');
      
      const response = await fetch('/api/admin/multiplier-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      });
      
      if (response.ok) {
        const data = await response.json();
        setSuccessMessage(data.message || 'Configurações salvas com sucesso!');
        
        // Recarregar configurações e estatísticas
        fetchConfig();
        fetchStats();
      } else {
        const error = await response.json();
        setErrorMessage(error.message || 'Erro ao salvar configurações');
      }
    } catch (error) {
      console.error('Erro ao salvar configurações:', error);
      setErrorMessage('Erro ao salvar configurações');
    } finally {
      setLoading(false);
    }
  };
  
  // Atualizar valor de configuração
  const updateConfig = (key: keyof MultiplierConfig, value: any) => {
    setConfig(prev => ({
      ...prev,
      [key]: value
    }));
  };
  
  // Renderizar interface
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
          <h1 className="text-3xl font-bold bg-gradient-to-r from-[#1a86c7] to-[#3bc37a] bg-clip-text text-transparent">Administração do Jogo Multiplicador</h1>
          <div className="flex space-x-4">
            <Link href="/admin" legacyBehavior>
              <a className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded text-white">
                Voltar ao Painel
              </a>
            </Link>
            <span className="text-sm self-center">
              Logado como: <span className="text-[#3bc37a]">{session?.user?.email}</span>
            </span>
          </div>
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
        
        <div className="grid grid-cols-1 gap-6 mb-8">
          {/* Configurações Financeiras */}
          <div className="bg-gray-800 p-6 rounded-lg">
            <h2 className="flex items-center text-xl font-medium text-green-400 mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" />
              </svg>
              Configurações Financeiras
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Configuração de Lucro da Casa */}
              <div className="bg-gray-900 p-4 rounded-lg">
                <p className="text-gray-400 text-sm mb-2">Margem de Lucro da Casa</p>
                <div className="mb-3">
                  <div className="flex justify-between mb-1">
                    <label htmlFor="profitMargin" className="text-sm font-medium text-gray-400">
                      Margem (%)
                    </label>
                    <span className="text-sm text-white">{config.profitMargin}%</span>
                  </div>
                  <input
                    type="range"
                    id="profitMargin"
                    value={config.profitMargin}
                    onChange={(e) => updateConfig('profitMargin', Number(e.target.value))}
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
                <p className="text-xs text-gray-500 mt-1">
                  Define a vantagem matemática da casa. Uma margem de 5% significa que, a longo prazo, 
                  a casa terá um lucro de 5% sobre o valor total apostado.
                </p>
              </div>
              
              {/* Saldo da Casa */}
              <div className="bg-gray-900 p-4 rounded-lg">
                <p className="text-gray-400 text-sm mb-2">Saldo da Casa</p>
                <p className="text-3xl font-bold text-green-400">
                  R$ {config.balance?.toFixed(2) || '100,000.00'}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Saldo disponível para pagamento de prêmios. Este valor é atualizado 
                  automaticamente conforme os jogadores ganham ou perdem.
                </p>
                <button
                  onClick={fetchStats}
                  disabled={loading}
                  className="w-full mt-4 px-4 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-600 disabled:opacity-50 transition-colors"
                >
                  Atualizar Estatísticas
                </button>
              </div>
            </div>
          </div>
          
          {/* Configurações de Distribuição de Resultados */}
          <div className="bg-gray-800 p-6 rounded-lg">
            <h2 className="flex items-center text-xl font-medium text-yellow-400 mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
              </svg>
              Configurações de Distribuição de Resultados
            </h2>
            
            <div className="mb-4 p-4 bg-gray-900 rounded-lg">
              <p className="text-sm text-gray-300 mb-4">
                Estas configurações controlam a distribuição estatística dos resultados do jogo, 
                definindo a probabilidade de valores acima ou abaixo de 1.0x e a dinâmica do jogo.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Probabilidade de Valores Acima de 1.0 */}
                <div>
                  <div className="mb-4">
                    <div className="flex justify-between mb-1">
                      <label htmlFor="aboveOneProbability" className="text-sm font-medium text-gray-400">
                        Probabilidade de Valor > 1.0
                      </label>
                      <span className="text-sm text-white">
                        {Math.round(config.aboveOneProbability * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      id="aboveOneProbability"
                      value={config.aboveOneProbability * 100}
                      onChange={(e) => updateConfig('aboveOneProbability', Number(e.target.value) / 100)}
                      min="10"
                      max="50"
                      step="1"
                      className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                    <div className="flex justify-between mt-1 text-xs text-gray-500">
                      <span>10%</span>
                      <span>Recomendado: 20-30%</span>
                      <span>50%</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Controla a probabilidade de resultados acima de 1.0x (jogador ganha). Valores mais baixos 
                      resultam em maior lucro para a casa, mas podem tornar o jogo menos atrativo.
                    </p>
                  </div>
                  
                  {/* Volatilidade */}
                  <div className="mb-4">
                    <div className="flex justify-between mb-1">
                      <label htmlFor="volatility" className="text-sm font-medium text-gray-400">
                        Volatilidade
                      </label>
                      <span className="text-sm text-white">
                        {Math.round(config.volatility * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      id="volatility"
                      value={config.volatility * 100}
                      onChange={(e) => updateConfig('volatility', Number(e.target.value) / 100)}
                      min="20"
                      max="100"
                      step="1"
                      className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                    />
                    <div className="flex justify-between mt-1 text-xs text-gray-500">
                      <span>Estável</span>
                      <span>Recomendado: 70-80%</span>
                      <span>Caótico</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Determina o quão drásticas são as mudanças no multiplicador durante a rodada. 
                      Maior volatilidade cria uma experiência mais emocionante, mas menos previsível.
                    </p>
                  </div>
                </div>
                
                {/* Probabilidade de Quebra e Força das Tendências */}
                <div>
                  <div className="mb-4">
                    <div className="flex justify-between mb-1">
                      <label htmlFor="crashProbability" className="text-sm font-medium text-gray-400">
                        Probabilidade de Quebra
                      </label>
                      <span className="text-sm text-white">
                        {Math.round(config.crashProbability * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      id="crashProbability"
                      value={config.crashProbability * 100}
                      onChange={(e) => updateConfig('crashProbability', Number(e.target.value) / 100)}
                      min="5"
                      max="40"
                      step="1"
                      className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-red-500"
                    />
                    <div className="flex justify-between mt-1 text-xs text-gray-500">
                      <span>Raro</span>
                      <span>Recomendado: 20-30%</span>
                      <span>Frequente</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Define a chance de quedas rápidas e drásticas no multiplicador durante a rodada.
                      Quebras frequentes criam momentos de tensão e forçam decisões rápidas dos jogadores.
                    </p>
                  </div>
                  
                  {/* Força das Tendências */}
                  <div className="mb-4">
                    <div className="flex justify-between mb-1">
                      <label htmlFor="trendStrength" className="text-sm font-medium text-gray-400">
                        Força das Tendências
                      </label>
                      <span className="text-sm text-white">
                        {Math.round(config.trendStrength * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      id="trendStrength"
                      value={config.trendStrength * 100}
                      onChange={(e) => updateConfig('trendStrength', Number(e.target.value) / 100)}
                      min="30"
                      max="100"
                      step="1"
                      className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-500"
                    />
                    <div className="flex justify-between mt-1 text-xs text-gray-500">
                      <span>Suave</span>
                      <span>Recomendado: 65-80%</span>
                      <span>Forte</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Controla a força das tendências de alta e baixa no multiplicador. 
                      Tendências fortes resultam em movimentos mais consistentes e direcionais.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Configurações de Tempo */}
          <div className="bg-gray-800 p-6 rounded-lg">
            <h2 className="flex items-center text-xl font-medium text-blue-400 mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
              </svg>
              Configurações de Tempo
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-gray-900 rounded-lg">
              {/* Duração da Fase de Apostas */}
              <div>
                <div className="mb-3">
                  <div className="flex justify-between mb-1">
                    <label htmlFor="bettingPhaseDuration" className="text-sm font-medium text-gray-400">
                      Fase de Apostas
                    </label>
                    <span className="text-sm text-white">
                      {(config.bettingPhaseDuration / 1000).toFixed(1)}s
                    </span>
                  </div>
                  <input
                    type="range"
                    id="bettingPhaseDuration"
                    value={config.bettingPhaseDuration / 1000}
                    onChange={(e) => updateConfig('bettingPhaseDuration', Number(e.target.value) * 1000)}
                    min="3"
                    max="15"
                    step="0.5"
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                  <div className="flex justify-between mt-1 text-xs text-gray-500">
                    <span>3s</span>
                    <span>Padrão: 5s</span>
                    <span>15s</span>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Define quanto tempo os jogadores têm para fazer suas apostas antes do início da rodada.
                  Durações mais curtas aumentam o ritmo do jogo.
                </p>
              </div>
              
              {/* Duração da Rodada */}
              <div>
                <div className="mb-3">
                  <div className="flex justify-between mb-1">
                    <label htmlFor="roundDuration" className="text-sm font-medium text-gray-400">
                      Duração da Rodada
                    </label>
                    <span className="text-sm text-white">
                      {(config.roundDuration / 1000).toFixed(1)}s
                    </span>
                  </div>
                  <input
                    type="range"
                    id="roundDuration"
                    value={config.roundDuration / 1000}
                    onChange={(e) => updateConfig('roundDuration', Number(e.target.value) * 1000)}
                    min="5"
                    max="30"
                    step="0.5"
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                  <div className="flex justify-between mt-1 text-xs text-gray-500">
                    <span>5s</span>
                    <span>Padrão: 20s</span>
                    <span>30s</span>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Determina quanto tempo dura a fase de multiplicador ativo, durante a qual os jogadores
                  podem fazer cash-out. Durações mais longas permitem maior suspense e estratégia.
                </p>
              </div>
            </div>
          </div>
          
          {/* Estatísticas e Salvar */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Estatísticas */}
            <div className="md:col-span-2 bg-gray-800 p-6 rounded-lg">
              <h2 className="flex items-center text-xl font-medium text-purple-400 mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M2 10a8 8 0 018-8v8h8a8 8 0 11-16 0z" />
                  <path d="M12 2.252A8.014 8.014 0 0117.748 8H12V2.252z" />
                </svg>
                Estatísticas do Jogo
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="bg-gray-900 p-3 rounded-lg">
                  <p className="text-gray-400 text-sm">Total de Apostas</p>
                  <p className="text-2xl font-bold text-white">{stats.totalMultiplierBets || 0}</p>
                  <p className="text-xs text-gray-500 mt-1">Número total de apostas realizadas</p>
                </div>
                
                <div className="bg-gray-900 p-3 rounded-lg">
                  <p className="text-gray-400 text-sm">Valor Total Apostado</p>
                  <p className="text-2xl font-bold text-white">
                    R$ {stats.totalMultiplierAmount?.toFixed(2) || '0.00'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Soma de todas as apostas</p>
                </div>
                
                <div className="bg-gray-900 p-3 rounded-lg">
                  <p className="text-gray-400 text-sm">Total de Pagamentos</p>
                  <p className="text-2xl font-bold text-white">
                    R$ {stats.totalMultiplierPayout?.toFixed(2) || '0.00'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Soma de todos os prêmios pagos</p>
                </div>
              </div>
              
              <div className="bg-gray-900 p-4 rounded-lg">
                <h3 className="text-md font-medium text-white mb-3">Últimas Rodadas</h3>
                
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-700">
                        <th className="px-4 py-2 text-left text-sm text-gray-400">Horário</th>
                        <th className="px-4 py-2 text-center text-sm text-gray-400">Multiplicador</th>
                        <th className="px-4 py-2 text-right text-sm text-gray-400">Apostas</th>
                        <th className="px-4 py-2 text-center text-sm text-gray-400">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.recentRounds && stats.recentRounds.map((round, index) => (
                        <tr key={round.id} className="border-b border-gray-700 hover:bg-gray-700">
                          <td className="px-4 py-2 text-sm">
                            {new Date(round.endTime || round.startTime).toLocaleString()}
                          </td>
                          <td className="px-4 py-2 text-sm text-center">
                            <span className={`font-medium ${
                              round.result && round.result >= 1.5 ? 'text-green-500' :
                              round.result && round.result >= 1.0 ? 'text-blue-400' :
                              round.result && round.result > 0 ? 'text-red-500' : 'text-gray-400'
                            }`}>
                              {round.result ? round.result.toFixed(2) + 'x' : 'N/A'}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-sm text-right">
                            {round.totalBets || 0}
                          </td>
                          <td className="px-4 py-2 text-sm text-center">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
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
                      
                      {(!stats.recentRounds || stats.recentRounds.length === 0) && (
                        <tr>
                          <td colSpan={4} className="px-4 py-4 text-center text-gray-500">
                            Nenhuma rodada recente encontrada
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            
            {/* Salvar Configurações */}
            <div className="bg-gray-800 p-6 rounded-lg">
              <h2 className="flex items-center text-xl font-medium text-green-400 mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Aplicar Configurações
              </h2>
              
              <div className="bg-gray-900 p-4 rounded-lg mb-4">
                <p className="text-sm text-gray-300 mb-4">
                  Todas as configurações serão aplicadas em tempo real nas próximas rodadas do jogo.
                  Confirme as alterações antes de salvar.
                </p>
                
                <button
                  onClick={saveConfig}
                  disabled={loading}
                  className="w-full px-4 py-3 bg-gradient-to-r from-green-500 to-blue-500 text-white rounded-md hover:opacity-90 disabled:opacity-50 transition-colors font-medium"
                >
                  {loading ? 'Salvando...' : 'Salvar e Aplicar Configurações'}
                </button>
                
                <div className="mt-4 text-xs text-gray-400">
                  <p className="flex items-center mb-1">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 text-yellow-500" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    As alterações afetam apenas novas rodadas, não as em andamento.
                  </p>
                  <p className="flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Suas alterações serão aplicadas na rodada seguinte.
                  </p>
                </div>
              </div>
              
              <div className="bg-gray-900 p-4 rounded-lg">
                <h3 className="text-md font-medium text-white mb-3">Configurações Recomendadas</h3>
                
                <div className="space-y-3 text-sm text-gray-300">
                  <p className="flex items-center">
                    <span className="w-3 h-3 bg-blue-500 rounded-full mr-2"></span>
                    <strong>Equilibrado (Padrão):</strong> Margem 5%, Prob. >1.0: 30%
                  </p>
                  <p className="flex items-center">
                    <span className="w-3 h-3 bg-green-500 rounded-full mr-2"></span>
                    <strong>Amigável:</strong> Margem 3%, Prob. >1.0: 40%
                  </p>
                  <p className="flex items-center">
                    <span className="w-3 h-3 bg-yellow-500 rounded-full mr-2"></span>
                    <strong>Lucrativo:</strong> Margem 7%, Prob. >1.0: 25%
                  </p>
                  <p className="flex items-center">
                    <span className="w-3 h-3 bg-red-500 rounded-full mr-2"></span>
                    <strong>Altamente Lucrativo:</strong> Margem 10%, Prob. >1.0: 20%
                  </p>
                </div>
                
                <div className="grid grid-cols-2 gap-2 mt-4">
                  <button
                    onClick={() => {
                      setConfig(prev => ({
                        ...prev,
                        profitMargin: 5,
                        aboveOneProbability: 0.3,
                        volatility: 0.75,
                        crashProbability: 0.25,
                        trendStrength: 0.7
                      }));
                    }}
                    className="px-2 py-1 bg-blue-900 bg-opacity-50 hover:bg-opacity-70 rounded text-xs border border-blue-700"
                  >
                    Equilibrado
                  </button>
                  <button
                    onClick={() => {
                      setConfig(prev => ({
                        ...prev,
                        profitMargin: 3,
                        aboveOneProbability: 0.4,
                        volatility: 0.6,
                        crashProbability: 0.2,
                        trendStrength: 0.6
                      }));
                    }}
                    className="px-2 py-1 bg-green-900 bg-opacity-50 hover:bg-opacity-70 rounded text-xs border border-green-700"
                  >
                    Amigável
                  </button>
                  <button
                    onClick={() => {
                      setConfig(prev => ({
                        ...prev,
                        profitMargin: 7,
                        aboveOneProbability: 0.25,
                        volatility: 0.8,
                        crashProbability: 0.3,
                        trendStrength: 0.75
                      }));
                    }}
                    className="px-2 py-1 bg-yellow-900 bg-opacity-50 hover:bg-opacity-70 rounded text-xs border border-yellow-700"
                  >
                    Lucrativo
                  </button>
                  <button
                    onClick={() => {
                      setConfig(prev => ({
                        ...prev,
                        profitMargin: 10,
                        aboveOneProbability: 0.2,
                        volatility: 0.85,
                        crashProbability: 0.35,
                        trendStrength: 0.8
                      }));
                    }}
                    className="px-2 py-1 bg-red-900 bg-opacity-50 hover:bg-opacity-70 rounded text-xs border border-red-700"
                  >
                    Altamente Lucrativo
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}