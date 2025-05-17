'use client';

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import { useSession } from 'next-auth/react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useRouter } from 'next/navigation';
import { useBalance } from '@/lib/BalanceContext';
import Image from 'next/image';
import { io, Socket } from 'socket.io-client';
import ChatSupport from '@/components/ChatSupport';
import LastResults from '@/components/LastResults';
import LevelCard from '@/components/LevelCard';
import SimpleAreaChart from '@/components/SimpleAreaChart';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  ReferenceLine,
} from 'recharts';

// Constantes do jogo
const MIN_BET_AMOUNT = 5; // Aposta mínima: R$ 5,00
const MAX_BET_AMOUNT = 1000; // Aposta máxima: R$ 1000,00
const DAILY_BET_LIMIT = 15000; // Limite diário: R$ 15000,00
const BETTING_PHASE_DURATION = 5; // 5 segundos para apostas
const GAME_PHASE_DURATION = 20; // 20 segundos para a rodada
const INITIAL_MULTIPLIER = 1.0; // Multiplicador inicial
const MAX_MULTIPLIER = 2.0; // Multiplicador máximo
const MIN_MULTIPLIER = 0.0; // Multiplicador mínimo
const WIN_MULTIPLIER = 2.0; // Multiplicador fixo de ganho

// Variável global para armazenar a única instância do socket
let globalSocketInstance: Socket | null = null;
let isInitializingSocket = false;

