'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useBalance } from '@/lib/BalanceContext';
import LastResults from '@/components/LastResults';
import LevelCard from '@/components/LevelCard';
import Tooltip from '@/components/Tooltip';
import BonusMultiplier from '@/components/BonusMultiplier';
import PlayerCountCard from '@/components/PlayerCountCard';
import FloatingChat from '@/components/FloatingChat';
import ChatButton from '@/components/ChatButton';
import CashOut from '@/components/CashOut';
import CashOutResult from '@/components/CashOutResult';
import BetPlaced from '@/components/BetPlaced';
import QuickBetButtons from '@/components/Betting/QuickBetButtons';
import { applyBonusToMultiplier } from '@/lib/bonusService';
import { createGameActions } from './GameActions';
import MultiplierChart from './MultiplierChart';

// Hooks personalizados
import { useGameState } from './useGameState';
import { useGameSocket } from './useGameSocket';
import { useAutoBetting } from './useAutoBetting';
import { useBonusSystem } from './useBonusSystem';

// Utilitários e constantes
import { 
  getCustomQuickBets, 
  getTooltipsEnabled,
  saveTooltipsPreference,
  getMultiplierColor
} from './utils';
import { 
  DEFAULT_QUICK_BETS, 
  DAILY_BET_LIMIT,
  MIN_BET_AMOUNT,
  MAX_BET_AMOUNT
} from './constants';

