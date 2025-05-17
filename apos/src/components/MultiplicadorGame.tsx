'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useBalance } from '@/lib/BalanceContext';
import { io, Socket } from 'socket.io-client';
import MultiplierChart from '@/components/MultiplierChart';
import Tooltip from '@/components/Tooltip';
import QuickBetButtons from '@/components/Betting/QuickBetButtons';
import { AutoBetManager } from '@/lib/autoBetService';

// Constantes do jogo
const MIN_BET_AMOUNT = 5;      // Aposta mínima: R$ 5,00
const MAX_BET_AMOUNT = 1000;   // Aposta máxima: R$ 1000,00
const BETTING_PHASE_DURATION = 5;  // 5 segundos para apostas
const GAME_PHASE_DURATION = 20;    // 20 segundos para a rodada
const INITIAL_MULTIPLIER = 1.0;    // Multiplicador inicial
const MAX_MULTIPLIER = 2.0;        // Multiplicador máximo
const MIN_MULTIPLIER = 0.0;        // Multiplicador mínimo

// Variável global para armazenar a única instância do socket
let globalSocketInstance: Socket | null = null;
let isInitializingSocket = false;

interface MultiplicadorGameProps {
  onWin?: (amount: number) => void;
  onLoss?: (amount: number) => void;
  tooltipsEnabled?: boolean;
}