export default function NovaInterface() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { userBalance, updateBalance, refreshBalance } = useBalance();

  // Estados do jogo Multiplicador
  const [currentPhase, setCurrentPhase] = useState<
    'betting' | 'running' | 'ended'
  >('betting');
  const [timeLeft, setTimeLeft] = useState(BETTING_PHASE_DURATION);
  const [currentMultiplier, setCurrentMultiplier] =
    useState(INITIAL_MULTIPLIER);
  const [multiplierHistory, setMultiplierHistory] = useState<number[]>([]);
  const [betAmount, setBetAmount] = useState<number | null>(null);
  const [selectedBet, setSelectedBet] = useState<number | null>(null);
  const [placedBet, setPlacedBet] = useState<{
    amount: number;
    timestamp: number;
  } | null>(null);
  const [cashedOut, setCashedOut] = useState(false);
  const [cashOutMultiplier, setCashOutMultiplier] = useState<number | null>(
    null
  );
  const [winAmount, setWinAmount] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastResults, setLastResults] = useState<
    { multiplier: number; timestamp: number }[]
  >([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [roundId, setRoundId] = useState<string | null>(null);
  const [gameStartTime, setGameStartTime] = useState<number | null>(null);
  const [allBets, setAllBets] = useState<any[]>([]);
  const [playerCount, setPlayerCount] = useState(1);

  // Estados para chat
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');
  const chatAreaRef = useRef<HTMLDivElement>(null);
  const [showChatModal, setShowChatModal] = useState(false);

  // Estados para socket
  const [socketInitialized, setSocketInitialized] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);
  const socketRef = useRef<Socket | null>(null);

  // Estados para configuração de apostas rápidas
  const QUICK_BETS = [5, 10, 20, 50, 100];
  const [showQuickBetsModal, setShowQuickBetsModal] = useState(false);
  const [customQuickBets, setCustomQuickBets] = useState<number[]>(() => {
    try {
      const savedBets = localStorage.getItem('customQuickBets');
      if (savedBets) {
        return JSON.parse(savedBets);
      }
      return QUICK_BETS;
    } catch (error) {
      console.error('Erro ao carregar apostas rápidas personalizadas:', error);
      return QUICK_BETS;
    }
  });
  const [editQuickBets, setEditQuickBets] = useState<string[]>([]);
  const [quickBetsError, setQuickBetsError] = useState<string | null>(null);

  // Estado para controle de limite diário
  const [dailyBetTotal, setDailyBetTotal] = useState<number>(() => {
    try {
      const savedTotal = localStorage.getItem('dailyBetTotal');
      if (savedTotal && !isNaN(parseFloat(savedTotal))) {
        return parseFloat(savedTotal);
      }
      return 0;
    } catch (error) {
      console.error('Erro ao recuperar total de apostas diárias:', error);
      return 0;
    }
  });
  const [dailyBetLimit, setDailyBetLimit] = useState(DAILY_BET_LIMIT);

  // Estados para controle do jogo
  const [currentLine, setCurrentLine] = useState(50);
  const [result, setResult] = useState<number | null>(null);
  const [displayResult, setDisplayResult] = useState<number | null>(null); // Resultado para exibição
  const [bets, setBets] = useState<any[]>([]);
  const [myBet, setMyBet] = useState<{
    amount: number;
    type: 'ABOVE' | 'BELOW';
    roundId?: string;
  } | null>(null);
  const [betType, setBetType] = useState<'ABOVE' | 'BELOW' | null>(null);
  const [isBetting, setIsBetting] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [timeProgress, setTimeProgress] = useState(0);
  const [chartWidth, setChartWidth] = useState(800);
  const [lineHistory, setLineHistory] = useState<number[]>(() => {
    // Inicializar com uma série de valores para evitar problemas de renderização
    const initialValues = [];
    let value = 50;
    for (let i = 0; i < 30; i++) {
      value += Math.random() * 10 - 5; // Variação entre -5 e +5
      value = Math.min(Math.max(value, 20), 80); // Limitar entre 20 e 80
      initialValues.push(value);
    }
    return initialValues;
  });

  // Configuração dos tempos (em segundos)
  const BETTING_DURATION = 5; // 5 segundos para apostas
  const RUNNING_DURATION = 20; // 20 segundos para a rodada em execução

  // Função auxiliar para calcular médias móveis
  const calculateMovingAverage = useCallback(
    (data: Array<{ x: number; y: number }>, window: number) => {
      if (!data || data.length < window) return [];

      const result = [];
      for (let i = window - 1; i < data.length; i++) {
        const windowSum = data
          .slice(i - window + 1, i + 1)
          .reduce(
            (sum: number, point: { x: number; y: number }) => sum + point.y,
            0
          );
        const average = windowSum / window;
        result.push({
          x: data[i].x,
          y: average,
        });
      }
      return result;
    },
    []
  );

  // Memoizar os dados para o gráfico Área+
  const enhancedAreaChartData = useMemo(() => {
    // Se a rodada estiver em andamento, mostrar apenas os pontos até o progresso atual
    if (currentPhase === 'running') {
      // Calculamos o número de pontos a mostrar com base no progresso do tempo
      const totalPoints = Math.floor((lineHistory.length * timeProgress) / 100);

      // Preparamos os pontos para o caminho do gráfico
      const pathPoints = lineHistory
        .slice(0, totalPoints)
        .map((value, index) => ({
          x: (index / (lineHistory.length - 1)) * 100, // Distribuir os pontos uniformemente de 0 a 100%
          y: Math.min(Math.max(value, 15), 85),
          value: 100 - value, // Valor real do multiplicador
        }));

      // Calculamos médias móveis para linhas de tendência
      const movingAverage5 = calculateMovingAverage(pathPoints, 5);
      const movingAverage10 = calculateMovingAverage(pathPoints, 10);

      return {
        pathPoints,
        movingAverage5,
        movingAverage10,
        min:
          pathPoints.length > 0 ? Math.min(...pathPoints.map((p) => p.y)) : 15,
        max:
          pathPoints.length > 0 ? Math.max(...pathPoints.map((p) => p.y)) : 85,
        currentX: timeProgress,
        currentY: Math.min(Math.max(currentLine, 15), 85),
      };
    } else if (currentPhase === 'ended') {
      // Mostrar todos os pontos quando a rodada estiver finalizada
      const pathPoints = lineHistory.map((value, index) => ({
        x: (index / (lineHistory.length - 1)) * 100,
        y: Math.min(Math.max(value, 15), 85),
        value: 100 - value,
      }));

      const movingAverage5 = calculateMovingAverage(pathPoints, 5);
      const movingAverage10 = calculateMovingAverage(pathPoints, 10);

      return {
        pathPoints,
        movingAverage5,
        movingAverage10,
        min:
          pathPoints.length > 0 ? Math.min(...pathPoints.map((p) => p.y)) : 15,
        max:
          pathPoints.length > 0 ? Math.max(...pathPoints.map((p) => p.y)) : 85,
        currentX: 100,
        currentY: Math.min(Math.max(currentLine, 15), 85),
      };
    } else {
      // Na fase de apostas, mostrar apenas o ponto inicial (50)
      return {
        pathPoints: [{ x: 0, y: 50, value: 50 }],
        movingAverage5: [],
        movingAverage10: [],
        min: 15,
        max: 85,
        currentX: 0,
        currentY: 50,
      };
    }
  }, [
    lineHistory,
    timeProgress,
    currentLine,
    currentPhase,
    calculateMovingAverage,
  ]);

  // Gerar candles para visualização de velas
  const candlesData = useMemo(() => {
    const candleInterval = 5;
    const candles = [];
    const totalPoints = Math.floor((lineHistory.length * timeProgress) / 100);

    for (let i = 0; i < totalPoints; i += candleInterval) {
      if (i + candleInterval <= totalPoints) {
        const segment = lineHistory.slice(i, i + candleInterval);
        const open = segment[0];
        const close = segment[segment.length - 1];
        const high = Math.min(...segment);
        const low = Math.max(...segment);

        const x = (i / lineHistory.length) * 100;
        const width = (candleInterval / lineHistory.length) * 100 * 0.6;

        const isUp = close < open;
        const color = isUp ? '#22c55e' : '#ef4444';

        candles.push({ i, high, low, open, close, x, width, isUp, color });
      }
    }

    return candles;
  }, [lineHistory, timeProgress]);

  // Atualizar o tamanho do gráfico com base na largura da janela
  useEffect(() => {
    const updateWidth = () => {
      setChartWidth(window.innerWidth > 768 ? 800 : window.innerWidth - 80);
    };

    // Inicialização
    updateWidth();

    // Atualizar no redimensionamento
    window.addEventListener('resize', updateWidth);

    return () => {
      window.removeEventListener('resize', updateWidth);
    };
  }, []);

  // Redirecionar se não estiver autenticado
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login');
    }

    // Buscar o limite diário personalizado quando o usuário estiver autenticado
    if (status === 'authenticated' && session) {
      fetchDailyBetLimit();
    }
  }, [status, router, session]);

  // Forçar atualização dos gráficos quando o timeProgress ou currentPhase mudar
  useEffect(() => {
    // Se a rodada estiver em andamento, atualizamos o progresso
    if (currentPhase === 'running') {
      // Nada mais a fazer, a atualização já acontece com o timeProgress
    } else if (currentPhase === 'betting') {
      // Reiniciar o progresso quando entrar na fase de apostas
      setTimeProgress(0);
    } else if (currentPhase === 'ended') {
      // Na fase final, garantir que o progresso chegue a 100%
      setTimeProgress(100);
    }
  }, [currentPhase]);

  // Implementação específica para garantir que os dados dos gráficos sejam atualizados
  // quando a rodada for reiniciada
  useEffect(() => {
    if (currentPhase === 'betting') {
      console.log('Nova rodada iniciada, preparando os gráficos...');

      setTimeProgress(0);
      generateNewLineValues();

      // Resetar a linha para 50 quando a rodada começar
      setCurrentLine(50);
    }
  }, [currentPhase]);

  // Atualizar o limite diário quando a página receber foco
  useEffect(() => {
    // Esta função será chamada quando o usuário voltar à página
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && session) {
        console.log('Página visível novamente, atualizando limite diário...');
        fetchDailyBetLimit();
      }
    };

    // Esta função será chamada quando a janela receber foco
    const handleFocus = () => {
      if (session) {
        console.log('Janela recebeu foco, atualizando limite diário...');
        fetchDailyBetLimit();
      }
    };

    // Adicionar listeners para os eventos
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    // Remover listeners quando o componente for desmontado
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [session]);

  // Função para buscar o limite diário personalizado
  const fetchDailyBetLimit = async () => {
    try {
      const response = await fetch('/api/user/bet-limit');

      if (response.ok) {
        const data = await response.json();
        if (
          data &&
          typeof data.dailyBetLimit === 'number' &&
          !isNaN(data.dailyBetLimit)
        ) {
          setDailyBetLimit(data.dailyBetLimit);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar limite de apostas:', error);
    }
  };

  // Rolar o chat para o final quando novas mensagens chegarem
  useEffect(() => {
    if (chatAreaRef.current) {
      chatAreaRef.current.scrollTop = chatAreaRef.current.scrollHeight;
    }
  }, [chatMessages]);

  // Função que obtém ou cria a instância global do socket
  const getOrCreateSocketInstance = useCallback(() => {
    // Se já temos uma instância global válida e conectada, use-a
    if (globalSocketInstance && globalSocketInstance.connected) {
      console.log(
        'Reutilizando instância global do socket:',
        globalSocketInstance.id
      );
      return globalSocketInstance;
    }

    // Se a instância existe mas não está conectada, descartá-la
    if (globalSocketInstance) {
      console.log(
        'Instância global do socket existe mas não está conectada, criando nova...'
      );
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

  // Configurar os eventos do Socket para o jogo Multiplicador
  const setupSocketEvents = useCallback(
    (socketClient: Socket) => {
      console.log('Configurando eventos do socket para o jogo...');

      // Limpar todos os listeners existentes para evitar duplicação
      const events = [
        'connect',
        'disconnect',
        'error',
        'connect_error',
        'reconnect_attempt',
        'reconnect_error',
        'reconnect',
        'gamePhaseChange',
        'timeUpdate',
        'multiplierUpdate',
        'betPlaced',
        'cashOutMade',
        'gameStarted',
        'gameEnded',
        'playerCount',
        'gameState',
        'chatMessage',
      ];

      events.forEach((event) => {
        socketClient.off(event);
      });

      socketClient.on('connect', () => {
        console.log('Conectado ao servidor Socket.IO:', socketClient.id);

        // Solicitar o estado atual do jogo ao se conectar
        socketClient.emit('requestGameState');
      });

      socketClient.on('gameState', (state: any) => {
        console.log('Estado do jogo recebido:', state);
        setCurrentPhase(state.phase);

        // Converter de milissegundos para segundos corretamente
        if (typeof state.timeLeft === 'number') {
          setTimeLeft(Math.ceil(state.timeLeft / 1000));
          console.log(
            'Tempo restante atualizado para:',
            Math.ceil(state.timeLeft / 1000),
            'segundos'
          );
        }

        // Garantir que o multiplicador seja definido apenas se for um número válido
        if (typeof state.multiplier === 'number' && !isNaN(state.multiplier)) {
          setCurrentMultiplier(state.multiplier);
          console.log('Multiplicador atualizado para:', state.multiplier);
        } else {
          console.warn('Recebido multiplicador inválido:', state.multiplier);
          // Definir um valor padrão quando o multiplicador for inválido
          setCurrentMultiplier(INITIAL_MULTIPLIER);
        }

        setRoundId(state.roundId);
        setAllBets(state.bets || []);
        setPlayerCount(state.connectedPlayers || 1);

        // Se o jogo estiver em andamento, verificar se já temos uma aposta
        if (state.phase === 'running') {
          setGameStartTime(
            Date.now() - (GAME_PHASE_DURATION * 1000 - state.timeLeft)
          );

          // Verificar se o jogador tem uma aposta nesta rodada
          const playerBet = state.bets?.find(
            (bet: any) =>
              bet.playerId === session?.user?.id ||
              bet.userId === session?.user?.id
          );

          if (playerBet && !placedBet) {
            setPlacedBet({
              amount: playerBet.amount,
              timestamp: playerBet.timestamp || Date.now(),
            });
          }
        }
      });

      socketClient.on(
        'gamePhaseChange',
        (phase: 'betting' | 'running' | 'ended') => {
          console.log('Mudança de fase:', phase);
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
            setTimeLeft(GAME_PHASE_DURATION);
            setGameStartTime(Date.now());
            setMultiplierHistory([INITIAL_MULTIPLIER]); // Iniciar histórico com valor inicial
          }
        }
      );

      socketClient.on('timeUpdate', (time: number) => {
        if (typeof time !== 'number' || isNaN(time)) {
          console.warn('Recebido tempo inválido:', time);
          return;
        }

        // Converter de milissegundos para segundos
        const timeInSeconds = Math.ceil(time / 1000);
        console.log(
          'Atualização de tempo:',
          timeInSeconds,
          'segundos (original:',
          time,
          'ms)'
        );
        setTimeLeft(timeInSeconds);
      });

      socketClient.on('multiplierUpdate', (multiplier: number) => {
        console.log('Atualização de multiplicador:', multiplier);
        if (typeof multiplier === 'number' && !isNaN(multiplier)) {
          setCurrentMultiplier(multiplier);
          setMultiplierHistory((prev) => [...prev, multiplier]);

          // Animar o botão de CashOut quando o multiplicador estiver alto
          if (multiplier >= 1.5 && placedBet && !cashedOut) {
            const cashOutElement = document.querySelector('.cashout-button');
            if (cashOutElement) {
              cashOutElement.classList.add('animate-pulse');
              if (multiplier >= 1.8) {
                cashOutElement.classList.add(
                  'shadow-lg',
                  'shadow-green-500/50'
                );
              }
            }
          }
        } else {
          console.warn('Recebido multiplicador inválido:', multiplier);
          // Manter o multiplicador atual ou usar o valor inicial
          // Não atualizar o histórico com valores inválidos
        }
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

        // Adicionar resultado ao histórico
        setLastResults((prev) => [
          { multiplier: finalMultiplier, timestamp: Date.now() },
          ...prev.slice(0, 9),
        ]);

        // Verificar se o jogador ganhou
        if (placedBet && !cashedOut) {
          if (finalMultiplier >= 1.0) {
            // Jogador ganhou
            const winningAmount = placedBet.amount * finalMultiplier;
            setWinAmount(winningAmount);
            updateBalance(userBalance + winningAmount);
          } else {
            // Jogador perdeu
            const lossAmount = placedBet.amount * finalMultiplier;
            setWinAmount(-lossAmount);
          }
        }

        // Atualizar saldo de qualquer forma
        refreshBalance();
      });

      socketClient.on('betPlaced', (bet: any) => {
        console.log('Nova aposta recebida:', bet);
        setAllBets((prev) => [...prev, bet]);

        // Se a aposta é do jogador atual, atualizar o estado
        if (
          bet.playerId === session?.user?.id ||
          bet.userId === session?.user?.id
        ) {
          setPlacedBet({
            amount: bet.amount,
            timestamp: bet.timestamp || Date.now(),
          });

          // Atualizar saldo
          updateBalance(userBalance - bet.amount);
        }
      });

      socketClient.on('cashOutMade', (data: any) => {
        console.log('CashOut recebido:', data);

        // Se o cashout é do jogador atual
        if (
          data.playerId === session?.user?.id ||
          data.userId === session?.user?.id
        ) {
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

      socketClient.on('chatMessage', (message: any) => {
        console.log('Nova mensagem de chat recebida:', message);
        setChatMessages((prev) => [...prev, message]);

        // Rolar para o final quando novas mensagens chegarem
        if (chatAreaRef.current) {
          chatAreaRef.current.scrollTop = chatAreaRef.current.scrollHeight;
        }
      });

      socketClient.on('disconnect', () => {
        console.log('Desconectado do servidor Socket.IO');
      });

      socketClient.on('error', (error: any) => {
        console.error('Erro do Socket.IO:', error);
      });
    },
    [
      refreshBalance,
      session?.user?.id,
      placedBet,
      cashedOut,
      userBalance,
      updateBalance,
    ]
  );

  // Inicializa o servidor Socket.IO
  const initializeSocketServer = useCallback(async () => {
    if (isInitializingSocket) return;

    try {
      isInitializingSocket = true;
      console.log(
        'Inicializando servidor Socket.IO para o jogo Multiplicador...'
      );

      // Inicializar o endpoint do servidor Socket.IO para o jogo Multiplicador
      const response = await fetch('/api/socket');
      if (!response.ok) {
        console.error('Erro ao inicializar Socket.IO:', response.statusText);
        throw new Error(
          `Falha ao inicializar Socket.IO: ${response.statusText}`
        );
      }

      console.log(
        'Servidor Socket.IO inicializado com sucesso para o jogo Multiplicador'
      );
      setSocketInitialized(true);
      isInitializingSocket = false;

      // Após inicializar com sucesso, tentar conectar o socket imediatamente
      if (!globalSocketInstance || !globalSocketInstance.connected) {
        console.log(
          'Criando nova conexão com Socket.IO após inicialização bem-sucedida'
        );
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

  // Adicionar uma estratégia de reconexão manual (evento de página)
  const reiniciarSocket = useCallback(() => {
    if (isReconnecting) return; // Evitar múltiplas reconexões simultâneas

    console.log('Reiniciando conexão Socket.IO manualmente...');
    setIsReconnecting(true);

    // Fechar instância global e forçar reconexão
    if (globalSocketInstance) {
      globalSocketInstance.disconnect();
      globalSocketInstance = null;
    }

    // Limpar estado atual
    setSocketInitialized(false);
    socketRef.current = null;
    setSocket(null);

    // Reiniciar após um intervalo
    setTimeout(() => {
      initializeSocketServer();
      setIsReconnecting(false);
    }, 3000);
  }, [isReconnecting, initializeSocketServer]);

  // Validação da aposta antes de enviá-la
  const validateBet = (amount: number, type: 'ABOVE' | 'BELOW') => {
    // Limpar mensagem de erro anterior
    setErrorMessage(null);

    // Validar valor mínimo
    if (amount < MIN_BET_AMOUNT) {
      setErrorMessage(
        `Valor mínimo de aposta é R$ ${MIN_BET_AMOUNT.toFixed(2)}`
      );
      return false;
    }

    // Validar valor máximo
    if (amount > MAX_BET_AMOUNT) {
      setErrorMessage(
        `Valor máximo de aposta é R$ ${MAX_BET_AMOUNT.toFixed(2)}`
      );
      return false;
    }

    // Validar saldo suficiente
    if (amount > userBalance) {
      setErrorMessage('Saldo insuficiente para realizar esta aposta');
      return false;
    }

    // Validar limite diário
    if (dailyBetTotal + amount > dailyBetLimit) {
      setErrorMessage(
        `Você atingiu o limite diário de apostas (R$ ${dailyBetLimit.toFixed(2)})`
      );
      return false;
    }

    return true;
  };

  // Função para fazer apostas
  const placeBet = async () => {
    if (!selectedBet || !betType || !roundId) return;

    // Verificar se está na fase de apostas
    if (currentPhase !== 'betting') {
      setErrorMessage('Apostas só podem ser feitas durante a fase de apostas');
      return;
    }

    // Verificar se já apostou nesta rodada
    if (myBet !== null) {
      setErrorMessage('Você já fez uma aposta nesta rodada');
      return;
    }

    // Validar a aposta antes de processá-la
    if (!validateBet(selectedBet, betType)) {
      return;
    }

    setIsBetting(true);

    try {
      // Fazer a aposta via API (para que seja validada e salva no banco de dados)
      const response = await fetch('/api/bets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: selectedBet,
          type: betType,
          roundId: roundId,
        }),
      });

      if (response.ok) {
        // Aposta feita com sucesso
        const betResponse = await response.json();

        // Registrar a aposta do jogador para referência e salvar no localStorage
        const myNewBet = {
          amount: selectedBet,
          type: betType,
        };
        updateMyBet(myNewBet);

        // Atualizar o saldo com o valor retornado pela API
        if (betResponse.newBalance !== undefined) {
          updateBalance(betResponse.newBalance);
        } else {
          // Fallback: atualizar com o valor local
          updateBalance(userBalance - selectedBet);
        }

        // Atualizar o total de apostas diárias
        if (betResponse.dailyTotal !== undefined) {
          // Usar o valor retornado pela API, se disponível
          setDailyBetTotal(betResponse.dailyTotal);
        } else {
          // Fallback: atualizar localmente
          setDailyBetTotal((prev) => prev + selectedBet);
        }

        // Atualizar estatísticas do usuário após aposta bem-sucedida
        try {
          // Chamada assíncrona para atualizar estatísticas sem bloquear a UI
          fetch('/api/user/bet-stats?' + new Date().getTime(), {
            headers: {
              'Cache-Control': 'no-cache',
              Pragma: 'no-cache',
            },
          })
            .then((response) => {
              if (response.ok) {
                return response.json();
              }
              throw new Error('Falha ao atualizar estatísticas');
            })
            .then((data) => {
              // Atualizar o total de apostas diárias com o valor mais preciso da API
              if (data && typeof data.dailyTotal === 'number') {
                setDailyBetTotal(data.dailyTotal);
              }
            })
            .catch((err) => {
              console.error('Erro ao processar resposta de estatísticas:', err);
            });
        } catch (statsError) {
          console.error(
            'Erro ao atualizar estatísticas após aposta:',
            statsError
          );
          // Não bloqueamos o fluxo por erro na atualização de estatísticas
        }

        // Emitir evento para o servidor Socket.IO (para informar outros jogadores)
        if (socketRef.current) {
          socketRef.current.emit('placeBet', {
            amount: selectedBet,
            type: betType,
          });
        }
      } else {
        // Erro ao fazer aposta
        const error = await response.json();
        setErrorMessage(`Erro: ${error.message}`);
      }
    } catch (error) {
      console.error('Erro ao fazer aposta:', error);
      setErrorMessage('Erro ao fazer aposta. Tente novamente.');
    } finally {
      setIsBetting(false);
    }
  };

  // Inicializar edição de apostas rápidas
  const initEditQuickBets = () => {
    setEditQuickBets(customQuickBets.map((bet) => bet.toString()));
    setShowQuickBetsModal(true);
    setQuickBetsError(null);
  };

  // Salvar apostas rápidas personalizadas
  const saveCustomQuickBets = () => {
    // Validar valores
    const newBets = editQuickBets.map((value) => {
      const bet = parseFloat(value);
      return isNaN(bet) ? 0 : bet;
    });

    // Verificar valores inválidos
    if (newBets.some((bet) => bet <= 0)) {
      setQuickBetsError('Todos os valores devem ser maiores que zero');
      return;
    }

    // Verificar valores duplicados
    if (new Set(newBets).size !== newBets.length) {
      setQuickBetsError('Não são permitidos valores duplicados');
      return;
    }

    // Ordenar os valores
    const sortedBets = [...newBets].sort((a, b) => a - b);

    // Salvar no localStorage
    localStorage.setItem('customQuickBets', JSON.stringify(sortedBets));

    // Atualizar estado
    setCustomQuickBets(sortedBets);
    setShowQuickBetsModal(false);
  };

  // Resetar apostas rápidas para os valores padrão
  const resetQuickBets = () => {
    localStorage.removeItem('customQuickBets');
    setCustomQuickBets(QUICK_BETS);
    setShowQuickBetsModal(false);
  };

  // Atualizar valor de aposta rápida
  const updateQuickBetValue = (index: number, value: string) => {
    const newValues = [...editQuickBets];
    newValues[index] = value;
    setEditQuickBets(newValues);
  };

  // Função para enviar mensagem de chat
  const sendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!chatInput.trim() || !session?.user?.id) return;

    try {
      const response = await fetch('/api/chat/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: chatInput,
        }),
      });

      if (response.ok) {
        setChatInput('');

        // Emitir mensagem via socket se disponível
        if (socketRef.current && socketRef.current.connected) {
          socketRef.current.emit('chatMessage', {
            text: chatInput,
            userId: session.user.id,
            userName: session.user.name,
            timestamp: new Date(),
          });
        }
      }
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
    }
  };

  // Combinar as duas funções renderPlayerName, mantendo a primeira como um componente JSX
  const renderPlayerName = (playerId: string, playerName?: string) => {
    if (playerId === session?.user?.id) {
      return <span className="text-green-500 font-medium">Você</span>;
    }
    return (
      <span className="text-blue-400 font-medium">
        {playerName || 'Jogador'}
      </span>
    );
  };

  // Função para salvar a aposta no localStorage
  const saveMyBetToStorage = useCallback(
    (
      bet: { amount: number; type: 'ABOVE' | 'BELOW' } | null,
      currentRoundId: string | null
    ) => {
      try {
        if (bet && currentRoundId) {
          // Adicionar o roundId à aposta para validação posterior
          const betWithRoundId = { ...bet, roundId: currentRoundId };
          localStorage.setItem('currentBet', JSON.stringify(betWithRoundId));
        } else {
          // Se a aposta for nula, remover do armazenamento
          localStorage.removeItem('currentBet');
        }
      } catch (error) {
        console.error('Erro ao salvar aposta no localStorage:', error);
      }
    },
    []
  );

  // Função personalizada para atualizar a aposta atual
  const updateMyBet = useCallback(
    (bet: { amount: number; type: 'ABOVE' | 'BELOW' } | null) => {
      setMyBet(bet);
      saveMyBetToStorage(bet, roundId);
    },
    [roundId, saveMyBetToStorage]
  );

  // Carregar dados de aposta e resultado do localStorage no início
  useEffect(() => {
    try {
      // Verificar se há dados salvos no localStorage
      const savedBet = localStorage.getItem('currentBet');

      if (savedBet) {
        const parsedBet = JSON.parse(savedBet);

        // Se já temos um roundId, verificar se a aposta é válida para a rodada atual
        if (roundId) {
          if (parsedBet.roundId === roundId) {
            console.log('Aposta encontrada para rodada atual:', parsedBet);

            // Restaurar a aposta
            setMyBet({
              amount: parsedBet.amount,
              type: parsedBet.type,
            });

            // Se temos um resultado e rodada está finalizada, exibir o resultado também
            if (parsedBet.result !== undefined && currentPhase === 'ended') {
              setResult(parsedBet.result);
              setDisplayResult(
                parsedBet.displayResult || Math.round(100 - parsedBet.result)
              );
            }
          } else {
            // Aposta é de uma rodada diferente da atual
            if (currentPhase === 'betting') {
              console.log('Removendo aposta de rodada anterior');
              localStorage.removeItem('currentBet');
            }
          }
        } else {
          // Não temos roundId ainda, exibir a aposta e esperar pela atualização do jogo
          console.log(
            'Aposta salva encontrada, aguardando atualização do jogo:',
            parsedBet
          );

          // Restaurar a aposta para exibição
          setMyBet({
            amount: parsedBet.amount,
            type: parsedBet.type,
          });

          // Se temos um resultado, exibir também
          if (parsedBet.result !== undefined) {
            setResult(parsedBet.result);
            setDisplayResult(
              parsedBet.displayResult || Math.round(100 - parsedBet.result)
            );
            setCurrentPhase('ended'); // Presumir que estamos na fase de exibição de resultado
          }
        }
      }
    } catch (error) {
      console.error('Erro ao carregar dados de aposta do localStorage:', error);
      localStorage.removeItem('currentBet');
    }
  }, [setMyBet, currentPhase, roundId]);

  // Limpar a aposta salva apenas quando começar uma nova rodada
  useEffect(() => {
    if (currentPhase === 'betting' && roundId !== null) {
      // Verificar se há uma aposta salva
      try {
        const savedBet = localStorage.getItem('currentBet');
        if (savedBet) {
          const parsedBet = JSON.parse(savedBet);

          // Se a aposta for de uma rodada anterior, removê-la
          if (parsedBet.roundId !== roundId) {
            console.log('Removendo aposta de rodada anterior');
            setMyBet(null);
            localStorage.removeItem('currentBet');
          }
        }
      } catch (error) {
        console.error('Erro ao verificar aposta salva:', error);
        // Em caso de erro, limpar de qualquer forma
        setMyBet(null);
        localStorage.removeItem('currentBet');
      }
    }
  }, [currentPhase, roundId]);

  // Atualizar o localStorage quando o resultado for recebido
  useEffect(() => {
    if (currentPhase === 'ended' && result !== null && myBet) {
      try {
        // Atualizar a aposta no localStorage com o resultado para exibição posterior
        const savedBet = localStorage.getItem('currentBet');
        if (savedBet) {
          const parsedBet = JSON.parse(savedBet);
          const updatedBet = {
            ...parsedBet,
            result: result,
            displayResult: displayResult,
            isWinner:
              (myBet.type === 'ABOVE' && result < 50) ||
              (myBet.type === 'BELOW' && result >= 50),
          };
          localStorage.setItem('currentBet', JSON.stringify(updatedBet));
        }
      } catch (error) {
        console.error('Erro ao atualizar aposta com resultado:', error);
      }
    }
  }, [currentPhase, result, displayResult, myBet]);

  // Salvar o total de apostas diárias no localStorage sempre que mudar
  useEffect(() => {
    try {
      localStorage.setItem('dailyBetTotal', dailyBetTotal.toString());
    } catch (error) {
      console.error('Erro ao salvar total de apostas diárias:', error);
    }
  }, [dailyBetTotal]);

  // Função para buscar o total de apostas diárias da API
  const fetchDailyBetTotal = useCallback(async () => {
    if (!session?.user?.id) return;

    try {
      console.log('Carregando total de apostas diárias...');
      const response = await fetch('/api/user/bet-stats');

      if (response.ok) {
        const data = await response.json();
        if (
          data &&
          typeof data.dailyTotal === 'number' &&
          !isNaN(data.dailyTotal)
        ) {
          console.log('Total de apostas carregado:', data.dailyTotal);
          setDailyBetTotal(data.dailyTotal);
          // Atualizar o localStorage também
          localStorage.setItem('dailyBetTotal', data.dailyTotal.toString());
        }
      }
    } catch (error) {
      console.error('Erro ao carregar total de apostas diárias:', error);
    }
  }, [session]);

  // Buscar o total de apostas diárias da API quando o componente for montado
  useEffect(() => {
    if (status === 'authenticated' && session) {
      fetchDailyBetTotal();
    }
  }, [status, session, fetchDailyBetTotal]);

  // Atualizar o total de apostas diárias quando a página receber foco
  useEffect(() => {
    // Esta função será chamada quando o usuário voltar à página
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && session) {
        console.log(
          'Página visível novamente, atualizando total de apostas diárias...'
        );
        fetchDailyBetTotal();
      }
    };

    // Esta função será chamada quando a janela receber foco
    const handleFocus = () => {
      if (session) {
        console.log(
          'Janela recebeu foco, atualizando total de apostas diárias...'
        );
        fetchDailyBetTotal();
      }
    };

    // Adicionar listeners para os eventos
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    // Remover listeners quando o componente for desmontado
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [session, fetchDailyBetTotal]);

  // Função para gerar o caminho SVG com base no progresso
  const generatePathFromHistory = useCallback(
    (history: number[], progress: number) => {
      if (!history || history.length < 2 || progress <= 0) {
        return '';
      }

      try {
        const totalPoints = history.length;
        const pointsToShow = Math.max(
          1,
          Math.floor((totalPoints * progress) / 100)
        );

        if (pointsToShow <= 1) {
          return '';
        }

        let path = '';

        for (let i = 1; i < Math.min(pointsToShow, totalPoints); i++) {
          const x = (i / totalPoints) * 100;
          let y = history[i];

          // Limitar os valores Y entre 15% e 85%
          y = Math.min(Math.max(y, 15), 85);

          if (i === pointsToShow - 1 && progress < 100) {
            const partialX = progress;
            path += ` L${partialX}%,${y}%`;
          } else {
            path += ` L${x}%,${y}%`;
          }
        }

        return path;
      } catch (error) {
        console.error('Erro ao gerar caminho SVG:', error);
        return '';
      }
    },
    []
  );

  // Função para gerar novos valores para a linha
  const generateNewLineValues = () => {
    const newPoints: number[] = [];

    // Sempre iniciar com o valor 50
    let currentValue = 50;
    newPoints.push(currentValue);

    // Criar parâmetros para simular um movimento de preço mais natural
    const volatility = Math.random() * 1.5 + 1; // Entre 1.0 e 2.5
    const trendDirection = Math.random() > 0.5 ? 1 : -1;
    const trendStrength = Math.random() * 0.3 + 0.1; // Entre 0.1 e 0.4

    // Pontos de suporte e resistência
    const supportLevel = 30 + Math.random() * 10; // Entre 30 e 40
    const resistanceLevel = 60 + Math.random() * 10; // Entre 60 e 70

    // Adicionar alguns pontos chave como eventos
    const events: Array<{ position: number; strength: number }> = [];
    const numEvents = Math.floor(Math.random() * 3) + 1; // 1 a 3 eventos

    for (let i = 0; i < numEvents; i++) {
      events.push({
        position: Math.floor(Math.random() * 25) + 3 + i * 10, // Distribuir ao longo da série
        strength: (Math.random() > 0.5 ? 1 : -1) * (Math.random() * 12 + 3), // Choque entre 3 e 15
      });
    }

    // Função para simular um movimento de preço mais natural
    const generateNextValue = (current: number, index: number) => {
      // Verificar se estamos em um ponto de evento
      const event = events.find((e) => e.position === index);
      if (event) {
        return Math.min(Math.max(current + event.strength, 20), 80);
      }

      // Calcular componentes do movimento
      const trend = trendDirection * trendStrength * (1 + Math.sin(index / 5));
      const random = (Math.random() * 2 - 1) * volatility;
      const meanReversion =
        current > resistanceLevel ? -0.5 : current < supportLevel ? 0.5 : 0;

      // Calcular o novo valor
      let newValue = current + trend + random + meanReversion;

      // Garantir que o valor fique nos limites
      newValue = Math.min(Math.max(newValue, 20), 80);

      return newValue;
    };

    // Gerar série de pontos (começando de 1, pois o 0 já foi adicionado como 50)
    for (let i = 1; i < 30; i++) {
      currentValue = generateNextValue(currentValue, i);
      newPoints.push(currentValue);
    }

    setLineHistory(newPoints);

    // Resetar o progresso de tempo quando geramos novos valores
    setTimeProgress(0);
  };

  // Inicializar valores da linha quando o componente é montado
  useEffect(() => {
    generateNewLineValues();
  }, []);

  // Função para limitar um valor entre min e max
  const limitValue = (value: number, min: number, max: number) => {
    return Math.min(Math.max(value, min), max);
  };

  useEffect(() => {
    // Gerar novos valores para a linha sempre que a rodada mudar para "running"
    if (currentPhase === 'running' && timeProgress === 0) {
      generateNewLineValues();
    }
  }, [currentPhase, timeProgress]);

  // Inicializar o socket
  useEffect(() => {
    if (!socketInitialized) {
      // Inicializar o servidor Socket.IO primeiro
      initializeSocketServer();
    } else if (!socket) {
      console.log('Socket inicializado, configurando conexão...');
      
      try {
        const socketInstance = getOrCreateSocketInstance();
        socketRef.current = socketInstance;
        setSocket(socketInstance);
        setupSocketEvents(socketInstance);
        
        console.log('Socket configurado com sucesso.');
        
        // Verificar se o socket está conectado
        if (!socketInstance.connected) {
          console.log('Socket não conectado, aguardando conexão...');
          
          // Configurar timeout para verificar conexão
          const connectionTimeout = setTimeout(() => {
            if (socketInstance && !socketInstance.connected) {
              console.warn('Timeout de conexão do socket atingido, tentando reconectar...');
              reiniciarSocket();
            }
          }, 10000); // 10 segundos para conectar
          
          return () => clearTimeout(connectionTimeout);
        }
      } catch (error) {
        console.error('Erro ao configurar socket:', error);
        // Tentativa de recuperação automática
        setTimeout(() => reiniciarSocket(), 5000);
      }
    }
    
    // Configurar verificação periódica da conexão do socket
    if (socket) {
      console.log('Configurando verificação periódica de conexão do socket...');
      const interval = setInterval(() => {
        if (!socket.connected) {
          console.warn('Socket desconectado detectado durante verificação periódica');
          setIsReconnecting(true);
          reiniciarSocket();
        }
      }, 30000); // Verificar a cada 30 segundos
      
      return () => {
        clearInterval(interval);
        console.log('Desconectando socket ao desmontar componente');
        if (socket) {
          socket.disconnect();
        }
      };
    }
  }, [socketInitialized, socket, getOrCreateSocketInstance, setupSocketEvents, reiniciarSocket, initializeSocketServer]);

  // Calcular a cor do multiplicador com base no valor
  const getMultiplierColor = (multiplier: number | undefined) => {
    if (multiplier === undefined || isNaN(Number(multiplier)))
      return 'text-white';
    if (multiplier >= 1.8) return 'text-green-400 animate-pulse';
    if (multiplier >= 1.5) return 'text-green-500';
    if (multiplier >= 1.2) return 'text-blue-300';
    if (multiplier >= 1.0) return 'text-blue-400';
    if (multiplier >= 0.7) return 'text-yellow-500';
    if (multiplier >= 0.5) return 'text-orange-500';
    return 'text-red-500';
  };

  // Função para realizar CashOut
  const doCashOut = async () => {
    if (!placedBet || currentPhase !== 'running' || cashedOut) {
      console.warn('Tentativa de CashOut inválida:', {
        temAposta: !!placedBet,
        fase: currentPhase,
        jáFezCashOut: cashedOut,
      });
      return;
    }

    // Verificar se o multiplicador é válido
    if (
      typeof currentMultiplier !== 'number' ||
      isNaN(currentMultiplier) ||
      currentMultiplier <= 0
    ) {
      console.error('Multiplicador inválido para CashOut:', currentMultiplier);
      setErrorMessage('Multiplicador inválido. Tente novamente.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      // Usar o multiplicador atual para o CashOut
      const safeMultiplier = currentMultiplier;
      console.log('Realizando CashOut com multiplicador:', safeMultiplier);

      // Enviar cashout via API
      const response = await fetch('/api/games/cash-out', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          multiplier: safeMultiplier,
          roundId: roundId,
          betAmount: placedBet.amount,
        }),
      });

      const responseData = await response.json();

      if (response.ok) {
        console.log('CashOut feito com sucesso via API:', responseData);

        // Enviar cashout via Socket.IO
        if (socketRef.current && socketRef.current.connected) {
          socketRef.current.emit('cashOut', {
            multiplier: safeMultiplier,
            timestamp: Date.now(),
          });
          console.log('CashOut enviado via Socket.IO');
        } else {
          console.warn(
            'Socket não disponível ou não conectado para enviar CashOut'
          );
        }

        // Atualizar estado local
        setCashedOut(true);
        setCashOutMultiplier(safeMultiplier);

        // Calcular ganho e atualizar saldo
        const winningAmount = placedBet.amount * safeMultiplier;
        setWinAmount(winningAmount);
        updateBalance(userBalance + winningAmount);

        // Mostrar mensagem de sucesso
        const cashOutElement = document.querySelector('.cashout-button');
        if (cashOutElement) {
          cashOutElement.classList.add('animate-pulse', 'bg-green-600');
          setTimeout(() => {
            cashOutElement.classList.remove('animate-pulse', 'bg-green-600');
          }, 1500);
        }
      } else {
        console.error('Erro ao fazer CashOut:', responseData);
        setErrorMessage(
          `Erro: ${responseData.message || 'Falha ao realizar CashOut'}`
        );
      }
    } catch (error) {
      console.error('Exceção ao fazer CashOut:', error);
      setErrorMessage('Erro ao fazer CashOut. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  // Renderizar o componente
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
    <div className="container mx-auto px-4 py-12">
      {/* Grade Principal */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Jogo Multiplicador - 2/3 Colunas */}
        <Card
          variant="bordered"
          className="md:col-span-2 border border-gray-800 bg-gradient-to-b from-[#121212] to-[#0c0c0c] shadow-xl overflow-hidden"
        >
          <CardHeader className="border-b border-gray-800/60 bg-[#111]/50 backdrop-blur-sm flex justify-between items-start">
            <div>
              <CardTitle className="flex items-center text-2xl">
                <span className="inline-block w-3 h-3 rounded-full bg-green-500 mr-2 animate-pulse"></span>
                Multiplicador
              </CardTitle>
              <CardDescription className="text-gray-400">
                Aposte e escolha o momento certo para fazer CashOut
              </CardDescription>
            </div>
            <div className="rounded-lg px-3 py-2 bg-black/70 backdrop-blur-sm border border-green-500/40 shadow-sm">
              <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">
                Tempo restante
              </div>
              <div className="text-lg font-bold bg-gradient-to-r from-[#1a86c7] to-[#3bc37a] bg-clip-text text-transparent text-center">
                {timeLeft}s
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="p-4">
              {/* Área do gráfico e multiplicador */}
              <div className="relative h-72 bg-gradient-to-b from-[#0a0a0a] to-[#090909] rounded-xl mb-4 overflow-hidden border border-gray-800/50 shadow-lg">
                {/* Multiplicador atual */}
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center z-10">
                  {/* Status da conexão */}
                  {(!socket?.connected || isReconnecting) && (
                    <div className="mb-4 p-2 rounded-md bg-yellow-600/10 border border-yellow-600/30 text-center shadow-sm">
                      <p className="text-yellow-500 text-sm">
                        {isReconnecting
                          ? 'Reconectando ao servidor...'
                          : 'Desconectado do servidor'}
                      </p>
                      <Button
                        variant="outline"
                        onClick={reiniciarSocket}
                        disabled={isReconnecting}
                        className="mt-1 px-2 py-1 text-xs"
                      >
                        {isReconnecting ? 'Reconectando...' : 'Reconectar'}
                      </Button>
                    </div>
                  )}
                </div>

                {/* Gráfico de Área */}
                <SimpleAreaChart
                  data={lineHistory
                    .map((value) => 100 - value)
                    .slice(
                      0,
                      Math.max(
                        1,
                        Math.floor((lineHistory.length * timeProgress) / 100)
                      )
                    )}
                  height={288}
                  width={chartWidth}
                  color="#a5d7f7"
                  lineColor="#1a86c7"
                  title="Multiplicador Atual"
                  backgroundColor="transparent"
                  className="absolute inset-0"
                />

                {/* Linha horizontal do meio */}
                <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-gray-700/40 z-5"></div>

                {/* Resultado */}
                {result !== null && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm z-30 transition-all duration-300">
                    <div className="text-center bg-gradient-to-b from-[#121212] to-black px-8 py-6 rounded-xl border border-[#1a86c7]/40 shadow-2xl">
                      <div className="text-gray-400 text-sm uppercase tracking-wider mb-1">
                        Resultado
                      </div>
                      <p className="text-3xl font-bold bg-gradient-to-r from-[#1a86c7] to-[#3bc37a] bg-clip-text text-transparent">
                        {currentLine < 50 ? 'ACIMA' : 'ABAIXO'} (
                        {displayResult !== null
                          ? displayResult.toFixed(1)
                          : (100 - (result || 0)).toFixed(1)}
                        )
                      </p>

                      {myBet && (
                        <div className="mt-4 py-2 px-4 rounded-lg bg-black/50">
                          {(myBet.type === 'ABOVE' && currentLine < 50) ||
                          (myBet.type === 'BELOW' && currentLine >= 50) ? (
                            <div className="text-green-400 font-medium">
                              ✓ Você ganhou{' '}
                              <span className="font-bold">
                                R$ {(myBet.amount * WIN_MULTIPLIER).toFixed(2)}
                              </span>
                            </div>
                          ) : (
                            <div className="text-red-500 font-medium">
                              ✗ Você perdeu{' '}
                              <span className="font-bold">
                                R$ {myBet.amount.toFixed(2)}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Área de apostas com fundo mais escuro */}
            <div className="bg-[#0a0a0a] border-t border-gray-800/50 rounded-b-lg p-4">
              {/* Mensagem de erro, se houver */}
              {errorMessage && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-md text-red-400 text-sm shadow-sm">
                  <div className="flex items-center">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="mr-2"
                    >
                      <circle cx="12" cy="12" r="10"></circle>
                      <line x1="12" y1="8" x2="12" y2="12"></line>
                      <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                    {errorMessage}
                  </div>
                </div>
              )}

              {/* Direção da aposta */}
              <div className="mb-6">
                <div className="text-sm text-gray-400 uppercase tracking-wider mb-2">
                  Direção da aposta
                </div>
                <div className="flex justify-center gap-4">
                  <Button
                    variant={betType === 'ABOVE' ? 'primary' : 'secondary'}
                    onClick={() => setBetType('ABOVE')}
                    className={`transition-all duration-200 relative ${betType === 'ABOVE' ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 shadow-md shadow-emerald-900/20' : 'hover:bg-emerald-900/20'}`}
                  >
                    {betType === 'ABOVE' && (
                      <span className="absolute -top-1 -right-1 w-3 h-3 bg-white rounded-full"></span>
                    )}
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5 mr-1"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 15l7-7 7 7"
                      />
                    </svg>
                    Acima
                  </Button>
                  <Button
                    variant={betType === 'BELOW' ? 'primary' : 'secondary'}
                    onClick={() => setBetType('BELOW')}
                    className={`transition-all duration-200 relative ${betType === 'BELOW' ? 'bg-gradient-to-r from-blue-500 to-blue-600 shadow-md shadow-blue-900/20' : 'hover:bg-blue-900/20'}`}
                  >
                    {betType === 'BELOW' && (
                      <span className="absolute -top-1 -right-1 w-3 h-3 bg-white rounded-full"></span>
                    )}
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5 mr-1"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                    Abaixo
                  </Button>
                </div>
              </div>

              {/* Valores de aposta rápida */}
              <div className="mb-4">
                <div className="text-sm text-gray-400 uppercase tracking-wider mb-2">
                  Valor da aposta
                </div>
                <div className="flex justify-center flex-wrap gap-2">
                  {customQuickBets.map((bet) => (
                    <button
                      key={bet}
                      onClick={() => setSelectedBet(bet)}
                      disabled={bet > userBalance}
                      className={`px-4 py-2 rounded-md transition-all duration-200 ${
                        selectedBet === bet
                          ? 'bg-gradient-to-r from-[#3bc37a] to-[#2bb167] text-white shadow-md shadow-[#3bc37a]/20'
                          : bet > userBalance
                            ? 'bg-gray-800/50 text-gray-500 cursor-not-allowed'
                            : 'bg-[#1e1e1e] text-white hover:bg-[#1a86c7]/20 border border-gray-800'
                      }`}
                    >
                      R$ {bet.toFixed(2)}
                    </button>
                  ))}

                  {/* Botão para configurar apostas rápidas */}
                  <button
                    onClick={initEditQuickBets}
                    className="px-4 py-2 rounded-md bg-[#1e1e1e] text-gray-400 hover:text-white hover:bg-[#1a86c7]/20 border border-gray-800 transition-all duration-200"
                    title="Configurar valores de apostas rápidas"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="inline-block"
                    >
                      <circle cx="12" cy="12" r="3"></circle>
                      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                    </svg>
                  </button>
                </div>
              </div>

              {/* Limites de apostas */}
              <div className="flex justify-between items-center text-xs text-gray-400 mb-6 px-2 py-2 rounded-md bg-gray-900/30 border border-gray-800/50">
                <div>
                  <span className="text-gray-500">Min:</span>{' '}
                  <span className="font-medium">R$ {MIN_BET_AMOUNT}</span>
                </div>
                <div>
                  <span className="text-gray-500">Max:</span>{' '}
                  <span className="font-medium">R$ {MAX_BET_AMOUNT}</span>
                </div>
                <div>
                  <span className="text-gray-500">Diário:</span>
                  <span
                    className={`ml-1 font-medium ${dailyBetLimit !== DAILY_BET_LIMIT ? 'text-[#3bc37a]' : ''}`}
                    title={
                      dailyBetLimit !== DAILY_BET_LIMIT
                        ? 'Limite personalizado definido no perfil'
                        : ''
                    }
                  >
                    R$ {dailyBetLimit.toFixed(2)}
                    {dailyBetLimit !== DAILY_BET_LIMIT && ' ✓'}
                  </span>
                </div>
              </div>

              {/* Apostado hoje e botão de apostar */}
              <div className="flex justify-between items-center">
                <div className="text-xs text-gray-400">
                  <span className="text-gray-500">Apostado hoje:</span>{' '}
                  <span className="font-medium">
                    R$ {dailyBetTotal.toFixed(2)}
                  </span>
                  <span
                    onClick={() => router.push('/profile')}
                    className="ml-2 text-[#1a86c7] cursor-pointer hover:underline"
                  >
                    Ajustar Limite
                  </span>
                </div>

                <Button
                  variant="primary"
                  className={`px-6 py-2 min-w-[150px] transition-all duration-300 ${
                    !selectedBet ||
                    !betType ||
                    isBetting ||
                    currentPhase !== 'betting' ||
                    (selectedBet || 0) > userBalance ||
                    myBet !== null
                      ? 'opacity-70'
                      : 'bg-gradient-to-r from-[#1a86c7] to-[#3bc37a] shadow-lg shadow-[#1a86c7]/30 hover:shadow-[#3bc37a]/50'
                  }`}
                  disabled={
                    !selectedBet ||
                    !betType ||
                    isBetting ||
                    currentPhase !== 'betting' ||
                    (selectedBet || 0) > userBalance ||
                    myBet !== null
                  }
                  onClick={placeBet}
                >
                  {isBetting ? (
                    <div className="flex items-center">
                      <svg
                        className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      Processando...
                    </div>
                  ) : myBet ? (
                    'Aposta Realizada'
                  ) : currentPhase !== 'betting' ? (
                    'Aguardando apostas...'
                  ) : (
                    'Fazer Aposta'
                  )}
                </Button>
              </div>
            </div>
          </CardContent>

          {/* Últimos Resultados */}
          <div className="px-4 pb-6 pt-2 border-t border-gray-800/50 mt-4">
            <div className="text-sm text-gray-400 uppercase tracking-wider mb-2 flex items-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4 mr-1"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                />
              </svg>
              Últimos Resultados
            </div>
            <LastResults />
          </div>
        </Card>

        {/* Área lateral - Informações e chat */}
        <div className="space-y-8">
          {/* Cartão de informações financeiras */}
          <Card variant="bordered">
            <CardHeader>
              <CardTitle>Seu Saldo</CardTitle>
              <CardDescription>Informações da sua conta</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-6">
                <p className="text-sm text-gray-400 mb-1">Saldo Disponível</p>
                <p className="text-3xl font-bold bg-gradient-to-r from-[#1a86c7] to-[#3bc37a] bg-clip-text text-transparent">
                  R$ {userBalance.toFixed(2)}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-400 mb-1">
                  Limite Diário de Apostas
                </p>
                <div className="w-full bg-gray-700 rounded-full h-2.5">
                  <div
                    className={`h-2.5 rounded-full ${
                      dailyBetTotal / dailyBetLimit > 0.8
                        ? 'bg-red-500'
                        : dailyBetTotal / dailyBetLimit > 0.5
                          ? 'bg-yellow-500'
                          : 'bg-green-500'
                    }`}
                    style={{
                      width: `${Math.min(100, (dailyBetTotal / dailyBetLimit) * 100)}%`,
                    }}
                  ></div>
                </div>
                <div className="flex justify-between text-xs mt-1">
                  <span className="text-gray-400">
                    R$ {dailyBetTotal.toFixed(2)}
                  </span>
                  <span className="text-gray-400">
                    R$ {dailyBetLimit.toFixed(2)}
                  </span>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between gap-2">
              <Button variant="primary" onClick={() => router.push('/profile')}>
                Ver Perfil
              </Button>
              <Button
                variant="secondary"
                onClick={() => setShowQuickBetsModal(true)}
              >
                Configurar
              </Button>
            </CardFooter>
          </Card>

          {/* Chat dos jogadores */}
          <Card variant="bordered">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div>Chat dos Jogadores</div>
                <div className="text-xs bg-green-500/20 text-green-500 px-2 py-1 rounded-full">
                  {playerCount} online
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div
                ref={chatAreaRef}
                className="h-48 overflow-y-auto p-4 bg-gray-900/50 border-t border-b border-gray-800"
              >
                {chatMessages.length > 0 ? (
                  <div className="space-y-3">
                    {chatMessages.map((msg, index) => (
                      <div key={index} className="text-sm">
                        <div className="flex items-start">
                          <div className="mr-2 text-gray-500">
                            [
                            {new Date(msg.timestamp).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                            ]
                          </div>
                          <div>
                            {renderPlayerName(msg.userId, msg.userName)}:
                            <span className="ml-1 text-gray-300">
                              {msg.text}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-gray-500 text-center h-full flex items-center justify-center">
                    <p>Sem mensagens no chat</p>
                  </div>
                )}
              </div>

              <form onSubmit={sendChatMessage} className="p-3 flex">
                <Input
                  type="text"
                  placeholder="Digite sua mensagem..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  className="flex-1 mr-2 bg-gray-800"
                />
                <Button
                  variant="primary"
                  type="submit"
                  disabled={!chatInput.trim()}
                >
                  Enviar
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Apostas atuais */}
          <Card variant="bordered">
            <CardHeader>
              <CardTitle>Apostas Atuais</CardTitle>
            </CardHeader>
            <CardContent>
              {/* Conteúdo das apostas */}
              <div className="text-center text-gray-500">
                Não há apostas para exibir
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Modal de Chat para Recarga */}
      <div
        className={`fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-70 transition-all duration-200 ${showChatModal ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setShowChatModal(false)}
      >
        <div
          className="bg-[#121212] rounded-lg shadow-xl max-w-4xl w-full border border-gray-800"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-4 border-b border-gray-800 flex justify-between items-center">
            <h3 className="text-lg font-medium">
              Chat de Suporte - Realizar Depósito
            </h3>
            <button
              onClick={() => setShowChatModal(false)}
              className="text-gray-400 hover:text-white"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
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
              <p>
                Entre em contato com nosso suporte para receber instruções de
                depósito e enviar comprovantes.
              </p>
              <p className="mt-2">
                Nosso atendimento está disponível das 8h às 22h todos os dias.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Configuração de Apostas Rápidas */}
      <div
        className={`fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-70 transition-all duration-200 ${showQuickBetsModal ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setShowQuickBetsModal(false)}
      >
        <div
          className="bg-[#121212] rounded-lg shadow-xl max-w-md w-full border border-gray-800"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-4 border-b border-gray-800 flex justify-between items-center">
            <h3 className="text-lg font-medium">Configurar Apostas Rápidas</h3>
            <button
              onClick={() => setShowQuickBetsModal(false)}
              className="text-gray-400 hover:text-white"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <div className="p-6">
            <p className="text-sm text-gray-400 mb-4">
              Configure os valores de apostas rápidas de acordo com sua
              preferência. Os valores devem estar entre R${' '}
              {MIN_BET_AMOUNT.toFixed(2)} e R$ {MAX_BET_AMOUNT.toFixed(2)}.
            </p>

            {quickBetsError && (
              <div className="mb-4 p-3 bg-red-500 bg-opacity-20 border border-red-500 rounded-md text-red-400 text-sm">
                {quickBetsError}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 mb-6">
              {editQuickBets.map((value, index) => (
                <div key={index} className="flex flex-col">
                  <label className="text-sm text-gray-400 mb-1">
                    Valor {index + 1}
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                      R$
                    </span>
                    <input
                      type="number"
                      value={value}
                      onChange={(e) =>
                        updateQuickBetValue(index, e.target.value)
                      }
                      min={MIN_BET_AMOUNT}
                      max={MAX_BET_AMOUNT}
                      step="1"
                      className="w-full pl-9 pr-3 py-2 bg-[#1e1e1e] rounded-md border border-gray-700 text-white"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={resetQuickBets}>
                Restaurar Padrão
              </Button>
              <Button variant="primary" onClick={saveCustomQuickBets}>
                Salvar Configurações
              </Button>
            </div>

            <div className="mt-6 text-xs text-gray-400">
              <p>
                Os valores serão ordenados automaticamente do menor para o maior
                após salvar.
              </p>
              <p>
                Suas configurações ficarão salvas mesmo após fechar o navegador.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