export default function NewGame() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { userBalance, updateBalance, refreshBalance } = useBalance();
  
  // Estado para forçar re-render quando o saldo muda
  const [localBalance, setLocalBalance] = useState(userBalance);

  // Estados do jogo usando hook personalizado
  const gameState = useGameState();
  const {
    currentPhase,
    timeLeft,
    currentMultiplier,
    multiplierHistory,
    betAmount,
    placedBet,
    cashedOut,
    cashOutMultiplier,
    winAmount,
    isLoading,
    lastResults,
    errorMessage,
    roundId,
    allBets,
    playerCount,
    setTimeLeft,
    setCurrentMultiplier,
    setBetAmount,
    setPlacedBet,
    setCashedOut,
    setCashOutMultiplier,
    setWinAmount,
    setIsLoading,
    setErrorMessage,
    setAllBets,
    setPlayerCount,
    updateGameState,
    handlePhaseChange,
    updateMultiplier,
    addResult
  } = gameState;

  // Sistema de apostas automáticas
  const autoBetting = useAutoBetting();
  const {
    isAutoBetting,
    autoBetSettings,
    autoBetStats,
    startAutoBetting,
    stopAutoBetting,
    shouldContinueAutoBetting,
    processAutoBetResult,
    autoBetManager
  } = autoBetting;

  // Sistema de bônus
  const bonusSystem = useBonusSystem(currentPhase, currentMultiplier);
  const {
    activeBonus,
    isBonusActive,
    activeSeason,
    checkAndActivateBonus,
    incrementRound
  } = bonusSystem;

  // Estados de UI
  const [tooltipsEnabled, setTooltipsEnabled] = useState(true);
  const [showChat, setShowChat] = useState(false);
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const [socketInitialized, setSocketInitialized] = useState(false);
  const [customQuickBets, setCustomQuickBets] = useState<number[]>(() => {
    const bets = getCustomQuickBets(DEFAULT_QUICK_BETS);
    return Array.isArray(bets) ? bets : DEFAULT_QUICK_BETS;
  });
  
  // Estados do limite diário
  const [todayBetAmount, setTodayBetAmount] = useState(0);
  const [userDailyLimit, setUserDailyLimit] = useState(DAILY_BET_LIMIT);
  
  // Função para buscar os dados de apostas do dia
  const fetchDailyBetTracking = useCallback(async () => {
    if (!session?.user?.id) return;
    
    try {
      const [limitResponse, trackingResponse] = await Promise.all([
        fetch('/api/user/bet-limit'),
        fetch('/api/user/bet-tracking')
      ]);
      
      if (limitResponse.ok) {
        const { dailyBetLimit } = await limitResponse.json();
        setUserDailyLimit(dailyBetLimit);
      }
      
      if (trackingResponse.ok) {
        const { todayBetAmount: amount } = await trackingResponse.json();
        setTodayBetAmount(amount);
      }
    } catch (error) {
      console.error('Erro ao buscar dados de limite diário:', error);
    }
  }, [session?.user?.id]);
  
  // Função para forçar atualização visual do saldo
  const forceBalanceUpdate = useCallback((newBalance: number) => {
    console.log(`Forçando atualização do saldo: ${localBalance} -> ${newBalance}`);
    setLocalBalance(newBalance);
    updateBalance(newBalance);
  }, [localBalance, updateBalance]);

  // Callbacks do socket
  const handleGameStateUpdate = useCallback(async (state: any) => {
    console.log('handleGameStateUpdate recebido:', state);
    updateGameState(state);
    
    // Verificar se o jogador tem uma aposta nesta rodada
    if (state.phase === 'running' && state.bets) {
      const playerBet = state.bets.find((bet: any) => 
        bet.playerId === session?.user?.id || bet.userId === session?.user?.id
      );
      
      if (playerBet && !placedBet) {
        setPlacedBet({
          amount: playerBet.amount,
          timestamp: playerBet.timestamp || Date.now()
        });
      }
    }
    
    // Se o jogo terminou, processar o resultado
    if (state.phase === 'ended' && placedBet && !cashedOut && state.roundId) {
      // Usar o multiplicador final que vem do servidor
      const finalMultiplier = state.finalMultiplier || state.multiplier || currentMultiplier;
      
      console.log('Rodada terminou (via gameStateUpdate):', {
        multiplicadorFinal: finalMultiplier,
        multiplicadorEstado: state.multiplier,
        multiplicadorAtual: currentMultiplier,
        aposta: placedBet.amount,
        roundId: state.roundId
      });
      
      // Processar imediatamente
      const processEndRound = async () => {
        try {
          const response = await fetch('/api/games/update-balance-end-round', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              multiplier: finalMultiplier,
              roundId: state.roundId,
              betAmount: placedBet.amount
            })
          });
          
          console.log('Resposta da API (gameStateUpdate):', response.status);
          
          if (response.ok) {
            const data = await response.json();
            console.log('Saldo atualizado com sucesso:', {
              valorRecebido: data.winAmount,
              novoSaldo: data.newBalance,
              multiplicadorUsado: finalMultiplier
            });
            
            // Atualizar estados imediatamente
            setWinAmount(data.winAmount);
            setCurrentMultiplier(finalMultiplier);
            
            console.log(`[gameStateUpdate] Atualizando saldo: ${userBalance} -> ${data.newBalance}`);
            
            // Atualizar saldo com força total
            forceBalanceUpdate(data.newBalance);
            
            // Executar atualizações em paralelo
            const updatePromises = [
              refreshBalance(),
              fetchDailyBetTracking()
            ];
            
            await Promise.all(updatePromises);
            
            // Verificar se o saldo foi atualizado corretamente
            setTimeout(() => {
              if (localBalance !== data.newBalance) {
                console.log('[gameStateUpdate] Saldo ainda não atualizado, tentando novamente...');
                forceBalanceUpdate(data.newBalance);
                refreshBalance();
              }
            }, 250);
            
            // Adicionar aos resultados
            addResult(finalMultiplier);
          } else {
            const errorText = await response.text();
            console.error('Erro ao atualizar saldo:', errorText);
          }
        } catch (error) {
          console.error('Erro ao processar fim da rodada:', error);
        }
      };
      
      // Executar imediatamente
      processEndRound();
    }
  }, [updateGameState, session?.user?.id, placedBet, setPlacedBet, cashedOut, setWinAmount, currentMultiplier, setCurrentMultiplier, refreshBalance, fetchDailyBetTracking, addResult, forceBalanceUpdate, localBalance]);

  const handlePhaseChangeFromSocket = useCallback(async (phase: any) => {
    console.log('handlePhaseChangeFromSocket chamado:', {
      phase,
      placedBet,
      cashedOut,
      roundId,
      currentMultiplier
    });
    
    handlePhaseChange(phase);
    
    // Se a rodada terminou e o jogador tinha uma aposta mas não fez cashout
    if (phase === 'ended' && placedBet && !cashedOut && roundId) {
      try {
        console.log('Condições atendidas para atualizar saldo no fim da rodada');
        console.log('Dados a serem enviados:', {
          multiplicador: currentMultiplier,
          aposta: placedBet.amount,
          roundId
        });
        
        const response = await fetch('/api/games/update-balance-end-round', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            multiplier: currentMultiplier,
            roundId: roundId,
            betAmount: placedBet.amount
          })
        });
        
        console.log('Resposta da API:', response.status, response.statusText);
        
        if (response.ok) {
          const data = await response.json();
          console.log('Dados recebidos da API:', data);
          setWinAmount(data.winAmount);
          updateBalance(data.newBalance);
          
          // Verificar se houve subida de nível
          if (data.level?.levelUp) {
            console.log('Usuário subiu de nível!', data.level);
          }
        } else {
          const errorText = await response.text();
          console.error('Erro na resposta da API:', errorText);
        }
      } catch (error) {
        console.error('Erro ao processar fim da rodada:', error);
      }
    } else {
      console.log('Condições não atendidas para atualizar saldo:', {
        isEnded: phase === 'ended',
        hasPlacedBet: !!placedBet,
        hasCashedOut: cashedOut,
        hasRoundId: !!roundId
      });
    }
    
    refreshBalance();
    fetchDailyBetTracking();
    
    if (phase === 'betting') {
      incrementRound();
    }
  }, [handlePhaseChange, refreshBalance, fetchDailyBetTracking, incrementRound, placedBet, cashedOut, roundId, currentMultiplier, updateBalance, setWinAmount]);

  const handleTimeUpdate = useCallback((time: number) => {
    const timeInSeconds = Math.ceil(time / 1000);
    setTimeLeft(timeInSeconds);
  }, [setTimeLeft]);

  const handleMultiplierUpdate = useCallback((value: number) => {
    console.log('Multiplicador atualizado:', value);
    updateMultiplier(value);
    checkAndActivateBonus();
    
    // Se o jogo está em andamento e o multiplicador caiu para 0 ou próximo de 0, 
    // pode indicar fim da rodada
    if (currentPhase === 'running' && value <= 0.01) {
      console.log('Multiplicador chegou a zero ou próximo, rodada pode estar terminando');
    }
  }, [updateMultiplier, checkAndActivateBonus, currentPhase]);

  const handleBetResult = useCallback((data: any) => {
    if (data.playerId === session?.user?.id || data.userId === session?.user?.id) {
      console.log('Aposta recebida com sucesso:', data);
      setPlacedBet({
        amount: data.amount,
        timestamp: Date.now()
      });
      setErrorMessage(null);
      // Atualizar saldo visual imediatamente
      const newBalance = userBalance - data.amount;
      forceBalanceUpdate(newBalance);
      // Atualizar o total apostado hoje
      setTodayBetAmount(prev => prev + data.amount);
    }
  }, [session?.user?.id, setPlacedBet, setErrorMessage, userBalance, forceBalanceUpdate]);

  const handleCashOutResult = useCallback((data: any) => {
    if (data.playerId === session?.user?.id || data.userId === session?.user?.id) {
      console.log('CashOut recebido com sucesso:', data);
      addResult(data.multiplier);
    }
  }, [session?.user?.id, addResult]);
  
  const handleGameEnded = useCallback(async (data: any) => {
    console.log('Evento gameEnded recebido:', data);
    
    // Se não temos uma aposta ativa ou já fizemos cashout, ignorar
    if (!placedBet || cashedOut) {
      console.log('Ignorando gameEnded: sem aposta ou já fez cashout');
      return;
    }
    
    const { finalMultiplier } = data;
    console.log('Processando fim de jogo com multiplicador final:', finalMultiplier);
    
    try {
      const response = await fetch('/api/games/update-balance-end-round', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          multiplier: finalMultiplier,
          roundId: roundId,
          betAmount: placedBet.amount
        })
      });
      
      console.log('Resposta da API (gameEnded):', response.status);
      
      if (response.ok) {
        const result = await response.json();
        console.log('Saldo atualizado via gameEnded:', result);
        
        // Calcular o valor final recebido
        const finalAmount = result.winAmount;
        
        // Atualizar o estado local imediatamente
        setWinAmount(finalAmount);
        setCurrentMultiplier(finalMultiplier);
        
        // IMPORTANTE: Forçar atualização visual do saldo
        console.log(`Atualizando saldo visual de ${userBalance} para ${result.newBalance}`);
        
        // Método 1: Atualizar diretamente no contexto e local
        forceBalanceUpdate(result.newBalance);
        
        // Método 2: Forçar refresh completo do saldo
        Promise.all([
          refreshBalance(),
          fetchDailyBetTracking()
        ]).then(() => {
          console.log('Saldo e apostas diárias atualizados');
          
          // Método 3: Forçar nova tentativa se o saldo não mudou
          if (localBalance !== result.newBalance) {
            console.log('Saldo ainda não atualizado visualmente, forçando nova tentativa...');
            setTimeout(() => {
              forceBalanceUpdate(result.newBalance);
              refreshBalance();
            }, 500);
          }
        });
        
        // Adicionar o resultado aos últimos resultados
        addResult(finalMultiplier);
      } else {
        const errorText = await response.text();
        console.error('Erro ao atualizar saldo (gameEnded):', errorText);
      }
    } catch (error) {
      console.error('Erro ao processar gameEnded:', error);
    }
  }, [placedBet, cashedOut, roundId, setWinAmount, refreshBalance, setCurrentMultiplier, addResult, fetchDailyBetTracking, localBalance, forceBalanceUpdate]);

  // Conectar ao socket
  const { socket, isConnected } = useGameSocket({
    onGameStateUpdate: handleGameStateUpdate,
    onPhaseChange: handlePhaseChangeFromSocket,
    onTimeUpdate: handleTimeUpdate,
    onMultiplierUpdate: handleMultiplierUpdate,
    onBetResult: handleBetResult,
    onCashOutResult: handleCashOutResult,
    onPlayerCountUpdate: setPlayerCount,
    onError: (error) => console.error('Socket error:', error),
    onGameEnded: handleGameEnded,
    sessionUserId: session?.user?.id
  });

  // Inicializar o servidor do socket multiplicador apenas uma vez
  useEffect(() => {
    const initializeSocketServer = async () => {
      try {
        console.log('Inicializando servidor Socket.IO para o jogo Multiplicador...');
        
        // Inicializar o endpoint do servidor Socket.IO para o jogo Multiplicador
        const response = await fetch('/api/socket-multiplier');
        if (!response.ok) {
          console.error('Erro ao inicializar Socket.IO:', response.statusText);
          throw new Error(`Falha ao inicializar Socket.IO: ${response.statusText}`);
        }
        
        console.log('Servidor Socket.IO inicializado com sucesso para o jogo Multiplicador');
        setSocketInitialized(true);
      } catch (error) {
        console.error('Erro ao inicializar servidor Socket.IO:', error);
        // Tenta novamente após 2 segundos em caso de erro
        setTimeout(initializeSocketServer, 2000);
      }
    };

    if (!socketInitialized) {
      initializeSocketServer();
    }
  }, [socketInitialized]);

  useEffect(() => {
    if (isConnected && socketInitialized) {
      console.log('Socket conectado e inicializado');
    }
  }, [isConnected, socketInitialized]);

  // Criar ações do jogo
  const { placeBet: placeBetAction, cashOut: doCashOut } = createGameActions({
    roundId,
    placedBet,
    cashedOut,
    currentMultiplier,
    activeBonus,
    betAmount,
    isLoading,
    setIsLoading,
    setErrorMessage,
    setCashedOut,
    setCashOutMultiplier,
    setWinAmount,
    updateBalance,
    refreshBalance,
    socket,
    isAutoBetting,
    shouldContinueAutoBetting,
    stopAutoBetting,
    processAutoBetResult,
    autoBetManager
  });

  const placeBet = () => {
    placeBetAction(betAmount);
  };

  // Efeitos
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login');
    }
  }, [status, router]);


  useEffect(() => {
    setTooltipsEnabled(getTooltipsEnabled());
  }, []);
  
  // Monitorar mudanças no saldo e forçar atualização visual
  useEffect(() => {
    if (userBalance !== localBalance) {
      console.log(`Saldo mudou: ${localBalance} -> ${userBalance}`);
      setLocalBalance(userBalance);
    }
  }, [userBalance, localBalance]);
  
  // Carregar dados de limite diário quando o componente montar
  useEffect(() => {
    if (session?.user?.id) {
      fetchDailyBetTracking();
    }
  }, [session?.user?.id, fetchDailyBetTracking]);
  

  // Handlers
  const toggleTooltips = useCallback(() => {
    const newState = !tooltipsEnabled;
    setTooltipsEnabled(newState);
    saveTooltipsPreference(newState);
  }, [tooltipsEnabled]);

  // Estados de carregamento e autenticação
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

  // Renderização do componente
  return (
    <div className="container mx-auto px-3 py-3 sm:px-4 sm:py-6 md:py-8 max-w-7xl">
      {/* Tooltips & Chat Buttons */}
      <div className={`fixed ${showChat ? 'bottom-[520px] sm:bottom-[620px]' : 'bottom-4'} right-4 z-50 flex flex-col gap-3 transition-all duration-300`}>
        <Button
          variant="secondary"
          className={`rounded-full w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center ${
            tooltipsEnabled ? 'bg-blue-500 hover:bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'
          } shadow-lg transition-all duration-300`}
          onClick={toggleTooltips}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 sm:h-6 sm:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </Button>
        
        <ChatButton
          onClick={() => {
            setShowChat(true);
            setHasNewMessages(false);
          }}
          hasNewMessages={hasNewMessages}
        />
      </div>
      
      {/* Componente de Bônus */}
      {isBonusActive && activeBonus && (
        <BonusMultiplier
          type={activeBonus.type}
          value={activeBonus.value}
          theme={activeBonus.theme}
          duration={activeBonus.duration}
          onExpire={() => setIsBonusActive(false)}
        />
      )}
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Área principal do jogo */}
        <Card variant="bordered" className="lg:col-span-2 border border-gray-800 bg-gradient-to-b from-[#121212] to-[#0c0c0c] shadow-xl overflow-hidden h-full order-1 lg:order-1">
          <CardHeader className={`border-b border-gray-800/60 bg-[#111]/50 backdrop-blur-sm flex flex-col sm:flex-row justify-between items-start sm:items-center p-3 sm:p-4 gap-2 sm:gap-0 ${
            currentPhase === 'running' ? 'animate-fadeIn' : ''
          }`}>
            <div className="animate-fadeInLeft">
              <CardTitle className="flex flex-wrap items-center text-lg sm:text-xl md:text-2xl gap-1 sm:gap-2">
                <span className={`inline-block w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full mr-1 sm:mr-2 ${
                  currentPhase === 'running' 
                    ? 'bg-green-500 animate-pulse' 
                    : currentPhase === 'betting'
                      ? 'bg-blue-500 animate-pulse'
                      : 'bg-yellow-500'
                }`}></span>
                Multiplicador
                
                {/* Indicador de evento sazonal ativo */}
                {activeSeason && (
                  <span className="text-xs sm:text-sm px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-300 animate-pulse">
                    {activeSeason.name} Event
                  </span>
                )}
                
                {/* Indicador de apostas automáticas */}
                {isAutoBetting && (
                  <span className="text-xs sm:text-sm px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full bg-blue-500/20 border border-blue-500/30 text-blue-300 animate-custom-pulse">
                    Auto Betting
                  </span>
                )}
              </CardTitle>
              <CardDescription className="text-gray-400">
                {activeSeason 
                  ? `Evento ${activeSeason.name} ativo! Chance de bônus especiais.` 
                  : 'Aposte e escolha o momento certo para fazer CashOut'}
              </CardDescription>
            </div>
            <div className={`rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 backdrop-blur-sm shadow-md transition-all duration-500 game-phase-indicator ${
              currentPhase === 'betting' 
                ? 'bg-blue-500/10 border border-blue-500/40 animate-fadeInRight' 
                : currentPhase === 'running'
                  ? 'bg-green-500/10 border border-green-500/40 animate-fadeInRight'
                  : 'bg-yellow-500/10 border border-yellow-500/40 animate-fadeInRight'
            }`}>
              <Tooltip 
                content={
                  currentPhase === 'betting'
                    ? 'Durante a fase de apostas, você tem 5 segundos para fazer sua aposta'
                    : currentPhase === 'running'
                      ? 'Fase de jogo ativa! Observe o multiplicador e faça Cash Out no momento certo'
                      : 'Rodada finalizada. Veja o resultado e prepare-se para a próxima rodada'
                }
                position="left"
                className={tooltipsEnabled ? '' : 'hidden'}
              >
                <div className="text-[10px] sm:text-xs text-gray-400 uppercase tracking-wider mb-0.5 sm:mb-1 text-center animate-fadeIn">
                  {currentPhase === 'betting' && 'Fase de apostas'}
                  {currentPhase === 'running' && 'Fase de jogo'}
                  {currentPhase === 'ended' && 'Jogo finalizado'}
                </div>
                <div className={`text-base sm:text-lg font-bold text-center animate-scaleIn ${
                  currentPhase === 'betting'
                    ? 'bg-gradient-to-r from-[#4287f5] to-[#42c5f5] bg-clip-text text-transparent'
                    : currentPhase === 'running'
                      ? 'bg-gradient-to-r from-[#1a86c7] to-[#3bc37a] bg-clip-text text-transparent'
                      : 'bg-gradient-to-r from-[#f5a742] to-[#f57e42] bg-clip-text text-transparent'
                }`}>
                  {timeLeft}s
                </div>
              </Tooltip>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="p-4">
              {/* Área do gráfico e multiplicador */}
              <div className={`relative h-64 sm:h-72 md:h-80 bg-gradient-to-b from-[#0a0a0a] to-[#090909] rounded-xl mb-3 sm:mb-4 overflow-hidden border ${
                currentPhase === 'running' 
                  ? 'border-green-500/20 animate-blink-border' 
                  : currentPhase === 'betting'
                    ? 'border-blue-500/20'
                    : 'border-gray-800/50'
              } shadow-lg flex flex-col items-center justify-center transition-all duration-500`}>
                {/* Multiplicador atual */}
                <div className="absolute top-1/3 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center z-10 multiplier-value">
                  <Tooltip 
                    content={`O multiplicador atual. Varia de 0.0x até 2.0x durante a rodada. Quanto maior, maior seu potencial ganho.`}
                    position="top"
                    className={tooltipsEnabled ? '' : 'hidden'}
                  >
                    <div className={`text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold transition-all duration-300 animate-scaleIn ${
                      currentPhase === 'running' 
                        ? getMultiplierColor(currentMultiplier)
                        : 'bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent'
                    }`}>
                      {typeof currentMultiplier === 'number' && !isNaN(currentMultiplier) 
                        ? currentMultiplier.toFixed(2) 
                        : '1.00'}x
                    </div>
                  </Tooltip>
                </div>
                
                {/* Exibir CashOut feito */}
                {cashedOut && cashOutMultiplier && (
                  <div className="absolute top-2 sm:top-4 right-2 sm:right-4 bg-black/80 backdrop-blur-sm rounded-lg px-2 sm:px-4 py-1.5 sm:py-2 border border-green-500/40 z-20 shadow-lg shadow-green-500/10 animate-slideInRight">
                    <div className="text-green-500 font-bold animate-fadeIn text-sm sm:text-base">
                      Cash Out em {cashOutMultiplier.toFixed(2)}x
                    </div>
                    <div className="text-white animate-fadeIn delay-200 text-xs sm:text-sm">
                      Ganho: R$ {((placedBet?.amount || 0) * cashOutMultiplier).toFixed(2)}
                    </div>
                  </div>
                )}
                
                {/* Resultado final */}
                {currentPhase === 'ended' && !cashedOut && placedBet && (
                  <div className={`absolute top-2 sm:top-4 right-2 sm:right-4 bg-black/80 backdrop-blur-sm rounded-lg px-2 sm:px-4 py-1.5 sm:py-2 border z-20 shadow-lg animate-slideInRight ${
                    winAmount !== null
                      ? (winAmount >= placedBet.amount ? 'border-green-500/40 shadow-green-500/10' : 'border-yellow-500/40 shadow-yellow-500/10')
                      : 'border-gray-500/40 shadow-gray-500/10'
                  }`}>
                    {winAmount !== null ? (
                      <>
                        <div className={`font-bold animate-fadeIn text-sm sm:text-base ${
                          winAmount >= placedBet.amount ? "text-green-500" : "text-yellow-500"
                        }`}>
                          {winAmount >= placedBet.amount ? 'Lucro!' : 'Retorno Parcial'}
                        </div>
                        <div className="text-white animate-fadeIn delay-200 text-xs sm:text-sm">
                          Recebido: R$ {winAmount.toFixed(2)}
                        </div>
                        <div className="text-gray-400 animate-fadeIn delay-300 text-[10px] sm:text-xs">
                          {placedBet.amount.toFixed(2)} × {currentMultiplier.toFixed(2)}x = R$ {winAmount.toFixed(2)}
                        </div>
                      </>
                    ) : (
                      <div className="text-gray-400 animate-fadeIn text-sm">
                        Processando resultado...
                      </div>
                    )}
                  </div>
                )}

                {/* Visualização da tendência do multiplicador usando o componente MultiplierChart */}
                {multiplierHistory.length > 0 && (
                  <div className="absolute bottom-0 left-0 right-0 h-[50%]">
                    <MultiplierChart 
                      multiplierHistory={multiplierHistory || []} 
                      currentPhase={currentPhase}
                      barWidth={14}
                      maxBars={60}
                    />
                  </div>
                )}
                
                {/* Conectando ao servidor */}
                {!socketInitialized && (
                  <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-50">
                    <div className="text-center">
                      <div className="animate-spin w-6 h-6 sm:w-8 sm:h-8 border-[3px] sm:border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-3 sm:mb-4"></div>
                      <div className="text-white text-sm sm:text-base">Conectando ao servidor...</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            {/* Área de apostas */}
            <div className="bg-[#0a0a0a] border-t border-gray-800/50 rounded-b-lg p-3 sm:p-4">
              {/* Mensagem de erro */}
              {errorMessage && (
                <div className="mb-3 sm:mb-4 p-2.5 sm:p-3 bg-red-500/10 border border-red-500/30 rounded-md text-red-400 text-xs sm:text-sm shadow-sm">
                  <div className="flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1.5 sm:mr-2 flex-shrink-0">
                      <circle cx="12" cy="12" r="10"></circle>
                      <line x1="12" y1="8" x2="12" y2="12"></line>
                      <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                    <span className="break-words">{errorMessage}</span>
                  </div>
                </div>
              )}
              
              {/* Fase de apostas - mostrar sempre na fase de apostas e quando não tiver aposta colocada */}
              {currentPhase === 'betting' && !placedBet && (
                <div className="animate-fadeInUp">
                  <div className="mb-3 sm:mb-4">
                    <div className="text-xs sm:text-sm text-gray-400 uppercase tracking-wider mb-1.5 sm:mb-2">Valor da aposta</div>
                    <QuickBetButtons
                      defaultBets={customQuickBets || DEFAULT_QUICK_BETS}
                      userBalance={userBalance}
                      onSelectBet={(bet) => setBetAmount(bet)}
                      selectedBet={betAmount}
                      className="mb-2 sm:mb-3"
                    />
                    
                    {/* Input personalizado */}
                    <div className="animate-fadeIn delay-500">
                      <Input
                        type="number"
                        placeholder="Valor personalizado"
                        min={MIN_BET_AMOUNT}
                        max={MAX_BET_AMOUNT}
                        step="5"
                        className="bg-[#1e1e1e] border-gray-800 h-10 sm:h-11 text-sm sm:text-base"
                        value={betAmount}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value === '' || value === null) {
                            setBetAmount(MIN_BET_AMOUNT);
                          } else {
                            const numValue = Number(value);
                            if (!isNaN(numValue)) {
                              setBetAmount(numValue);
                            }
                          }
                        }}
                      />
                    </div>
                  </div>
                  
                  {/* Botão de apostar */}
                  <Button 
                    variant="primary" 
                    className={`w-full px-4 sm:px-6 py-2.5 sm:py-3 text-base sm:text-lg font-medium transition-all duration-300 animate-fadeIn delay-500 ${
                      !betAmount || isNaN(Number(betAmount)) || betAmount < MIN_BET_AMOUNT || betAmount > userBalance || (todayBetAmount + betAmount) > userDailyLimit || isLoading
                        ? 'opacity-70'
                        : betAmount >= 50 
                          ? 'bg-gradient-to-r from-[#1a86c7] to-[#3bc37a] shadow-lg shadow-[#1a86c7]/30 hover:shadow-[#3bc37a]/50 animate-custom-pulse'
                          : 'bg-gradient-to-r from-[#1a86c7] to-[#3bc37a] shadow-lg shadow-[#1a86c7]/30 hover:shadow-[#3bc37a]/50'
                    }`}
                    disabled={!betAmount || isNaN(Number(betAmount)) || betAmount < MIN_BET_AMOUNT || betAmount > userBalance || (todayBetAmount + betAmount) > userDailyLimit || isLoading}
                    onClick={() => {
                      if (!betAmount || isNaN(Number(betAmount))) {
                        setErrorMessage('Valor de aposta inválido.');
                      } else if (betAmount < MIN_BET_AMOUNT) {
                        setErrorMessage(`O valor mínimo de aposta é R$ ${MIN_BET_AMOUNT.toFixed(2)}.`);
                      } else if (betAmount > userBalance) {
                        setErrorMessage('Saldo insuficiente para esta aposta.');
                      } else if ((todayBetAmount + betAmount) > userDailyLimit) {
                        setErrorMessage(`Esta aposta excederia seu limite diário. Disponível: R$ ${Math.max(0, userDailyLimit - todayBetAmount).toFixed(2)}`);
                      } else {
                        placeBet();
                      }
                    }}
                  >
                    {isLoading ? (
                      <div className="flex items-center justify-center">
                        <svg className="animate-spin -ml-1 mr-1.5 sm:mr-2 h-4 w-4 sm:h-5 sm:w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span className="text-sm sm:text-base">Processando...</span>
                      </div>
                    ) : 'Fazer Aposta'}
                  </Button>
                </div>
              )}
              
              {/* Área de CashOut - Usando o componente reutilizável */}
              <CashOut 
                placedBet={placedBet}
                currentMultiplier={currentMultiplier}
                isLoading={isLoading}
                onCashOut={doCashOut}
                enableTooltips={tooltipsEnabled}
                currentPhase={currentPhase}
                cashedOut={cashedOut}
              />
              
              {/* Aposta feita e aguardando */}
              <BetPlaced 
                placedBet={placedBet && currentPhase === 'betting' ? placedBet : null}
              />
              
              {/* CashOut feito */}
              <CashOutResult
                cashedOut={cashedOut}
                cashOutMultiplier={cashOutMultiplier}
                placedBet={placedBet}
              />
            </div>
          </CardContent>
          
          {/* Últimos Resultados */}
          <div className="px-3 sm:px-4 pb-4 sm:pb-6 pt-2 border-t border-gray-800/50 bg-[#0c0c0c] last-results">
            <Tooltip
              content="Veja os multiplicadores das últimas rodadas para identificar padrões"
              position="top"
              className={tooltipsEnabled ? '' : 'hidden'}
            >
              <div className="text-sm text-gray-400 uppercase tracking-wider mb-2 flex items-center animate-fadeIn">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
                Últimos Resultados
              </div>
            </Tooltip>
            <div className="animate-fadeInUp duration-700">
              <LastResults />
            </div>
          </div>
        </Card>
        
        {/* Área lateral */}
        <div className="space-y-4 sm:space-y-6 order-2 lg:order-2">
          {/* Cartão de informações financeiras */}
          <Card variant="bordered" className="border border-gray-800 bg-[#0f0f0f] shadow-lg">
            <CardHeader className="p-3 sm:p-4 border-b border-gray-800/40">
              <CardTitle className="text-base sm:text-lg">Seu Saldo</CardTitle>
              <CardDescription className="text-xs sm:text-sm">Informações da sua conta</CardDescription>
            </CardHeader>
            <CardContent className="p-3 sm:p-4">
              <div className="mb-6">
                <p className="text-xs sm:text-sm text-gray-400 mb-1">Saldo Disponível</p>
                <p className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-[#1a86c7] to-[#3bc37a] bg-clip-text text-transparent">
                  R$ {localBalance.toFixed(2)}
                </p>
              </div>

              <div>
                <p className="text-xs sm:text-sm text-gray-400 mb-1">Limite Diário de Apostas</p>
                <div className="w-full bg-gray-800 rounded-full h-2.5">
                  <div
                    className={`h-2.5 rounded-full ${
                      todayBetAmount / userDailyLimit > 0.8
                        ? 'bg-red-500'
                        : todayBetAmount / userDailyLimit > 0.5
                          ? 'bg-yellow-500'
                          : 'bg-green-500'
                    }`}
                    style={{
                      width: `${Math.min(100, (todayBetAmount / userDailyLimit) * 100)}%`,
                    }}
                  ></div>
                </div>
                <div className="flex justify-between text-xs mt-1">
                  <span className="text-gray-400">
                    R$ {todayBetAmount.toFixed(2)}
                  </span>
                  <span className="text-gray-400">
                    R$ {userDailyLimit.toFixed(2)}
                  </span>
                </div>
                <p className="text-[10px] text-gray-500 mt-1">
                  Disponível: R$ {Math.max(0, userDailyLimit - todayBetAmount).toFixed(2)}
                </p>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between gap-2 p-3 sm:p-4 border-t border-gray-800/40">
              <Button variant="primary" onClick={() => router.push('/profile')} className="flex-1 h-9 sm:h-10 text-xs sm:text-sm">
                Ver Perfil
              </Button>
              <Button variant="secondary" onClick={() => router.push('/new-interface')} className="flex-1 h-9 sm:h-10 text-xs sm:text-sm">
                Voltar
              </Button>
            </CardFooter>
          </Card>
          
          {/* Níveis e Recompensas */}
          <LevelCard />
          
          {/* Players Online */}
          <PlayerCountCard count={playerCount} tooltipsEnabled={tooltipsEnabled} />
        </div>
      </div>
      
      {/* Chat Components */}
      <div className={`fixed bottom-4 right-4 w-[350px] h-[500px] z-[100] transition-all duration-300 sm:w-[400px] sm:h-[600px] ${
        showChat ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
      }`}>
        <FloatingChat
          isOpen={showChat}
          onClose={() => setShowChat(false)}
          onNewMessage={() => setHasNewMessages(true)}
        />
      </div>
      
    </div>
  );
};