export default function MultiplicadorGame({ 
  onWin, 
  onLoss, 
  tooltipsEnabled = true 
}: MultiplicadorGameProps) {
  const { data: session, status } = useSession();
  const { userBalance, updateBalance, refreshBalance } = useBalance();
  
  // Estados do jogo
  const [currentPhase, setCurrentPhase] = useState<'betting' | 'running' | 'ended'>('betting');
  const [timeLeft, setTimeLeft] = useState(BETTING_PHASE_DURATION);
  const [currentMultiplier, setCurrentMultiplier] = useState(INITIAL_MULTIPLIER);
  const [multiplierHistory, setMultiplierHistory] = useState<number[]>([]);
  const [betAmount, setBetAmount] = useState<number>(MIN_BET_AMOUNT);
  const [placedBet, setPlacedBet] = useState<{amount: number, timestamp: number} | null>(null);
  const [cashedOut, setCashedOut] = useState(false);
  const [cashOutMultiplier, setCashOutMultiplier] = useState<number | null>(null);
  const [winAmount, setWinAmount] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [roundId, setRoundId] = useState<string | null>(null);
  const [gameStartTime, setGameStartTime] = useState<number | null>(null);
  const [allBets, setAllBets] = useState<any[]>([]);
  const [socketInitialized, setSocketInitialized] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);
  const socketRef = useRef<Socket | null>(null);
  
  // Quick bets
  const QUICK_BETS = [5, 10, 20, 50, 100];
  const [customQuickBets, setCustomQuickBets] = useState<number[]>(QUICK_BETS);
  
  // Controles para aposta automática
  const [isAutoBetting, setIsAutoBetting] = useState(false);
  const autoBetManagerRef = useRef<AutoBetManager | null>(null);
  const placeBetRef = useRef<(amount?: number) => Promise<boolean | undefined>>();
  const doCashOutRef = useRef<(isAuto?: boolean) => Promise<boolean>>();

  // Efeito para carregar localStorage apenas no cliente
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        const savedBets = localStorage.getItem('customQuickBets');
        if (savedBets) {
          setCustomQuickBets(JSON.parse(savedBets));
        }
      }
    } catch (error) {
      console.error('Erro ao carregar apostas rápidas personalizadas:', error);
    }
  }, []);

  // Função para obter ou criar uma instância do socket
  const getOrCreateSocketInstance = useCallback(() => {
    if (globalSocketInstance && globalSocketInstance.connected) {
      console.log('Reusing existing socket connection:', globalSocketInstance.id);
      return globalSocketInstance;
    }
    
    console.log('Creating new socket connection...');
    const socketInstance = io({
      path: '/api/socket',
      transports: ['websocket'],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });
    
    globalSocketInstance = socketInstance;
    return socketInstance;
  }, []);

  // Inicializar o Socket.IO
  const initializeSocketServer = useCallback(async () => {
    if (isInitializingSocket) return;
    
    try {
      isInitializingSocket = true;
      console.log('Inicializando servidor Socket.IO para o jogo Multiplicador...');
      
      // Inicializar o endpoint do servidor Socket.IO para o jogo Multiplicador
      const response = await fetch('/api/socket-multiplier');
      if (!response.ok) {
        console.error('Erro ao inicializar Socket.IO:', response.statusText);
        throw new Error(`Falha ao inicializar Socket.IO: ${response.statusText}`);
      }
      
      console.log('Servidor Socket.IO inicializado com sucesso para o jogo Multiplicador');
      setSocketInitialized(true);
      isInitializingSocket = false;
      
      // Após inicializar com sucesso, tentar conectar o socket imediatamente
      if (!globalSocketInstance || !globalSocketInstance.connected) {
        console.log('Criando nova conexão com Socket.IO após inicialização bem-sucedida');
        const socket = getOrCreateSocketInstance();
        socketRef.current = socket;
        setSocket(socket);
        setupSocketEvents(socket);
      }
    } catch (error) {
      console.error('Erro ao inicializar Socket.IO:', error);
      isInitializingSocket = false;
      
      // Tente novamente após 3 segundos em caso de falha
      setTimeout(() => {
        initializeSocketServer();
      }, 3000);
    }
  }, [getOrCreateSocketInstance]);

  // Configurar eventos do Socket.IO
  const setupSocketEvents = useCallback((socketClient: Socket) => {
    console.log('Configurando eventos do Socket.IO...');
    
    // Limpar eventos anteriores para evitar duplicação
    socketClient.off('gameState');
    socketClient.off('gameStarted');
    socketClient.off('multiplierUpdate');
    socketClient.off('timeUpdate');
    socketClient.off('gameEnded');
    socketClient.off('playerBet');
    socketClient.off('playerCashOut');
    
    // Escutar evento de estado do jogo
    socketClient.on('gameState', (data: any) => {
      console.log('Recebido estado do jogo:', data);
      const { phase, timeLeft: serverTimeLeft, multiplier, roundId: serverRoundId, bets } = data;
      
      // Atualizar roundId se mudou
      if (serverRoundId && serverRoundId !== roundId) {
        setRoundId(serverRoundId);
      }
      
      // Atualizar apostas
      if (Array.isArray(bets)) {
        setAllBets(bets);
      }
      
      // Atualizar fase do jogo
      if (phase && ['betting', 'running', 'ended'].includes(phase)) {
        setCurrentPhase(phase as 'betting' | 'running' | 'ended');
      }
      
      // Atualizar tempo restante
      if (typeof serverTimeLeft === 'number' && !isNaN(serverTimeLeft)) {
        const timeInSeconds = Math.ceil(serverTimeLeft / 1000);
        setTimeLeft(timeInSeconds);
      }
      
      // Atualizar multiplicador
      if (typeof multiplier === 'number' && !isNaN(multiplier)) {
        setCurrentMultiplier(multiplier);
        
        // Se estiver na fase running, adicionar ao histórico
        if (phase === 'running') {
          setMultiplierHistory(prev => {
            // Adicionar apenas se diferente do último
            if (prev.length === 0 || prev[prev.length - 1] !== multiplier) {
              return [...prev, multiplier];
            }
            return prev;
          });
        }
      }
      
      // Ações específicas para cada fase
      if (phase === 'betting') {
        setMultiplierHistory([]);
        setCurrentMultiplier(INITIAL_MULTIPLIER);
        setPlacedBet(null);
        setCashedOut(false);
        setCashOutMultiplier(null);
        setWinAmount(null);
        setErrorMessage(null);
        refreshBalance();
      } else if (phase === 'running') {
        setTimeLeft(GAME_PHASE_DURATION);
        setGameStartTime(Date.now());
        setMultiplierHistory([INITIAL_MULTIPLIER]); // Iniciar histórico com valor inicial
      }
    });
    
    socketClient.on('multiplierUpdate', (multiplier: number) => {
      console.log('Atualização de multiplicador:', multiplier);
      if (typeof multiplier === 'number' && !isNaN(multiplier)) {
        setCurrentMultiplier(multiplier);
        setMultiplierHistory(prev => [...prev, multiplier]);
      }
    });
    
    socketClient.on('timeUpdate', (time: number) => {
      if (typeof time !== 'number' || isNaN(time)) {
        console.warn('Recebido tempo inválido:', time);
        return;
      }
      
      // Converter de milissegundos para segundos
      const timeInSeconds = Math.ceil(time / 1000);
      setTimeLeft(timeInSeconds);
    });
    
    socketClient.on('gameStarted', (data: any) => {
      console.log('Jogo iniciado:', data);
      setRoundId(data.roundId);
      setAllBets(data.bets || []);
      setGameStartTime(Date.now());
      
      // Reiniciar o multiplicador ao iniciar o jogo
      setCurrentMultiplier(INITIAL_MULTIPLIER);
      setMultiplierHistory([INITIAL_MULTIPLIER]);
    });
    
    socketClient.on('gameEnded', (data: any) => {
      console.log('Jogo finalizado:', data);
      const finalMultiplier = data.finalMultiplier;
      
      // Verificar se o jogador ganhou
      if (placedBet && !cashedOut) {
        if (finalMultiplier >= 1.0) {
          // Jogador ganhou
          const winningAmount = placedBet.amount * finalMultiplier;
          setWinAmount(winningAmount);
          updateBalance(userBalance + winningAmount);
          if (onWin) onWin(winningAmount);
        } else {
          // Jogador perdeu
          const lossAmount = placedBet.amount;
          setWinAmount(-lossAmount);
          if (onLoss) onLoss(lossAmount);
        }
      }
      
      // Atualizar saldo de qualquer forma
      refreshBalance();
    });
    
    socketClient.on('playerBet', (data: any) => {
      console.log('Aposta de jogador recebida:', data);
      // Atualizar a lista de apostas
      setAllBets(prev => {
        const existingBetIndex = prev.findIndex(bet => bet.userId === data.userId);
        if (existingBetIndex >= 0) {
          // Atualizar aposta existente
          const updatedBets = [...prev];
          updatedBets[existingBetIndex] = { ...prev[existingBetIndex], ...data };
          return updatedBets;
        } else {
          // Adicionar nova aposta
          return [...prev, data];
        }
      });
      
      // Se for o usuário atual, atualizar estado de aposta
      if (session?.user?.id === data.userId) {
        setPlacedBet({
          amount: data.amount,
          timestamp: data.timestamp || Date.now()
        });
      }
    });
    
    socketClient.on('playerCashOut', (data: any) => {
      console.log('Cash out de jogador recebido:', data);
      
      // Se for o usuário atual, atualizar estado
      if (session?.user?.id === data.userId) {
        setCashedOut(true);
        setCashOutMultiplier(data.multiplier);
        setWinAmount(data.winAmount);
        updateBalance(userBalance + data.winAmount);
      }
      
      // Atualizar a lista de apostas para refletir o cash out
      setAllBets(prev => {
        return prev.map(bet => {
          if (bet.userId === data.userId) {
            return { ...bet, cashedOut: true, cashOutMultiplier: data.multiplier };
          }
          return bet;
        });
      });
    });
    
    // Escutar eventos de conexão e reconexão
    socketClient.on('connect', () => {
      console.log('Socket conectado:', socketClient.id);
      
      // Solicitar estado atual do jogo ao conectar
      socketClient.emit('requestGameState');
    });
    
    socketClient.on('disconnect', () => {
      console.log('Socket desconectado');
    });
    
    socketClient.on('connect_error', (error) => {
      console.error('Erro de conexão Socket.IO:', error);
    });
    
    // Solicitar estado atual do jogo
    if (socketClient.connected) {
      socketClient.emit('requestGameState');
    }
  }, [session, roundId, userBalance, updateBalance, refreshBalance, placedBet, cashedOut, onWin, onLoss]);

  // Inicializar o socket
  useEffect(() => {
    // Inicializar o servidor Socket.IO se ainda não estiver inicializado
    if (!socketInitialized) {
      initializeSocketServer();
    }
    
    return () => {
      if (socketRef.current) {
        console.log('Desconectando socket ao desmontar componente');
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setSocket(null);
    };
  }, [initializeSocketServer, socketInitialized]);

  // Função para realizar uma aposta
  const placeBet = async (amount = betAmount) => {
    if (isLoading || !roundId || !socket || !session) return;
    
    try {
      setIsLoading(true);
      setErrorMessage(null);
      
      // Atualizar a referência para uso pelo autoBet
      placeBetRef.current = placeBet;
      
      // Validar valor da aposta
      if (!amount || isNaN(Number(amount)) || amount < MIN_BET_AMOUNT) {
        setErrorMessage(`Valor mínimo de aposta é R$ ${MIN_BET_AMOUNT.toFixed(2)}`);
        setIsLoading(false);
        return;
      }
      
      if (amount > MAX_BET_AMOUNT) {
        setErrorMessage(`Valor máximo de aposta é R$ ${MAX_BET_AMOUNT.toFixed(2)}`);
        setIsLoading(false);
        return;
      }
      
      if (amount > userBalance) {
        setErrorMessage('Saldo insuficiente');
        setIsLoading(false);
        return;
      }
      
      // Verificar se já apostou nesta rodada
      if (placedBet) {
        setErrorMessage('Você já fez uma aposta nesta rodada');
        setIsLoading(false);
        return;
      }
      
      // Verificar se a fase atual é a de apostas
      if (currentPhase !== 'betting') {
        setErrorMessage('Apostas encerradas para esta rodada');
        setIsLoading(false);
        return;
      }
      
      console.log(`Enviando aposta: R$ ${amount.toFixed(2)} na rodada ${roundId}`);
      
      // Fazer a requisição para o backend
      const response = await fetch('/api/games/place-bet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: amount,
          gameType: 'multiplicador',
          roundId: roundId,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        console.error('Erro ao fazer aposta:', data);
        setErrorMessage(data.message || 'Erro ao fazer aposta');
        setIsLoading(false);
        return;
      }
      
      // Atualizar o saldo
      updateBalance(data.newBalance);
      
      // Atualizar o estado de apostas
      setPlacedBet({
        amount: amount,
        timestamp: Date.now(),
      });
      
      // Emitir evento para o socket informando que o usuário apostou
      socket.emit('playerBet', {
        userId: session.user.id,
        amount: amount,
        roundId: roundId,
      });
      
      console.log('Aposta realizada com sucesso:', data);
      setIsLoading(false);
      
      return true;
    } catch (error) {
      console.error('Erro ao fazer aposta:', error);
      
      setErrorMessage(
        error instanceof Error 
          ? error.message 
          : 'Erro ao fazer aposta. Tente novamente.'
      );
      
      setIsLoading(false);
      return false;
    }
  };

  // Função para fazer cash out
  const doCashOut = async (isAuto: boolean = false) => {
    if (!placedBet || cashedOut || currentPhase !== 'running' || !roundId || !session) {
      return false;
    }

    try {
      setIsLoading(true);
      
      // Usar o multiplicador atual para o Cash Out
      const cashOutMultiplierValue = currentMultiplier;
      
      if (typeof cashOutMultiplierValue !== 'number' || isNaN(cashOutMultiplierValue)) {
        setErrorMessage('Valor de multiplicador inválido');
        setIsLoading(false);
        return false;
      }
      
      const response = await fetch('/api/games/cash-out', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          multiplier: cashOutMultiplierValue,
          roundId: roundId,
          betAmount: placedBet.amount
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        setErrorMessage(data.message || 'Erro ao realizar cash out');
        setIsLoading(false);
        return false;
      }
      
      // Atualizar estado
      setCashedOut(true);
      setCashOutMultiplier(cashOutMultiplierValue);
      setWinAmount(data.winAmount);
      
      // Atualizar saldo
      updateBalance(data.newBalance);
      
      // Emitir evento via socket
      if (socket && socket.connected) {
        socket.emit('playerCashOut', {
          userId: session.user.id,
          multiplier: cashOutMultiplierValue,
          winAmount: data.winAmount
        });
      }
      
      if (onWin && data.winAmount > 0) {
        onWin(data.winAmount);
      }
      
      setIsLoading(false);
      return true;
    } catch (error) {
      console.error('Erro ao fazer cash out:', error);
      setErrorMessage('Falha ao realizar cash out. Tente novamente.');
      setIsLoading(false);
      return false;
    }
  };

  // Armazenar referência do doCashOut para uso em outros efeitos
  useEffect(() => {
    doCashOutRef.current = doCashOut;
  }, [placedBet, cashedOut, currentPhase, roundId, currentMultiplier, session, socket]);

  // Função auxiliar para obter a cor do texto do multiplicador
  const getMultiplierColor = (multiplier: number | undefined) => {
    if (multiplier === undefined || isNaN(Number(multiplier))) return 'text-white';
    if (multiplier >= 1.8) return 'text-green-400 animate-pulse';
    if (multiplier >= 1.5) return 'text-green-500';
    if (multiplier >= 1.2) return 'text-blue-300';
    if (multiplier >= 1.0) return 'text-blue-400';
    if (multiplier >= 0.7) return 'text-yellow-500';
    if (multiplier >= 0.5) return 'text-orange-500';
    return 'text-red-500';
  };

  if (status === 'unauthenticated' || !session) {
    return (
      <Card className="border border-gray-800 bg-gradient-to-b from-[#121212] to-[#0c0c0c]">
        <CardContent className="p-6 text-center">
          <p>Você precisa estar autenticado para jogar.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card variant="bordered" className="lg:col-span-2 border border-gray-800 bg-gradient-to-b from-[#121212] to-[#0c0c0c] shadow-xl overflow-hidden h-full">
      <CardHeader className={`border-b border-gray-800/60 bg-[#111]/50 backdrop-blur-sm flex justify-between items-start p-4 ${
        currentPhase === 'running' ? 'animate-fadeIn' : ''
      }`}>
        <div className="animate-fadeInLeft">
          <CardTitle className="flex items-center text-2xl">
            <span className={`inline-block w-3 h-3 rounded-full mr-2 ${
              currentPhase === 'running' 
                ? 'bg-green-500 animate-pulse' 
                : currentPhase === 'betting'
                  ? 'bg-blue-500 animate-pulse'
                  : 'bg-yellow-500'
            }`}></span>
            Multiplicador
          </CardTitle>
          <CardDescription className="text-gray-400">
            Aposte e escolha o momento certo para fazer Cash Out
          </CardDescription>
        </div>
        <div className={`rounded-lg px-3 py-2 backdrop-blur-sm shadow-md transition-all duration-500 game-phase-indicator ${
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
            <div className="text-xs text-gray-400 uppercase tracking-wider mb-1 text-center animate-fadeIn">
              {currentPhase === 'betting' && 'Fase de apostas'}
              {currentPhase === 'running' && 'Fase de jogo'}
              {currentPhase === 'ended' && 'Jogo finalizado'}
            </div>
            <div className={`text-lg font-bold text-center animate-scaleIn ${
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
          <div className={`relative h-80 bg-gradient-to-b from-[#0a0a0a] to-[#090909] rounded-xl mb-4 overflow-hidden border ${
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
                <div 
                  className={`text-6xl font-bold transition-all duration-100 ${
                    currentPhase === 'running' 
                      ? getMultiplierColor(currentMultiplier) 
                      : 'bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent'
                  }`}
                  key={`multiplier-${currentMultiplier}`} // Força re-renderização quando o valor muda
                >
                  {typeof currentMultiplier === 'number' && !isNaN(currentMultiplier) 
                    ? currentMultiplier.toFixed(2) 
                    : '1.00'}x
                </div>
              </Tooltip>
            </div>
            
            {/* Visualização da tendência do multiplicador usando o componente MultiplierChart */}
            {multiplierHistory.length > 0 && (
              <div className="absolute bottom-0 left-0 right-0 h-[50%]">
                <MultiplierChart 
                  multiplierHistory={multiplierHistory} 
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
                  <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                  <div className="text-white">Conectando ao servidor...</div>
                </div>
              </div>
            )}

            {/* Cash out button - mostrar apenas quando o jogo está rodando e o usuário fez uma aposta */}
            {currentPhase === 'running' && placedBet && !cashedOut && (
              <div className="absolute bottom-4 transform left-1/2 -translate-x-1/2">
                <Button 
                  variant="primary" 
                  size="lg"
                  onClick={() => doCashOut()}
                  className="cashout-button bg-gradient-to-r from-green-500 to-blue-600 hover:from-green-400 hover:to-blue-500 text-white font-bold py-3 px-6 rounded-full shadow-lg transition-all duration-300 transform hover:scale-105"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <div className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Processando...
                    </div>
                  ) : (
                    <div className="flex items-center">
                      <span className="mr-2">Cash Out</span>
                      <span className="bg-white bg-opacity-20 rounded-xl px-2 py-1 text-sm">
                        {placedBet ? `R$ ${(placedBet.amount * currentMultiplier).toFixed(2)}` : '0.00'}
                      </span>
                    </div>
                  )}
                </Button>
              </div>
            )}

            {/* Mostrar resultado de aposta - quando houve cash out ou o jogo terminou */}
            {((cashedOut && cashOutMultiplier) || (currentPhase === 'ended' && placedBet && !cashedOut)) && (
              <div className="absolute bottom-4 transform left-1/2 -translate-x-1/2 text-center">
                <div className={`text-lg font-bold mb-1 ${
                  winAmount && winAmount > 0 ? 'text-green-400' : 'text-red-400'
                }`}>
                  {winAmount && winAmount > 0 
                    ? `+ R$ ${winAmount.toFixed(2)}` 
                    : winAmount 
                      ? `- R$ ${Math.abs(winAmount).toFixed(2)}`
                      : 'Perdeu!'}
                </div>
                {cashOutMultiplier && (
                  <div className="text-sm text-gray-400">
                    Cash out em {cashOutMultiplier.toFixed(2)}x
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        
        {/* Área de apostas - implementação da fase de apostas */}
        <div className="bg-[#0a0a0a] border-t border-gray-800/50 rounded-b-lg p-4">
          {/* Mensagem de erro */}
          {errorMessage && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-md text-red-400 text-sm shadow-sm">
              <div className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                {errorMessage}
              </div>
            </div>
          )}
          
          {/* Fase de apostas - mostrar sempre na fase de apostas e quando não tiver aposta colocada */}
          {currentPhase === 'betting' && !placedBet && (
            <div className="animate-fadeInUp">
              <div className="mb-4">
                <div className="text-sm text-gray-400 uppercase tracking-wider mb-2">Valor da aposta</div>
                <QuickBetButtons
                  defaultBets={QUICK_BETS}
                  userBalance={userBalance}
                  onSelectBet={(bet) => setBetAmount(bet)}
                  selectedBet={betAmount}
                  className="mb-3"
                />
                
                {/* Input personalizado */}
                <div className="mt-3 animate-fadeIn delay-500">
                  <Input
                    type="number"
                    placeholder="Valor personalizado"
                    min={MIN_BET_AMOUNT}
                    max={MAX_BET_AMOUNT}
                    step="5"
                    className="bg-[#1e1e1e] border-gray-800"
                    value={betAmount}
                    onChange={(e) => {
                      const value = e.target.value;
                      // Verificar se é um número válido antes de atualizar o estado
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
                className={`w-full px-6 py-3 text-lg font-medium transition-all duration-300 animate-fadeIn delay-500 ${
                  !betAmount || isNaN(Number(betAmount)) || betAmount < MIN_BET_AMOUNT || betAmount > userBalance || isLoading
                    ? 'opacity-70'
                    : betAmount >= 50 
                      ? 'bg-gradient-to-r from-[#1a86c7] to-[#3bc37a] shadow-lg shadow-[#1a86c7]/30 hover:shadow-[#3bc37a]/50 animate-custom-pulse'
                      : 'bg-gradient-to-r from-[#1a86c7] to-[#3bc37a] shadow-lg shadow-[#1a86c7]/30 hover:shadow-[#3bc37a]/50'
                }`}
                disabled={!betAmount || isNaN(Number(betAmount)) || betAmount < MIN_BET_AMOUNT || betAmount > userBalance || isLoading}
                onClick={() => {
                  placeBet();
                }}
              >
                {isLoading ? (
                  <div className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processando...
                  </div>
                ) : 'Fazer Aposta'}
              </Button>
            </div>
          )}
          
          {/* Fase de jogo - mostrar valores de aposta quando o jogo estiver rodando */}
          {(currentPhase === 'running' || currentPhase === 'ended') && placedBet && (
            <div className="animate-fadeInUp">
              <div className="flex justify-between items-center">
                <div>
                  <div className="text-sm text-gray-400">Sua aposta</div>
                  <div className="text-xl font-bold">R$ {placedBet.amount.toFixed(2)}</div>
                </div>
                
                <div className="text-right">
                  <div className="text-sm text-gray-400">Potencial ganho</div>
                  <div className={`text-xl font-bold ${getMultiplierColor(currentMultiplier)}`}>
                    R$ {(placedBet.amount * currentMultiplier).toFixed(2)}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}