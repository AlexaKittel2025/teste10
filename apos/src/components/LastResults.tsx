'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';

type LastResultsProps = {
  className?: string;
};

type RoundResult = {
  id: string;
  multiplier: number;
  timestamp: string;
  userBet?: {
    amount: number;
    cashOut: boolean;
    cashOutValue?: number;
    profit?: number;
  } | null;
};

const LastResults: React.FC<LastResultsProps> = ({ className }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [results, setResults] = useState<RoundResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedResult, setSelectedResult] = useState<string | null>(null);
  const [highlightedResults, setHighlightedResults] = useState<Set<string>>(new Set());

  // Buscar resultados do servidor
  useEffect(() => {
    const fetchResults = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/rounds/last-results');
        
        if (!response.ok) {
          throw new Error('Falha ao buscar os resultados');
        }
        
        const data = await response.json();
        
        if (!data.results || data.results.length === 0) {
          setResults([]);
          setIsLoading(false);
          return;
        }
        
        // Processar os resultados
        const processedResults = data.results.map((result: any) => {
          // Garantir que o multiplicador está no intervalo correto
          const multiplier = typeof result.result === 'number' && !isNaN(result.result)
            ? Math.max(0, Math.min(2.0, result.result))
            : 1.0;
          
          // Processar informação da aposta do usuário, se existir
          let userBet = null;
          if (result.userBet) {
            userBet = {
              amount: result.userBet.amount,
              cashOut: result.userBet.cashOutValue !== undefined && result.userBet.cashOutValue !== null,
              cashOutValue: result.userBet.cashOutValue,
              profit: result.userBet.profit
            };
          }
          
          return {
            id: result.id,
            multiplier,
            timestamp: result.timestamp,
            userBet
          };
        });
        
        setResults(processedResults);
        
        // Identificar sequências para destacar
        identifySequences(processedResults);
      } catch (err) {
        console.error('Erro ao carregar resultados:', err);
        setError('Não foi possível carregar os últimos resultados');
      } finally {
        setIsLoading(false);
      }
    };

    fetchResults();
    
    // Atualizar a cada 15 segundos
    const intervalId = setInterval(fetchResults, 15000);
    
    return () => clearInterval(intervalId);
  }, []);

  // Identificar sequências para destacar
  const identifySequences = (results: RoundResult[]) => {
    const newHighlighted = new Set<string>();
    
    // Encontrar sequências de 3+ multiplicadores similares
    let currentType = results.length > 0 ? results[0].multiplier >= 1.0 : true;
    let sequenceStart = 0;
    
    for (let i = 1; i < results.length; i++) {
      const isHighMultiplier = results[i].multiplier >= 1.0;
      
      if (isHighMultiplier === currentType) {
        // Continuando a sequência
        if (i - sequenceStart >= 2) {
          // Se temos 3+ itens na sequência, adicionar todos
          for (let j = sequenceStart; j <= i; j++) {
            newHighlighted.add(results[j].id);
          }
        }
      } else {
        // Nova sequência
        currentType = isHighMultiplier;
        sequenceStart = i;
      }
    }
    
    setHighlightedResults(newHighlighted);
  };

  // Formatar data/hora
  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('pt-BR', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false
    });
  };

  // Obter ângulo para o gradiente baseado no multiplicador
  const getGradientAngle = (multiplier: number) => {
    // Transforma o multiplicador em um ângulo entre 0 e 180
    // 0.0 -> 0 graus, 1.0 -> 90 graus, 2.0 -> 180 graus
    return Math.min(180, Math.max(0, multiplier * 90));
  };

  // Determinar estilo para o círculo de multiplicador
  const getMultiplierGradient = (multiplier: number) => {
    // Para valores >= 1.0 (ganho): Verde azulado -> Verde claro -> Dourado
    // Para valores < 1.0 (perda): Vermelho -> Laranja -> Amarelo
    if (multiplier >= 1.0) {
      // Normalizar para um valor entre 0 e 1 (para multiplicadores entre 1.0 e 2.0)
      const normalizedValue = Math.min(1, multiplier - 1.0);
      
      // Cores para multiplicador de ganho (azul esverdeado a dourado)
      return `conic-gradient(
        from ${getGradientAngle(multiplier)}deg,
        #1a86c7,
        #26a9c1 10%,
        #30cb9a 40%,
        #3bc37a ${Math.min(100, normalizedValue * 100 + 50)}%,
        #c2e852
      )`;
    } else {
      // Normalizar para um valor entre 0 e 1
      const normalizedValue = multiplier;
      
      // Cores para multiplicador de perda (vermelho a laranja)
      return `conic-gradient(
        from ${getGradientAngle(multiplier)}deg,
        #fc0d1b,
        #ff4d4d 20%,
        #ff7c43 50%,
        #ffa236 ${Math.min(100, normalizedValue * 100)}%,
        #ffce26
      )`;
    }
  };

  // Determinar cor do texto baseada no multiplicador
  const getMultiplierColor = (multiplier: number) => {
    if (multiplier >= 1.8) return 'text-yellow-300 drop-shadow-md';
    if (multiplier >= 1.5) return 'text-green-300 drop-shadow-md';
    if (multiplier >= 1.2) return 'text-teal-300';
    if (multiplier >= 1.0) return 'text-blue-300';
    if (multiplier >= 0.7) return 'text-orange-300';
    if (multiplier >= 0.4) return 'text-orange-400';
    return 'text-red-400';
  };

  // Calcular o tamanho do texto baseado no multiplicador
  const getMultiplierSize = (multiplier: number) => {
    // Quanto maior o multiplicador, maior o tamanho
    if (multiplier >= 1.8) return 'text-sm font-extrabold tracking-tight';
    if (multiplier >= 1.5) return 'text-sm font-bold';
    if (multiplier >= 1.0) return 'text-xs font-bold';
    return 'text-xs font-medium';
  };

  return (
    <Card className={`${className} overflow-hidden backdrop-blur-sm bg-black/40 border-gray-800/80`}>
      <CardHeader className="p-4 pb-2 bg-gradient-to-r from-gray-900/80 to-gray-800/60 border-b border-gray-800/50">
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="text-base font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
              Últimos Resultados
            </CardTitle>
            <CardDescription className="text-xs text-gray-400">
              Histórico de multiplicadores das rodadas
            </CardDescription>
          </div>
          
          {/* Estatísticas rápidas */}
          <div className="flex items-center space-x-3 pr-1">
            <div className="flex flex-col items-center bg-green-500/10 px-2 py-1 rounded-md border border-green-500/20">
              <span className="text-[10px] text-gray-400">≥1.00x</span>
              <span className="text-sm font-bold text-green-500">
                {results.filter(r => r.multiplier >= 1.0).length}
              </span>
            </div>
            <div className="flex flex-col items-center bg-blue-500/10 px-2 py-1 rounded-md border border-blue-500/20">
              <span className="text-[10px] text-gray-400">&lt;1.00x</span>
              <span className="text-sm font-bold text-blue-500">
                {results.filter(r => r.multiplier < 1.0).length}
              </span>
            </div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-4 pt-3">
        {isLoading ? (
          <div className="flex justify-center items-center h-24">
            <div className="flex flex-col items-center">
              <div className="animate-spin w-6 h-6 rounded-full border-2 border-t-transparent border-blue-500 mb-2"></div>
              <div className="text-xs text-gray-400">Carregando resultados...</div>
            </div>
          </div>
        ) : error ? (
          <div className="text-center bg-red-500/10 border border-red-500/20 rounded-md py-3 text-red-400 text-sm">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mx-auto mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
          </div>
        ) : results.length === 0 ? (
          <div className="text-center bg-gray-800/50 border border-gray-700/30 rounded-md py-4 text-gray-400 text-sm">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mx-auto mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Nenhum resultado disponível
          </div>
        ) : (
          <div className="grid grid-cols-5 gap-2">
            {results.map((round, index) => (
              <div 
                key={round.id} 
                className={`relative rounded-md border overflow-hidden transition-all duration-300 cursor-pointer
                  ${selectedResult === round.id 
                    ? 'bg-gray-700/50 border-gray-500/50 scale-105 z-10 shadow-lg' 
                    : highlightedResults.has(round.id)
                      ? 'bg-gray-800/70 border-gray-600/30 hover:bg-gray-700/40' 
                      : 'bg-gray-800/30 border-gray-700/30 hover:bg-gray-700/30'
                  }
                `}
                onClick={() => setSelectedResult(selectedResult === round.id ? null : round.id)}
              >
                {/* Destaque para resultados recentes */}
                {index === 0 && (
                  <div className="absolute top-0 left-0 bg-blue-500 text-[8px] text-white px-1 py-0.5 rounded-br-md font-medium">
                    NOVO
                  </div>
                )}
                
                {/* Conteúdo principal */}
                <div className="p-2">
                  {/* Círculo do multiplicador com gradiente avançado */}
                  <div className="mx-auto w-12 h-12 mb-1 rounded-full p-[2px]" style={{ background: getMultiplierGradient(round.multiplier) }}>
                    <div className="w-full h-full rounded-full bg-gray-900 flex items-center justify-center">
                      <div className="flex flex-col items-center justify-center">
                        <span className={`${getMultiplierSize(round.multiplier)} ${getMultiplierColor(round.multiplier)}`}>
                          {round.multiplier.toFixed(2)}x
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Rótulo para o tipo de resultado */}
                  <div className="text-center">
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                      round.multiplier >= 1.0 
                        ? 'bg-green-500/20 text-green-400' 
                        : 'bg-blue-500/20 text-blue-400'
                    }`}>
                      {round.multiplier >= 1.0 ? 'ACIMA' : 'ABAIXO'}
                    </span>
                  </div>
                  
                  {/* Hora do resultado */}
                  <div className="text-[10px] text-gray-400 text-center mt-1">
                    {formatDateTime(round.timestamp)}
                  </div>
                  
                  {/* Informações da aposta do usuário (se houver) */}
                  {round.userBet && (
                    <div className="mt-1.5 pt-1.5 border-t border-gray-700/50">
                      <div className="flex justify-between items-center text-[9px]">
                        <span className="text-gray-400">Aposta:</span>
                        <span className="font-medium">R$ {round.userBet.amount.toFixed(0)}</span>
                      </div>
                      
                      {round.userBet.cashOut ? (
                        <div className="flex justify-between items-center text-[9px] mt-0.5">
                          <span className="text-gray-400">Cash Out:</span>
                          <span className="font-medium text-green-400">{round.userBet.cashOutValue?.toFixed(2)}x</span>
                        </div>
                      ) : (
                        <div className="flex justify-between items-center text-[9px] mt-0.5">
                          <span className="text-gray-400">Resultado:</span>
                          <span className={`font-medium ${round.multiplier >= 1.0 ? 'text-green-400' : 'text-red-400'}`}>
                            {round.multiplier >= 1.0 
                              ? `+R$ ${(round.userBet.amount * round.multiplier - round.userBet.amount).toFixed(0)}` 
                              : `-R$ ${round.userBet.amount.toFixed(0)}`}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                
                {/* Indicador para sequências */}
                {highlightedResults.has(round.id) && !selectedResult && (
                  <div className="absolute top-0 right-0 w-2 h-2 bg-white rounded-full m-1 animate-pulse"></div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Linha do tempo de resultados */}
        {results.length > 0 && (
          <div className="mt-3 pt-2 border-t border-gray-800">
            <div className="relative h-1.5 bg-gray-800/70 rounded-full overflow-hidden">
              <div className="absolute inset-0 flex">
                {results.map((r, index) => (
                  <div 
                    key={r.id}
                    className="h-full transition-all"
                    style={{
                      width: `${100 / results.length}%`,
                      background: r.multiplier >= 1.0 ? '#3bc37a' : '#1a86c7',
                      opacity: selectedResult === r.id ? 1 : 0.6,
                      transform: `scaleY(${selectedResult === r.id ? 1.8 : 1})`,
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default LastResults;