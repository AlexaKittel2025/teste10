'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useBalance } from '@/lib/BalanceContext';
import { io, Socket } from 'socket.io-client';
import LastResults from '@/components/LastResults';
import LevelCard from '@/components/LevelCard';
import MultiplierChart from '@/components/MultiplierChart';
import GameTutorial from '@/components/GameTutorial';
import Tooltip from '@/components/Tooltip';
import BonusMultiplier from '@/components/BonusMultiplier';
import AutoBetConfig, { AutoBetSettings } from '@/components/AutoBetConfig';
import PlayerCountCard from '@/components/PlayerCountCard';
import FloatingChat from '@/components/FloatingChat';
import ChatButton from '@/components/ChatButton';
import CustomQuickBets from '@/components/Betting/CustomQuickBets';
import QuickBetButtons from '@/components/Betting/QuickBetButtons';
import CashOut from '@/components/CashOut';
import CashOutResult from '@/components/CashOutResult';
import BetPlaced from '@/components/BetPlaced';
import { getRandomBonus, applyBonusToMultiplier, getActiveSeasonalEvent, BonusMultiplier as BonusType } from '@/lib/bonusService';
import { AutoBetManager, BetResult } from '@/lib/autoBetService';

// Constantes do jogo
const MIN_BET_AMOUNT = 5;      // Aposta mínima: R$ 5,00
const MAX_BET_AMOUNT = 1000;   // Aposta máxima: R$ 1000,00
const DAILY_BET_LIMIT = 15000; // Limite diário: R$ 15000,00
const BETTING_PHASE_DURATION = 5;  // 5 segundos para apostas
const GAME_PHASE_DURATION = 20;    // 20 segundos para a rodada
const INITIAL_MULTIPLIER = 1.0;    // Multiplicador inicial
const MAX_MULTIPLIER = 2.0;        // Multiplicador máximo
const MIN_MULTIPLIER = 0.0;        // Multiplicador mínimo

// Variável global para armazenar a única instância do socket
let globalSocketInstance: Socket | null = null;
let isInitializingSocket = false;

export default function NewGame() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { userBalance, updateBalance, refreshBalance } = useBalance();
  
  // Estados do jogo
  const [currentPhase, setCurrentPhase] = useState<'betting' | 'running' | 'ended'>('betting');
  const [timeLeft, setTimeLeft] = useState(BETTING_PHASE_DURATION);
  const [currentMultiplier, setCurrentMultiplier] = useState(INITIAL_MULTIPLIER);
  const [multiplierHistory, setMultiplierHistory] = useState<number[]>([]);
  const [betAmount, setBetAmount] = useState<number>(MIN_BET_AMOUNT); // Inicializado com valor mínimo em vez de null
  const [placedBet, setPlacedBet] = useState<{amount: number, timestamp: number} | null>(null);
  const [cashedOut, setCashedOut] = useState(false);
  const [cashOutMultiplier, setCashOutMultiplier] = useState<number | null>(null);
  const [winAmount, setWinAmount] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastResults, setLastResults] = useState<{multiplier: number, timestamp: number}[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [roundId, setRoundId] = useState<string | null>(null);
  const [gameStartTime, setGameStartTime] = useState<number | null>(null);
  const [allBets, setAllBets] = useState<any[]>([]);
  const [playerCount, setPlayerCount] = useState(1);
  const [socketInitialized, setSocketInitialized] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);
  const socketRef = useRef<Socket | null>(null);
  
  // Tutorial and tooltips state
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialCompleted, setTutorialCompleted] = useState(false);
  const [tooltipsEnabled, setTooltipsEnabled] = useState(true);
  
  // Bonus multipliers state
  const [activeBonus, setActiveBonus] = useState<BonusType | null>(null);
  const [isBonusActive, setIsBonusActive] = useState(false);
  const [activeSeason, setActiveSeason] = useState<{name: string; theme: 'christmas' | 'halloween' | 'summer' | 'default'} | null>(null);
  const [currentRound, setCurrentRound] = useState(0);
  const [lastBonusRound, setLastBonusRound] = useState(0);
  
  // Auto bet state
  const [isAutoBetting, setIsAutoBetting] = useState(false);
  const [autoBetSettings, setAutoBetSettings] = useState<AutoBetSettings | null>(null);
  const autoBetManagerRef = useRef<AutoBetManager | null>(null);
  const [autoBetStats, setAutoBetStats] = useState<{
    totalWon: number;
    totalLost: number;
    netResult: number;
    roundsRemaining: number;
  } | null>(null);
  
  // Estado para controlar a visibilidade do chat de suporte
  const [showChat, setShowChat] = useState(false);
  const [hasNewMessages, setHasNewMessages] = useState(false);
  
  // Quick bets
  const QUICK_BETS = [5, 10, 20, 50, 100];
  const [customQuickBets, setCustomQuickBets] = useState<number[]>(() => {
    // Verificar se estamos no cliente antes de acessar localStorage
    if (typeof window !== 'undefined') {
      try {
        const savedBets = localStorage.getItem('customQuickBets');
        if (savedBets) {
          return JSON.parse(savedBets);
        }
      } catch (error) {
        console.error('Erro ao carregar apostas rápidas personalizadas:', error);
      }
    }
    return QUICK_BETS;
  });
  
  // Atualizar a lista de apostas rápidas
  const handleQuickBetsChange = (newBets: number[]) => {
    console.log("Atualizando apostas rápidas:", newBets);
    setCustomQuickBets(newBets);
  };

  // Redirecionar se não estiver autenticado
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login');
    }
  }, [status, router]);
  
  // Check if the user has seen the tutorial before
  useEffect(() => {
    if (status !== 'authenticated') return;
    
    try {
      const tutorialSeen = localStorage.getItem('gameMultiplierTutorialSeen');
      
      if (!tutorialSeen) {
        // Show tutorial after a slight delay to ensure the UI is fully loaded
        const timer = setTimeout(() => {
          setShowTutorial(true);
        }, 1500);
        
        return () => clearTimeout(timer);
      } else {
        setTutorialCompleted(true);
      }
    } catch (error) {
      console.error('Error accessing localStorage:', error);
    }
  }, [status]);
  
  // Verificar eventos sazonais ativos
  useEffect(() => {
    const season = getActiveSeasonalEvent();
    setActiveSeason(season);
    
    // Log para debugging
    if (season) {
      console.log(`Evento sazonal ativo: ${season.name} com tema ${season.theme}`);
    }
  }, []);
  
  // Função para verificar e ativar bônus com base nas condições atuais
  const checkAndActivateBonus = useCallback(() => {
    // Evitar verificação de bônus durante fase de apostas ou se já tiver um bônus ativo
    if (currentPhase !== 'running' || isBonusActive) return;
    
    // Evitar bônus muito frequentes (mínimo 3 rodadas entre bônus)
    if (currentRound - lastBonusRound < 3) return;
    
    // Evitar bônus com multiplicador muito baixo
    if (currentMultiplier < 1.0) return;
    
    // Chance de verificação de bônus (só verifica a cada X frames para otimização)
    if (Math.random() > 0.05) return; // 5% de chance de verificar em cada chamada
    
    // Buscar um bônus aleatório com base nas condições atuais
    const bonus = getRandomBonus(currentRound, currentMultiplier);
    
    if (bonus) {
      console.log(`Bônus ativado: ${bonus.description} com valor ${bonus.value}x`);
      setActiveBonus(bonus);
      setIsBonusActive(true);
      setLastBonusRound(currentRound);
      
      // Desativar o bônus após sua duração
      setTimeout(() => {
        setIsBonusActive(false);
        setActiveBonus(null);
      }, bonus.duration);
    }
  }, [currentPhase, isBonusActive, currentRound, lastBonusRound, currentMultiplier]);

  // Função que obtém ou cria a instância global do socket
  const getOrCreateSocketInstance = useCallback(() => {
    // Se já temos uma instância global válida e conectada, use-a
    if (globalSocketInstance && globalSocketInstance.connected) {
      console.log('Reutilizando instância global do socket:', globalSocketInstance.id);
      return globalSocketInstance;
    }
    
    // Se a instância existe mas não está conectada, descartá-la
    if (globalSocketInstance) {
      console.log('Instância global do socket existe mas não está conectada, criando nova...');
      globalSocketInstance.disconnect();
      globalSocketInstance = null;
    }
    
    // Criar nova instância com configurações melhoradas
    console.log('Criando nova instância global do socket...');
    const newSocket = io({
      path: '/api/socket.io', // Usar o caminho padrão do Socket.IO
      reconnectionAttempts: 10,
      reconnectionDelay: 3000,
      reconnectionDelayMax: 10000,
      timeout: 30000,
      transports: ['websocket', 'polling'],
      forceNew: true,
      autoConnect: true,
      reconnection: true,
      // Usar URL e porta explícitas para evitar problemas com o redirecionamento
      host: window.location.hostname,
      port: window.location.port || (window.location.protocol === 'https:' ? 443 : 80)
    });
    
    // Armazenar globalmente
    globalSocketInstance = newSocket;
    
    // Adicionar log de evento de conexão
    newSocket.on('connect', () => {
      console.log('Socket conectado com sucesso. ID:', newSocket.id);
    });

    newSocket.on('connect_error', (err) => {
      console.error('Erro de conexão do socket:', err);
    });

    newSocket.on('reconnect_attempt', (attempt) => {
      console.log(`Tentativa de reconexão ${attempt}...`);
    });
    
    return newSocket;
  }, []);

  // Configurar os eventos do Socket
  const setupSocketEvents = useCallback((socketClient: Socket) => {
    console.log('Configurando eventos do socket para o jogo...');
    
    // Limpar todos os listeners existentes para evitar duplicação
    const events = [
      'connect', 'disconnect', 'error', 'connect_error',
      'reconnect_attempt', 'reconnect_error', 'reconnect',
      'gamePhaseChange', 'timeUpdate', 'multiplierUpdate', 
      'betPlaced', 'cashOutMade', 'gameStarted', 'gameEnded',
      'playerCount', 'gameState'
    ];
    
    events.forEach(event => {
      socketClient.off(event);
    });
    
    socketClient.on('connect', () => {
      console.log('Conectado ao servidor Socket.IO:', socketClient.id);
      
      // Solicitar o estado atual do jogo ao se conectar
      socketClient.emit('requestGameState');
    });
    
    socketClient.on('gameState', (state: any) => {
      console.log('Estado do jogo recebido:', state, {
        placedBet: !!placedBet,
        currentPhase,
        cashedOut
      });
      
      // Atualizar fase do jogo
      console.log('Atualizando fase do jogo:', state.phase);
      setCurrentPhase(state.phase);
      
      // Converter de milissegundos para segundos corretamente
      if (typeof state.timeLeft === 'number') {
        setTimeLeft(Math.ceil(state.timeLeft / 1000));
        console.log('Tempo restante atualizado para:', Math.ceil(state.timeLeft / 1000), 'segundos');
      }
      
      // Garantir que o multiplicador seja definido apenas se for um número válido
      if (typeof state.multiplier === 'number' && !isNaN(state.multiplier)) {
        setCurrentMultiplier(state.multiplier);
        console.log('Multiplicador atualizado para:', state.multiplier);
      } else {
        console.warn('Recebido multiplicador inválido:', state.multiplier);
      }
      
      setRoundId(state.roundId);
      setAllBets(state.bets || []);
      setPlayerCount(state.connectedPlayers || 1);
      
      // Se o jogo estiver em andamento, verificar se já temos uma aposta
      if (state.phase === 'running') {
        setGameStartTime(Date.now() - (((GAME_PHASE_DURATION * 1000) - state.timeLeft)));
        
        // Verificar se o jogador tem uma aposta nesta rodada
        const playerBet = state.bets?.find((bet: any) => 
          bet.playerId === session?.user?.id || bet.userId === session?.user?.id
        );
        
        if (playerBet && !placedBet) {
          setPlacedBet({
            amount: playerBet.amount,
            timestamp: playerBet.timestamp || Date.now()
          });
        }
      }
    });
    
    socketClient.on('gamePhaseChange', (phase: 'betting' | 'running' | 'ended') => {
      console.log('Mudança de fase:', phase, { 
        placedBet: !!placedBet,
        placedBetDetails: placedBet,
        currentPhase,
        cashedOut
      });
      
      // Se a fase for "running" e tivermos aposta, vamos garantir que não é resetada
      if (phase === 'running' && placedBet) {
        console.log('Fase mudando para running com aposta existente:', placedBet);
      }
      
      setCurrentPhase(phase);
      
      if (phase === 'betting') {
        // Resetar para nova rodada
        setTimeLeft(BETTING_PHASE_DURATION);
        setCurrentMultiplier(INITIAL_MULTIPLIER);
        setPlacedBet(null);
        setCashedOut(false);
        setCashOutMultiplier(null);
        setWinAmount(null);
        setErrorMessage(null);
        refreshBalance();
      } else if (phase === 'running') {
        console.log('Fase mudou para running, verificando apostas');
        setTimeLeft(GAME_PHASE_DURATION);
        setGameStartTime(Date.now());
        setMultiplierHistory([INITIAL_MULTIPLIER]); // Iniciar histórico com valor inicial
      }
    });
    
    socketClient.on('timeUpdate', (time: number) => {
      if (typeof time !== 'number' || isNaN(time)) {
        console.warn('Recebido tempo inválido:', time);
        return;
      }
      
      // Converter de milissegundos para segundos
      const timeInSeconds = Math.ceil(time / 1000);
      console.log('Atualização de tempo:', timeInSeconds, 'segundos (original:', time, 'ms)');
      setTimeLeft(timeInSeconds);
    });
    
    socketClient.on('multiplierUpdate', (multiplier: number) => {
      console.log('Atualização de multiplicador:', multiplier);
      if (typeof multiplier === 'number' && !isNaN(multiplier)) {
        // Calcular o multiplicador final considerando bônus ativos
        let finalMultiplier = multiplier;
        
        // Aplicar bônus ao multiplicador se estiver ativo
        if (isBonusActive && activeBonus) {
          finalMultiplier = applyBonusToMultiplier(multiplier, activeBonus);
          console.log(`Aplicando bônus: ${multiplier} x ${activeBonus.value} = ${finalMultiplier}`);
        }
        
        setCurrentMultiplier(finalMultiplier);
        setMultiplierHistory(prev => [...prev, finalMultiplier]);
        
        // Verificar se deve ativar um novo bônus
        checkAndActivateBonus();
        
        // Animar o botão de CashOut quando o multiplicador estiver alto
        if (finalMultiplier >= 1.5 && placedBet && !cashedOut) {
          const cashOutElement = document.querySelector('.cashout-button');
          if (cashOutElement) {
            cashOutElement.classList.add('animate-pulse');
            if (finalMultiplier >= 1.8) {
              cashOutElement.classList.add('shadow-lg', 'shadow-green-500/50');
            }
          }
        }
      } else {
        console.warn('Recebido multiplicador inválido:', multiplier);
      }
    });
    
    socketClient.on('gameStarted', (data: any) => {
      console.log('Jogo iniciado:', data, {
        placedBet,
        currentPhase,
        cashedOut
      });
      
      // Atualizar dados da rodada
      setRoundId(data.roundId);
      setAllBets(data.bets || []);
      setGameStartTime(Date.now());
      
      // Incrementar o contador de rodadas
      setCurrentRound(prev => prev + 1);
      
      // Atualizar a fase do jogo para 'running'
      console.log('Alterando fase para running ao iniciar jogo');
      setCurrentPhase('running');
      
      // Reiniciar o multiplicador ao iniciar o jogo
      setCurrentMultiplier(INITIAL_MULTIPLIER);
      setMultiplierHistory([INITIAL_MULTIPLIER]);
      
      // Verificar se o jogador tem uma aposta nesta rodada
      if (data.bets) {
        const playerBet = data.bets.find((bet: any) => 
          bet.playerId === session?.user?.id || bet.userId === session?.user?.id
        );
        
        if (playerBet) {
          console.log('Jogador tem aposta para a rodada atual:', playerBet);
        }
      }
    });
    
    socketClient.on('gameEnded', (data: any) => {
      console.log('Jogo finalizado:', data);
      const finalMultiplier = data.finalMultiplier;
      
      // Adicionar resultado ao histórico
      setLastResults(prev => [
        { multiplier: finalMultiplier, timestamp: Date.now() },
        ...prev.slice(0, 9)
      ]);
      
      // Processar resultado para o jogador (sempre ganha o valor multiplicado)
      if (placedBet && !cashedOut) {
        // Calcular ganho (independente do multiplicador ser < 1.0)
        const winningAmount = placedBet.amount * finalMultiplier;
        console.log('Processando resultado final:', {
          placedBet: placedBet.amount,
          multiplicador: finalMultiplier,
          ganho: winningAmount
        });
        
        // Definir o valor ganho para exibição
        setWinAmount(winningAmount);
        
        // Atualizar saldo do usuário
        updateBalance(userBalance + winningAmount);
      }
      
      // Atualizar saldo de qualquer forma
      refreshBalance();
    });
    
    socketClient.on('betPlaced', (bet: any) => {
      console.log('Nova aposta recebida:', bet, {
        currentUserId: session?.user?.id,
        isCurrentUser: bet.playerId === session?.user?.id || bet.userId === session?.user?.id,
        placedBet,
        currentPhase
      });
      setAllBets(prev => [...prev, bet]);
      
      // Se a aposta é do jogador atual, atualizar o estado
      if (bet.playerId === session?.user?.id || bet.userId === session?.user?.id) {
        console.log('Atualizando estado para aposta feita pelo jogador atual');
        setPlacedBet({
          amount: bet.amount,
          timestamp: bet.timestamp || Date.now()
        });
        
        // Atualizar saldo
        updateBalance(userBalance - bet.amount);
      }
    });
    
    socketClient.on('cashOutMade', (data: any) => {
      console.log('CashOut recebido:', data, {
        currentUserId: session?.user?.id,
        isCurrentUser: data.playerId === session?.user?.id || data.userId === session?.user?.id,
        placedBet,
        currentPhase
      });
      
      // Se o cashout é do jogador atual
      if (data.playerId === session?.user?.id || data.userId === session?.user?.id) {
        console.log('Atualizando estado para cash-out realizado');
        setCashedOut(true);
        setCashOutMultiplier(data.multiplier);
        
        // Calcular ganho e atualizar saldo
        if (placedBet) {
          const winningAmount = placedBet.amount * data.multiplier;
          setWinAmount(winningAmount);
          updateBalance(userBalance + winningAmount);
        }
      }
    });
    
    socketClient.on('playerCount', (count: number) => {
      console.log('Atualização de jogadores conectados:', count);
      setPlayerCount(count);
    });
    
    socketClient.on('disconnect', () => {
      console.log('Desconectado do servidor Socket.IO');
    });
    
    socketClient.on('error', (error: any) => {
      console.error('Erro do Socket.IO:', error);
    });
  }, [refreshBalance, session?.user?.id, placedBet, cashedOut, userBalance, updateBalance, checkAndActivateBonus]);

  // Inicializa o servidor Socket.IO
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
  }, [getOrCreateSocketInstance, setupSocketEvents]);

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

  // Configurar socket após inicialização
  useEffect(() => {
    if (!socketInitialized) return;
    
    console.log('Socket inicializado, configurando conexão...');
    
    const socketInstance = getOrCreateSocketInstance();
    socketRef.current = socketInstance;
    setSocket(socketInstance);
    
    setupSocketEvents(socketInstance);
    
    console.log('Socket configurado com sucesso.');
    
    // Solicitar estado do jogo após configuração
    if (socketInstance.connected) {
      console.log('Socket já conectado, solicitando estado do jogo');
      socketInstance.emit('requestGameState');
    } else {
      console.log('Socket não conectado, aguardando conexão...');
      socketInstance.connect();
      
      // Definir um temporizador para verificar a conexão
      const connectionTimer = setTimeout(() => {
        if (!socketInstance.connected) {
          console.warn('Socket não conectou dentro do tempo esperado, tentando reconectar...');
          socketInstance.disconnect();
          socketInstance.connect();
        }
      }, 5000);
      
      return () => clearTimeout(connectionTimer);
    }
    
    return () => {
      // Não desconectar aqui para manter a conexão entre navegações
    };
  }, [socketInitialized, getOrCreateSocketInstance, setupSocketEvents]);
  
  // Declaração de referência à função de aposta (será definida abaixo)
  const placeBetRef = useRef<(customAmount?: number) => Promise<boolean>>();
  
  // Referência à função de parar apostas automáticas (inicializada antes da função)
  const stopAutoBettingRef = useRef<() => void>();
  
  // Processar resultado da rodada e preparar próxima aposta automática
  useEffect(() => {
    // Só executa quando a fase muda para "betting" e estamos em modo de apostas automáticas
    // Verifica também se já temos uma aposta colocada para evitar apostas duplicadas
    if (currentPhase !== 'betting' || !isAutoBetting || !autoBetManagerRef.current || placedBet) {
      // Se temos uma aposta e estamos na fase de apostas, não tente fazer outra aposta
      if (currentPhase === 'betting' && placedBet && isAutoBetting) {
        console.log('Já existe uma aposta nesta rodada, aguardando próxima rodada para aposta automática');
      }
      return;
    }
    
    console.log('Processando resultado da rodada para apostas automáticas');
    
    try {
      // Processa o resultado da rodada anterior, se tiver ocorrido
      if (winAmount !== null && !cashedOut) {
        const lossAmount = winAmount < 0 ? Math.abs(winAmount) : 0;
        
        // Registrar perda se não fez cashout
        const result: BetResult = {
          won: false,
          amount: lossAmount,
          multiplier: 0
        };
        
        autoBetManagerRef.current.processRoundResult(result);
        
        // Atualizar estatísticas
        const stats = autoBetManagerRef.current.getStats();
        setAutoBetStats({
          totalWon: stats.totalWon,
          totalLost: stats.totalLost,
          netResult: stats.netResult,
          roundsRemaining: stats.roundsRemaining
        });
      }
      
      // Verificar se deve continuar apostando
      if (autoBetManagerRef.current.shouldContinueBetting()) {
        try {
          // Calcular o valor da próxima aposta
          let nextBetAmount = autoBetManagerRef.current.getNextBetAmount();
          
          // Garantir que o valor é um número válido
          nextBetAmount = Number(nextBetAmount);
          
          // Arredondar para 2 casas decimais
          nextBetAmount = Math.floor(nextBetAmount * 100) / 100;
          
          console.log('Valor calculado para próxima aposta automática:', nextBetAmount);
          
          if (isNaN(nextBetAmount) || !isFinite(nextBetAmount) || nextBetAmount <= 0) {
            console.error('Valor inválido para próxima aposta automática:', nextBetAmount);
            setErrorMessage('Valor de aposta automática inválido. Modo automático desativado.');
            if (stopAutoBettingRef.current) {
              stopAutoBettingRef.current();
            }
            return;
          }
          
          // Verificar limites das apostas
          if (nextBetAmount < MIN_BET_AMOUNT) {
            console.log(`Ajustando valor de aposta automática para mínimo (${MIN_BET_AMOUNT})`);
            nextBetAmount = MIN_BET_AMOUNT;
          } else if (nextBetAmount > MAX_BET_AMOUNT) {
            console.log(`Ajustando valor de aposta automática para máximo (${MAX_BET_AMOUNT})`);
            nextBetAmount = MAX_BET_AMOUNT;
          }
          
          // Verificar se o valor da aposta é maior que o saldo disponível
          if (nextBetAmount > userBalance) {
            console.error('Saldo insuficiente para próxima aposta automática:', {
              nextBetAmount,
              userBalance
            });
            setErrorMessage('Saldo insuficiente para continuar apostas automáticas');
            if (stopAutoBettingRef.current) {
              stopAutoBettingRef.current();
            }
            return;
          }
          
          // Adicionar um pequeno atraso para garantir que a interface foi atualizada
          setTimeout(() => {
            // Verificar novamente se a fase ainda é "betting" e se ainda não temos uma aposta colocada
            if (currentPhase === 'betting' && !placedBet && isAutoBetting) {
              console.log(`Fazendo próxima aposta automática: R$ ${nextBetAmount.toFixed(2)}`);
              if (placeBetRef.current) {
                placeBetRef.current(nextBetAmount)
                  .then(success => {
                    if (!success) {
                      console.error('Falha ao fazer aposta automática');
                    }
                  })
                  .catch(error => {
                    console.error('Erro ao fazer aposta automática:', error);
                  });
              } else {
                console.error('Referência à função placeBet não disponível');
              }
            } else {
              console.log('Condições mudaram, não fazendo aposta automática:', {
                fase: currentPhase,
                jaTemAposta: !!placedBet,
                autoMode: isAutoBetting
              });
            }
          }, 500);
        } catch (error) {
          console.error('Erro ao calcular próxima aposta automática:', error);
          setErrorMessage('Erro ao calcular próxima aposta automática');
          if (stopAutoBettingRef.current) {
            stopAutoBettingRef.current();
          }
        }
      } else {
        // Parar apostas automáticas se atingiu o fim
        console.log('Apostas automáticas finalizadas');
        if (stopAutoBettingRef.current) {
          stopAutoBettingRef.current();
        } else {
          console.error('Referência à função stopAutoBetting não disponível');
          // Forçar parada mesmo sem a referência
          setIsAutoBetting(false);
          setAutoBetSettings(null);
        }
      }
    } catch (error) {
      console.error('Erro ao processar aposta automática:', error);
      // Garantir que as apostas automáticas são interrompidas em caso de erro
      setIsAutoBetting(false);
      setAutoBetSettings(null);
      setErrorMessage('Erro ao processar apostas automáticas. Modo automático desativado.');
    }
  }, [currentPhase, isAutoBetting, cashedOut, winAmount, placedBet, userBalance]);
  // Removemos stopAutoBetting da lista de dependências para evitar referência cíclica

  // Referência à função doCashOut
  const doCashOutRef = useRef<(isAuto?: boolean) => Promise<boolean>>();
  
  // Verificar periodicamente se o multiplicador está sendo atualizado
  // e verificar critérios para cash out automático
  useEffect(() => {
    if (currentPhase !== 'running') return;
    
    let lastMultiplierUpdate = Date.now();
    let staleCheckInterval: NodeJS.Timeout;
    
    // Verificar se o multiplicador está sendo atualizado e monitorar para cash out automático
    staleCheckInterval = setInterval(() => {
      const timeSinceLastUpdate = Date.now() - lastMultiplierUpdate;
      
      // Verificar se deve realizar cash out automático
      if (isAutoBetting && 
          autoBetManagerRef.current && 
          placedBet && 
          !cashedOut && 
          typeof currentMultiplier === 'number' && 
          !isNaN(currentMultiplier) && 
          currentMultiplier > 0) {
        
        try {
          // Verificar se atendemos ao critério para cash out automático
          const shouldMakeCashOut = autoBetManagerRef.current.shouldCashOut(currentMultiplier);
          
          if (shouldMakeCashOut) {
            console.log(`Realizando cash out automático em ${currentMultiplier.toFixed(2)}x`);
            
            // Verificar se temos a referência à função de cash out
            if (doCashOutRef.current) {
              doCashOutRef.current(true)
                .then(success => {
                  if (success) {
                    console.log('Cash out automático realizado com sucesso');
                  } else {
                    console.error('Falha ao realizar cash out automático');
                  }
                })
                .catch(error => {
                  console.error('Erro ao tentar fazer cash out automático:', error);
                });
            } else {
              console.error('Referência à função doCashOut não disponível para cash out automático');
            }
          }
        } catch (error) {
          console.error('Erro ao verificar critérios de cash out automático:', error);
        }
      }
      
      // Se não houver atualização por mais de 5 segundos durante o jogo, tentar reconectar
      if (timeSinceLastUpdate > 5000 && socketRef.current) {
        console.warn('Multiplicador não atualizado por 5 segundos, reconectando...');
        
        // Solicitar estado do jogo novamente
        socketRef.current.emit('requestGameState');
        
        // Atualizar timestamp para evitar múltiplas reconexões
        lastMultiplierUpdate = Date.now();
      }
    }, 200); // Reduzido para 200ms para verificar cash out mais frequentemente
    
    // Atualizar o timestamp sempre que o multiplicador mudar
    if (typeof currentMultiplier === 'number' && !isNaN(currentMultiplier)) {
      lastMultiplierUpdate = Date.now();
    }
    
    return () => {
      clearInterval(staleCheckInterval);
    };
  }, [currentPhase, currentMultiplier, isAutoBetting, placedBet, cashedOut, userBalance]);

  // Iniciar um intervalo para verificar a conexão periodicamente
  useEffect(() => {
    if (!socketInitialized || !socket) return;
    
    console.log('Configurando verificação periódica de conexão do socket...');
    
    const checkConnectionInterval = setInterval(() => {
      if (socket && !socket.connected) {
        console.log('Socket desconectado, tentando reconectar...');
        socket.connect();
      }
    }, 10000); // Verificar a cada 10 segundos
    
    return () => {
      clearInterval(checkConnectionInterval);
    };
  }, [socket, socketInitialized]);

  // Adicionando eventos de debug para o socket
  useEffect(() => {
    if (!socket) return;
    
    const onConnectError = (error: Error) => {
      console.error('Erro de conexão Socket.IO:', error);
    };
    
    const onReconnect = (attempt: number) => {
      console.log(`Socket.IO reconectado após ${attempt} tentativas!`);
      
      // Solicitar estado atual do jogo após reconexão
      socket.emit('requestGameState');
    };
    
    socket.on('connect_error', onConnectError);
    socket.on('reconnect', onReconnect);
    
    return () => {
      socket.off('connect_error', onConnectError);
      socket.off('reconnect', onReconnect);
    };
  }, [socket]);

  // Função para fazer apostas
  const placeBet = async (customAmount?: number) => {
    // Atualizar referência à função
    if (placeBetRef.current !== placeBet) {
      placeBetRef.current = placeBet;
    }
    
    // Log para depuração
    console.log('Iniciando aposta:', {
      customAmount: customAmount,
      betAmount: betAmount,
      fase: currentPhase,
      jaApostou: !!placedBet
    });
    
    // Determinar valor da aposta
    let amountToUse: number;
    
    if (customAmount !== undefined) {
      amountToUse = Number(customAmount);
    } else {
      amountToUse = Number(betAmount);
    }
    
    // Verificações básicas
    if (currentPhase !== 'betting' || placedBet) {
      setErrorMessage('Não é possível apostar neste momento');
      return false;
    }
    
    if (isNaN(amountToUse) || !isFinite(amountToUse)) {
      setErrorMessage('Valor de aposta inválido. Por favor, tente novamente.');
      if (isAutoBetting && stopAutoBettingRef.current) stopAutoBettingRef.current();
      return false;
    }
    
    // Formatação com precisão de 2 casas
    amountToUse = Math.floor(amountToUse * 100) / 100;
    
    // Verificar limites
    if (amountToUse < MIN_BET_AMOUNT) {
      setErrorMessage(`Valor mínimo de aposta é R$ ${MIN_BET_AMOUNT.toFixed(2)}`);
      return false;
    }
    
    if (amountToUse > MAX_BET_AMOUNT) {
      setErrorMessage(`Valor máximo de aposta é R$ ${MAX_BET_AMOUNT.toFixed(2)}`);
      return false;
    }
    
    if (amountToUse > userBalance) {
      setErrorMessage('Saldo insuficiente para realizar esta aposta');
      if (isAutoBetting && stopAutoBettingRef.current) {
        stopAutoBettingRef.current();
        setErrorMessage('Apostas automáticas interrompidas: saldo insuficiente');
      }
      return false;
    }
    
    if (!roundId) {
      setErrorMessage('ID da rodada não disponível. Aguarde o início da próxima rodada.');
      return false;
    }
    
    // Preparação para envio
    setIsLoading(true);
    setErrorMessage(null);
    
    try {
      // Preparar dados da aposta
      const betData = {
        amount: Number(amountToUse.toFixed(2)),
        gameType: 'multiplicador',
        roundId: String(roundId || '')
      };
      
      // Serializar e enviar
      const jsonPayload = JSON.stringify(betData);
      console.log('Dados da aposta:', jsonPayload);
      
      const response = await fetch('/api/games/place-bet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: jsonPayload
      });
      
      // Processar resposta
      let responseData;
      try {
        responseData = await response.json();
      } catch (error) {
        console.error('Erro ao processar resposta:', error);
        const textResponse = await response.text();
        console.error('Resposta bruta:', textResponse);
        setErrorMessage('Erro ao processar resposta do servidor');
        return false;
      }
      
      // Tratar resultado
      if (response.ok) {
        console.log('APOSTA REALIZADA COM SUCESSO:', {
          amountToUse,
          timestamp: Date.now(),
          userBalance,
          roundId,
          currentPhase,
          responseData
        });
        
        // Sucesso - atualizar estado
        if (socketRef.current && socketRef.current.connected) {
          socketRef.current.emit('placeBet', {
            amount: amountToUse,
            timestamp: Date.now()
          });
          console.log('Aposta enviada via Socket.IO');
        } 
        
        // Sempre definir o estado localmente também para garantir que a interface é atualizada
        console.log('Definindo placedBet localmente e atualizando saldo do usuário');
        setPlacedBet({
          amount: amountToUse,
          timestamp: Date.now()
        });
        
        // Atualizar o saldo local com o valor da resposta do servidor, caso disponível
        let newBalance = userBalance - amountToUse;
        
        // Se o servidor retornou um novo saldo, usar esse valor
        if (responseData && responseData.newBalance !== undefined) {
          console.log('Servidor retornou novo saldo:', responseData.newBalance);
          newBalance = responseData.newBalance;
        } else {
          console.log('Servidor não retornou saldo, usando cálculo local');
        }
        
        // Atualizar o saldo local e forçar um refresh para garantir sincronização
        updateBalance(newBalance);
        setTimeout(refreshBalance, 500); // Fazer um refresh do saldo após 500ms
        
        console.log('Saldo atualizado após aposta:', {
          valorAposta: amountToUse,
          saldoAnterior: userBalance,
          novoSaldo: newBalance
        });
        return true;
      } else {
        // Falha - mostrar erro
        console.error('Erro na aposta:', responseData);
        setErrorMessage(responseData.message || 'Falha ao realizar aposta');
        if (isAutoBetting) stopAutoBetting();
        return false;
      }
    } catch (error) {
      // Tratamento de erros gerais
      console.error('Exceção na aposta:', error);
      setErrorMessage('Erro ao fazer aposta. Tente novamente.');
      if (isAutoBetting && stopAutoBettingRef.current) stopAutoBettingRef.current();
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Função para realizar CashOut
  const doCashOut = async (isAuto: boolean = false) => {
    // Armazenar a referência à função para uso em efeitos
    if (doCashOutRef.current !== doCashOut) {
      doCashOutRef.current = doCashOut;
    }
    if (!placedBet || currentPhase !== 'running' || cashedOut) {
      console.warn('Tentativa de CashOut inválida:', { 
        temAposta: !!placedBet, 
        fase: currentPhase, 
        jáFezCashOut: cashedOut 
      });
      return false;
    }
    
    // Verificar se o multiplicador é válido
    if (typeof currentMultiplier !== 'number' || isNaN(currentMultiplier) || currentMultiplier <= 0) {
      console.error('Multiplicador inválido para CashOut:', currentMultiplier);
      setErrorMessage('Multiplicador inválido. Tente novamente.');
      return false;
    }
    
    setIsLoading(true);
    setErrorMessage(null);
    
    try {
      // Usar o multiplicador atual para o CashOut
      const safeMultiplier = currentMultiplier;
      console.log(`Realizando CashOut ${isAuto ? 'automático' : ''} com multiplicador:`, safeMultiplier);
      
      // Verificar se todos os valores são válidos antes de prosseguir
      if (safeMultiplier === null || isNaN(Number(safeMultiplier)) || 
          !roundId || !placedBet || isNaN(Number(placedBet.amount))) {
        console.error('Valores inválidos para cash out:', { 
          safeMultiplier, 
          roundId, 
          placedBetAmount: placedBet?.amount 
        });
        setErrorMessage('Erro ao processar cash out: valores inválidos');
        setIsLoading(false);
        return false;
      }
      
      // Solução definitiva para o problema de serialização circular:
      // 1. Criar variáveis primitivas explícitas com validação
      const multiplierValue = Number(safeMultiplier); // Garantir que é um número puro
      const roundIdString = String(roundId || ''); // Garantir que é uma string pura
      const betAmountValue = Number(placedBet.amount); // Garantir que é um número puro
      
      // Verificação adicional para garantir que não temos NaN
      if (isNaN(multiplierValue) || isNaN(betAmountValue)) {
        console.error('Valores NaN detectados para cash out:', { multiplierValue, betAmountValue });
        setErrorMessage('Erro ao processar cash out: valores inválidos');
        setIsLoading(false);
        return false;
      }
      
      // 2. Criar string JSON manualmente, sem usar stringify em objetos complexos
      const jsonPayload = `{"multiplier":${multiplierValue},"roundId":"${roundIdString}","betAmount":${betAmountValue}}`;
      console.log('JSON payload do cash out criado manualmente:', jsonPayload);
      
      const response = await fetch('/api/games/cash-out', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: jsonPayload,
      });
      
      const responseData = await response.json();
      
      if (response.ok) {
        console.log('CashOut feito com sucesso via API:', responseData);
        
        // Enviar cashout via Socket.IO
        if (socketRef.current) {
          socketRef.current.emit('cashOut', {
            multiplier: safeMultiplier,
            timestamp: Date.now()
          });
          console.log('CashOut enviado via Socket.IO');
        } else {
          console.warn('Socket não disponível para enviar CashOut');
        }
        
        // Atualizar estado local
        setCashedOut(true);
        setCashOutMultiplier(safeMultiplier);
        
        // Calcular ganho e atualizar saldo
        const winningAmount = placedBet.amount * safeMultiplier;
        setWinAmount(winningAmount);
        updateBalance(userBalance + winningAmount);
        
        // Processar resultado em caso de apostas automáticas
        if (isAutoBetting && autoBetManagerRef.current) {
          try {
            // Garantir que winningAmount é um número válido
            const safeWinningAmount = isNaN(winningAmount) ? 0 : winningAmount;
            
            const result: BetResult = {
              won: true,
              amount: safeWinningAmount,
              multiplier: safeMultiplier
            };
            
            console.log('Processando resultado de cash out automático:', result);
            autoBetManagerRef.current.processRoundResult(result);
            
            // Atualizar estatísticas
            const stats = autoBetManagerRef.current.getStats();
            setAutoBetStats({
              totalWon: stats.totalWon,
              totalLost: stats.totalLost,
              netResult: stats.netResult,
              roundsRemaining: stats.roundsRemaining
            });
            
            // Verificar se deve continuar apostando
            if (!autoBetManagerRef.current.shouldContinueBetting()) {
              console.log('Atingido critério de parada após cash out, parando apostas automáticas');
              if (stopAutoBettingRef.current) {
                stopAutoBettingRef.current();
              } else {
                // Fallback se a referência não estiver disponível
                setIsAutoBetting(false);
                setAutoBetSettings(null);
              }
            } else {
              console.log('Continuando apostas automáticas após cash out com sucesso');
            }
          } catch (error) {
            console.error('Erro ao processar resultado do cash out automático:', error);
            // Em caso de erro, parar as apostas automáticas para segurança
            setIsAutoBetting(false);
            setAutoBetSettings(null);
          }
        }
        
        // Mostrar mensagem de sucesso
        if (!isAuto) {
          const cashOutElement = document.querySelector('.cashout-button');
          if (cashOutElement) {
            cashOutElement.classList.add('animate-pulse', 'bg-green-600');
            setTimeout(() => {
              cashOutElement.classList.remove('animate-pulse', 'bg-green-600');
            }, 1500);
          }
        }
        
        return true;
      } else {
        console.error('Erro ao fazer CashOut:', responseData);
        setErrorMessage(`Erro: ${responseData.message || 'Falha ao realizar CashOut'}`);
        return false;
      }
    } catch (error) {
      // Tratamento especial para erros de circularidade JSON
      if (error instanceof TypeError && error.message.includes('circular structure to JSON')) {
        console.error('Erro de estrutura circular ao serializar JSON no CashOut:', error);
        setErrorMessage('Erro interno ao processar o cash out. Tente novamente.');
      } else {
        console.error('Exceção ao fazer CashOut:', error);
        setErrorMessage('Erro ao fazer CashOut. Tente novamente.');
      }
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  // Tutorial handlers
  const handleTutorialComplete = useCallback(() => {
    try {
      localStorage.setItem('gameMultiplierTutorialSeen', 'true');
      setShowTutorial(false);
      setTutorialCompleted(true);
    } catch (error) {
      console.error('Error saving tutorial state:', error);
    }
  }, []);
  
  const handleTutorialSkip = useCallback(() => {
    try {
      localStorage.setItem('gameMultiplierTutorialSeen', 'true');
      setShowTutorial(false);
      setTutorialCompleted(true);
    } catch (error) {
      console.error('Error saving tutorial state:', error);
    }
  }, []);
  
  // Toggle tooltips
  const toggleTooltips = useCallback(() => {
    setTooltipsEnabled(prev => !prev);
    try {
      localStorage.setItem('gameMultiplierTooltipsEnabled', String(!tooltipsEnabled));
    } catch (error) {
      console.error('Error saving tooltips preference:', error);
    }
  }, [tooltipsEnabled]);
  
  // Handler para log de mudança do modo de apostas automáticas
  const handleAutoModeChange = useCallback((isAuto: boolean) => {
    // Usado apenas para fins de log
    console.log(`Modo de apostas automáticas ${isAuto ? 'ativado' : 'desativado'}`);
  }, []);
  
  // Referência à função de iniciar apostas automáticas
  const startAutoBettingRef = useRef<(settings: AutoBetSettings) => void>();
  
  // Start auto-betting with the given settings
  const startAutoBetting = useCallback((settings: AutoBetSettings) => {
    // Atualizar a própria referência
    startAutoBettingRef.current = startAutoBetting;
    
    console.log('Iniciando apostas automáticas com configuração:', settings);
    
    // Criar uma nova instância do gerenciador de apostas automáticas
    const manager = new AutoBetManager(settings);
    manager.start();
    
    // Armazenar referência e configuração
    autoBetManagerRef.current = manager;
    setAutoBetSettings(settings);
    setIsAutoBetting(true);
    
    // Inicializar estatísticas
    setAutoBetStats({
      totalWon: 0,
      totalLost: 0,
      netResult: 0,
      roundsRemaining: settings.rounds
    });
  }, []);
  
  // Stop auto-betting
  const stopAutoBetting = useCallback(() => {
    // Atualizar a própria referência para evitar problemas de referência cíclica
    stopAutoBettingRef.current = stopAutoBetting;
    
    if (autoBetManagerRef.current) {
      console.log('Parando apostas automáticas');
      autoBetManagerRef.current.stop();
      
      // Atualizar estatísticas finais
      const stats = autoBetManagerRef.current.getStats();
      setAutoBetStats({
        totalWon: stats.totalWon,
        totalLost: stats.totalLost,
        netResult: stats.netResult,
        roundsRemaining: stats.roundsRemaining
      });
    }
    
    setIsAutoBetting(false);
    setAutoBetSettings(null);
  }, []);
  
  // Calcular a cor do multiplicador com base no valor
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
  
  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Tutorial Component */}
      <GameTutorial 
        isVisible={showTutorial}
        onComplete={handleTutorialComplete}
        onSkip={handleTutorialSkip}
      />
      
      {/* Help & Tooltips Buttons */}
      <div className="fixed bottom-4 right-4 z-50 flex space-x-3">
        <Button
          variant="secondary"
          className={`rounded-full w-12 h-12 flex items-center justify-center ${
            tooltipsEnabled ? 'bg-blue-500 hover:bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'
          } shadow-lg transition-all duration-300`}
          onClick={toggleTooltips}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </Button>
        
        <Button
          variant="secondary"
          className="rounded-full w-12 h-12 flex items-center justify-center bg-[#3bc37a] hover:bg-[#2bb167] shadow-lg"
          onClick={() => setShowTutorial(true)}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </Button>
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
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Área principal do jogo */}
        <Card variant="bordered" className="md:col-span-2 border border-gray-800 bg-gradient-to-b from-[#121212] to-[#0c0c0c] shadow-xl overflow-hidden h-full">
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
                
                {/* Indicador de evento sazonal ativo */}
                {activeSeason && (
                  <span className="ml-2 text-sm px-2 py-1 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-300 animate-pulse">
                    {activeSeason.name} Event
                  </span>
                )}
                
                {/* Indicador de apostas automáticas */}
                {isAutoBetting && (
                  <span className="ml-2 text-sm px-2 py-1 rounded-full bg-blue-500/20 border border-blue-500/30 text-blue-300 animate-custom-pulse">
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
                    <div className={`text-6xl font-bold transition-all duration-300 animate-scaleIn ${
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
                  <div className="absolute top-4 right-4 bg-black/80 backdrop-blur-sm rounded-lg px-4 py-2 border border-green-500/40 z-20 shadow-lg shadow-green-500/10 animate-slideInRight">
                    <div className="text-green-500 font-bold animate-fadeIn">
                      Cash Out em {cashOutMultiplier.toFixed(2)}x
                    </div>
                    <div className="text-white animate-fadeIn delay-200">
                      Ganho: R$ {((placedBet?.amount || 0) * cashOutMultiplier).toFixed(2)}
                    </div>
                  </div>
                )}
                
                {/* Resultado final */}
                {currentPhase === 'ended' && winAmount !== null && !cashedOut && (
                  <div className="absolute top-4 right-4 bg-black/80 backdrop-blur-sm rounded-lg px-4 py-2 border border-red-500/40 z-20 shadow-lg shadow-red-500/10 animate-slideInRight">
                    <div className={`${winAmount > 0 ? "text-green-500 font-bold" : "text-red-500 font-bold"} animate-fadeIn`}>
                      {winAmount > 0 ? 'Você ganhou!' : 'Você perdeu!'}
                    </div>
                    <div className="text-white animate-fadeIn delay-200">
                      {Math.abs(winAmount).toFixed(2)} reais
                    </div>
                  </div>
                )}

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
              </div>
            </div>
            
            {/* Área de apostas */}
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
                    <div className="animate-fadeIn delay-500">
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
                      // Validação adicional antes de chamar placeBet
                      if (betAmount && !isNaN(Number(betAmount)) && betAmount >= MIN_BET_AMOUNT && betAmount <= userBalance) {
                        placeBet();
                      } else {
                        setErrorMessage('Valor de aposta inválido. Verifique o valor e tente novamente.');
                      }
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
          <div className="px-4 pb-6 pt-2 border-t border-gray-800/50 bg-[#0c0c0c] last-results">
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
        <div className="space-y-6">
          {/* Cartão de informações financeiras */}
          <Card variant="bordered" className="border border-gray-800 bg-[#0f0f0f] shadow-lg">
            <CardHeader className="p-4 border-b border-gray-800/40">
              <CardTitle>Seu Saldo</CardTitle>
              <CardDescription>Informações da sua conta</CardDescription>
            </CardHeader>
            <CardContent className="p-4">
              <div className="mb-6">
                <p className="text-sm text-gray-400 mb-1">Saldo Disponível</p>
                <p className="text-3xl font-bold bg-gradient-to-r from-[#1a86c7] to-[#3bc37a] bg-clip-text text-transparent">
                  R$ {userBalance.toFixed(2)}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-400 mb-1">Limite Diário de Apostas</p>
                <div className="w-full bg-gray-800 rounded-full h-2.5">
                  <div
                    className={`h-2.5 rounded-full ${
                      (placedBet?.amount || 0) / DAILY_BET_LIMIT > 0.8
                        ? 'bg-red-500'
                        : (placedBet?.amount || 0) / DAILY_BET_LIMIT > 0.5
                          ? 'bg-yellow-500'
                          : 'bg-green-500'
                    }`}
                    style={{
                      width: `${Math.min(100, ((placedBet?.amount || 0) / DAILY_BET_LIMIT) * 100)}%`,
                    }}
                  ></div>
                </div>
                <div className="flex justify-between text-xs mt-1">
                  <span className="text-gray-400">
                    R$ {(placedBet?.amount || 0).toFixed(2)}
                  </span>
                  <span className="text-gray-400">
                    R$ {DAILY_BET_LIMIT.toFixed(2)}
                  </span>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between gap-2 p-4 border-t border-gray-800/40">
              <Button variant="primary" onClick={() => router.push('/profile')} className="flex-1">
                Ver Perfil
              </Button>
              <Button variant="secondary" onClick={() => router.push('/new-interface')} className="flex-1">
                Voltar
              </Button>
            </CardFooter>
          </Card>
          
          {/* Níveis e Recompensas */}
          <LevelCard />
          
          {/* Players Online */}
          <PlayerCountCard />
          
          {/* Card de Chat de Suporte */}
          <Card variant="bordered" className={`border ${hasNewMessages ? 'border-indigo-500/50 shadow-md shadow-indigo-500/10' : 'border-gray-800'} bg-gradient-to-b from-[#0f0f0f] to-[#131320] overflow-hidden transition-all duration-300`}>
            <div 
              className="cursor-pointer relative" 
              onClick={() => {
                setShowChat(true);
                // Se houver novas mensagens e o chat for aberto, marcar como lidas
                if (hasNewMessages) {
                  setHasNewMessages(false);
                }
              }}
            >
              {/* Indicador de nova mensagem no topo direito */}
              {hasNewMessages && (
                <div className="absolute top-2 right-2 z-10 flex items-center justify-center">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-ping absolute opacity-75"></span>
                  <span className="w-2 h-2 rounded-full bg-green-500 relative"></span>
                </div>
              )}
              
              <CardHeader className={`p-4 border-b ${hasNewMessages ? 'border-indigo-500/30 bg-gradient-to-r from-[#0f0f1a] to-[#131326]' : 'border-gray-800/40'} transition-all duration-300`}>
                <div className="flex justify-between items-center">
                  <CardTitle className="flex items-center">
                    <span className={`inline-block w-2 h-2 rounded-full mr-2 ${hasNewMessages ? 'bg-green-500' : 'bg-gray-500'}`}></span>
                    Chat de Suporte
                    {hasNewMessages && (
                      <span className="ml-2 text-xs bg-green-600 text-white px-1.5 py-0.5 rounded-full animate-pulse">
                        Nova
                      </span>
                    )}
                  </CardTitle>
                  <div className="bg-indigo-500/10 rounded-full p-1">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                </div>
                <CardDescription className={hasNewMessages ? 'text-indigo-300' : 'text-gray-400'}>
                  {hasNewMessages ? 'Nova mensagem de suporte disponível!' : 'Precisa de ajuda? Fale com nosso suporte!'}
                </CardDescription>
              </CardHeader>
            </div>
          </Card>

          {/* Card removido - Apostas Automáticas */}

          {/* Card removido - Como Jogar */}
          
          {/* Card removido - Apostas Atuais */}
        </div>
      </div>

      {/* Chat flutuante - aparece quando showChat é true */}
      {showChat && (
        <div 
          className="fixed z-50 right-4 bottom-4 md:right-6 md:bottom-6 lg:right-8 lg:bottom-8 flex items-end"
          style={{ 
            width: 'calc(100% - 2rem)',
            maxWidth: '400px',
            height: 'min(600px, calc(100vh - 6rem))',
            filter: 'drop-shadow(0 20px 13px rgba(0, 0, 0, 0.4)) drop-shadow(0 8px 5px rgba(79, 70, 229, 0.1))',
            animation: 'fadeInUp 0.3s ease-out',
          }}
        >
          <FloatingChat 
            isOpen={showChat}
            onClose={() => setShowChat(false)}
            onNewMessage={(hasNew) => setHasNewMessages(hasNew)}
          />
        </div>
      )}
    </div>
  );
} 