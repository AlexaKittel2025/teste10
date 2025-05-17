import { Server } from 'socket.io';
import type { NextApiRequest } from 'next';
import type { Socket as NetSocket } from 'net';
import type { Server as HTTPServer } from 'http';
import type { NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';

interface SocketServer extends HTTPServer {
  io?: Server | undefined;
}

interface SocketWithIO extends NetSocket {
  server: SocketServer;
}

interface NextApiResponseWithSocket extends NextApiResponse {
  socket: SocketWithIO;
}

interface Player {
  id: string;
  connected: boolean;
  lastActivity: number;
}

interface Bet {
  id: string;
  playerId: string;
  amount: number;
  timestamp: number;
}

interface CashOut {
  playerId: string;
  multiplier: number;
  timestamp: number;
}

interface GameState {
  phase: 'betting' | 'running' | 'ended';
  roundId: string;
  multiplier: number;
  players: Record<string, Player>;
  bets: Bet[];
  cashOuts: CashOut[];
  timeLeft: number;
  startTime: number;
  endTime: number;
  targetEndValue?: number;
}

// Constantes de tempo
const BETTING_PHASE_DURATION = 5000; // 5 segundos para apostas
const ROUND_DURATION = 20000; // 20 segundos para a rodada em execução

// Constantes do jogo
const INITIAL_MULTIPLIER = 1.0; // Multiplicador inicial
const MAX_MULTIPLIER = 2.0; // Multiplicador máximo
const MIN_MULTIPLIER = 0.0; // Multiplicador mínimo

// Estado do jogo
let gameState: GameState = {
  phase: 'betting',
  roundId: '',
  multiplier: INITIAL_MULTIPLIER,
  players: {},
  bets: [],
  cashOuts: [],
  timeLeft: BETTING_PHASE_DURATION,
  startTime: Date.now(),
  endTime: Date.now() + BETTING_PHASE_DURATION,
};

// Armazenar a instância do servidor para evitar recriação
let cachedIo: Server | null = null;

// Configurações da casa
let houseConfig = {
  profitMargin: 5, // Margem de lucro da casa em %
  balance: 100000, // Saldo inicial da casa: R$ 100.000
  totalBets: 0,
  totalBetAmount: 0,
  totalPayout: 0
};

const MultiplierSocketHandler = async (req: NextApiRequest, res: NextApiResponseWithSocket) => {
  // Se o socket já existe, não crie um novo
  if (res.socket.server.io) {
    console.log('Socket já está em execução');
    res.end();
    return;
  }
  
  console.log('Inicializando Socket.IO para o jogo Multiplicador...');
  
  // Reutilizar a instância se existir
  const io = cachedIo || new Server(res.socket.server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    },
    pingTimeout: 60000,
    pingInterval: 25000,
    transports: ['websocket', 'polling'],
    allowUpgrades: true,
    upgradeTimeout: 10000,
    maxHttpBufferSize: 1e8,
    connectTimeout: 45000,
    path: '/api/socket.io',
    serveClient: false
  });
  
  // Armazenar para reutilização
  cachedIo = io;
  res.socket.server.io = io;
  
  // Variáveis de controle do jogo
  let roundInterval: NodeJS.Timeout | null = null;
  let timerInterval: NodeJS.Timeout | null = null;
  let activeConnections = 0;
  let isFirstInitialization = !gameState.roundId;

  // Variáveis para controlar a evolução do multiplicador
  let trendDirection = 0; // -1 (diminuindo), 0 (neutro), 1 (aumentando)
  let trendStrength = 0.5; // Força da tendência atual (0 a 1)
  let trendDuration = 0; // Duração restante da tendência atual
  let volatility = 0.5; // Volatilidade atual (0 a 1)
  let crashProbability = 0.1; // Probabilidade de "quebra" (multiplicador cair drasticamente)

  // Buscar configurações da casa do banco de dados
  const loadHouseConfig = async () => {
    try {
      // @ts-ignore - O modelo houseBalance existe no schema mas não no tipo PrismaClient
      const houseBalance = await prisma.houseBalance.findFirst({
        where: { gameType: "multiplicador" }
      });
      
      if (houseBalance) {
        houseConfig = {
          profitMargin: houseBalance.profitMargin,
          balance: houseBalance.balance,
          totalBets: houseBalance.totalBets,
          totalBetAmount: houseBalance.totalBetAmount,
          totalPayout: houseBalance.totalPayout
        };
        console.log('Configurações da casa carregadas do banco de dados:', houseConfig);
      } else {
        // Criar registro inicial
        // @ts-ignore - O modelo houseBalance existe no schema mas não no tipo PrismaClient
        await prisma.houseBalance.create({
          data: {
            gameType: "multiplicador",
            balance: houseConfig.balance,
            profitMargin: houseConfig.profitMargin
          }
        });
        console.log('Configurações iniciais da casa criadas no banco de dados.');
      }
    } catch (error) {
      console.error('Erro ao carregar configurações da casa:', error);
    }
  };

  // Adicionar função para limpar jogadores inativos
  const cleanupInactivePlayers = () => {
    const now = Date.now();
    const inactiveTime = 60000; // 60 segundos
    
    Object.keys(gameState.players).forEach(playerId => {
      const player = gameState.players[playerId];
      if (now - player.lastActivity > inactiveTime && !player.connected) {
        console.log(`Removendo jogador inativo: ${playerId}`);
        delete gameState.players[playerId];
      }
    });
    
    // Atualizar contagem de jogadores
    io.emit('playerCount', Object.keys(gameState.players).length);
  };
  
  // Executar limpeza a cada 30 segundos
  const cleanupInterval = setInterval(cleanupInactivePlayers, 30000);

  // Iniciar um timer para atualizar o tempo restante
  const startTimer = () => {
    if (timerInterval) clearInterval(timerInterval);
    
    const updateTime = () => {
      const now = Date.now();
      gameState.timeLeft = Math.max(0, gameState.endTime - now);
      io.emit('timeUpdate', gameState.timeLeft);
      
      // Verificar automaticamente se é hora de avançar para a próxima fase
      if (gameState.timeLeft <= 0) {
        if (gameState.phase === 'betting') {
          startRound();
        } else if (gameState.phase === 'running') {
          endRound();
        }
      }
    };
    
    // Atualizar a cada segundo
    timerInterval = setInterval(updateTime, 1000);
    updateTime(); // Chamar imediatamente para atualizar o estado inicial
  };

  // Criar uma nova rodada no banco de dados
  const createRoundInDatabase = async () => {
    try {
      // Calcular os tempos com base no tempo atual
      const now = new Date();
      const roundEndTime = new Date(now.getTime() + BETTING_PHASE_DURATION + ROUND_DURATION);
      
      // Criar a rodada no banco de dados
      // @ts-ignore - O modelo gameRound existe no schema mas não no tipo PrismaClient
      const round = await prisma.gameRound.create({
        data: {
          gameType: "multiplicador",
          startTime: now,
          status: "BETTING"
        }
      });
      
      console.log('Nova rodada criada no banco de dados:', round.id);
      return round;
    } catch (error) {
      console.error('Erro ao criar rodada no banco de dados:', error);
      // Retornar um ID falso em caso de erro
      return { id: `round-${Date.now()}` };
    }
  };

  // Função para determinar o resultado final baseado na margem de lucro da casa
  const calculateFinalResult = () => {
    // Calcular o valor total apostado nesta rodada
    const totalBetAmount = gameState.bets.reduce((sum, bet) => sum + bet.amount, 0);
    
    // Se não houver apostas, gerar resultado aleatório
    if (totalBetAmount === 0) {
      // 70% de chance de ser um multiplicador favorável (acima de 1.0)
      return Math.random() > 0.3 ? 
        1.0 + Math.random() : // 1.0 a 2.0
        Math.random(); // 0.0 a 1.0
    }
    
    // Ajustar o resultado para garantir a margem de lucro da casa
    const targetHouseEdge = houseConfig.profitMargin / 100; // Converter porcentagem para decimal
    
    // Probabilidade de resultado favorável ao jogador (multiplicador >= 1.0)
    const favorableProbability = 0.75 - targetHouseEdge; // Base 75% - margem da casa
    
    if (Math.random() < favorableProbability) {
      // Resultado favorável (1.0 a 2.0)
      return 1.0 + Math.random();
    } else {
      // Resultado desfavorável (0.0 a 1.0)
      return Math.random();
    }
  };

  // Função para atualizar o multiplicador durante a rodada
  const updateMultiplier = () => {
    // Atualizar tendência se necessário
    if (trendDuration <= 0) {
      // Gerar nova tendência
      if (Math.random() < crashProbability && gameState.multiplier > 1.2) {
        // Chance de quebra (multiplicador cai drasticamente)
        trendDirection = -1;
        trendStrength = 0.8 + Math.random() * 0.2; // 0.8 a 1.0 (forte queda)
        trendDuration = 3 + Math.floor(Math.random() * 3); // Quebra dura pouco tempo
        console.log('QUEBRA! Multiplicador vai cair drasticamente.');
      } else {
        // Tendência normal
        trendDirection = Math.random() > 0.5 ? 1 : -1; // 50% chance de subir ou descer
        if (Math.random() < 0.2) trendDirection = 0; // 20% chance de tendência neutra
        
        // Força da tendência (maior valor = movimento mais forte na direção da tendência)
        trendStrength = 0.3 + Math.random() * 0.7; // Entre 0.3 e 1.0
        
        // Duração da tendência (em número de atualizações)
        trendDuration = 5 + Math.floor(Math.random() * 10); // Entre 5 e 14 atualizações
      }
      
      // Volatilidade (maior valor = movimentos mais bruscos)
      volatility = 0.2 + Math.random() * 0.8; // Entre 0.2 e 1.0
    }
    
    // Reduzir duração da tendência
    trendDuration--;
    
    // Calcular componente de tendência
    const trendComponent = trendDirection * trendStrength * 0.05; // Escala para ter efeito perceptível
    
    // Calcular componente aleatório (ruído)
    const randomRange = 0.03 * volatility; // Maior volatilidade = maior range de variação aleatória
    const noiseComponent = (Math.random() * randomRange * 2) - randomRange;
    
    // Movimento total
    const change = trendComponent + noiseComponent;
    
    // Atualizar multiplicador com limites
    gameState.multiplier = Math.max(MIN_MULTIPLIER, Math.min(MAX_MULTIPLIER, gameState.multiplier + change));
    
    // Adicionar lógica para garantir que o multiplicador termine próximo ao valor calculado
    const elapsedTimePercentage = (Date.now() - gameState.startTime) / ROUND_DURATION;
    if (elapsedTimePercentage > 0.7) { // Nos últimos 30% do tempo
      // Calcular o resultado final se ainda não foi determinado
      if (!gameState.targetEndValue) {
        gameState.targetEndValue = calculateFinalResult();
        console.log(`Definido valor final alvo: ${gameState.targetEndValue}`);
      }
      
      // Ajustar suavemente em direção ao valor final
      const targetEndValue = gameState.targetEndValue;
      const remainingTimePercent = (1 - elapsedTimePercentage) * 3.33; // Fator de ajuste (0.3 -> 1, 1 -> 0)
      gameState.multiplier = gameState.multiplier + ((targetEndValue - gameState.multiplier) * 0.1 * (1 - remainingTimePercent));
    }
    
    return gameState.multiplier;
  };

  // Função para iniciar uma nova fase de apostas
  const startBettingPhase = async () => {
    try {
      console.log('Iniciando fase de apostas...');
      
      // Criar nova rodada no banco de dados
      const round = await createRoundInDatabase();
      
      // Atualizar o estado do jogo
      gameState.phase = 'betting';
      gameState.roundId = round.id;
      gameState.multiplier = INITIAL_MULTIPLIER; // Resetar multiplicador
      gameState.bets = []; // Limpar apostas anteriores
      gameState.cashOuts = []; // Limpar cash-outs anteriores
      gameState.timeLeft = BETTING_PHASE_DURATION;
      gameState.startTime = Date.now();
      gameState.endTime = Date.now() + BETTING_PHASE_DURATION;
      
      // Parar intervalo anterior se existir
      if (roundInterval) {
        clearInterval(roundInterval);
        roundInterval = null;
      }
      
      // Iniciar o timer
      startTimer();
      
      // Emitir evento para todos os clientes
      io.emit('gamePhaseChange', 'betting');
      io.emit('gameState', {
        phase: gameState.phase,
        roundId: gameState.roundId,
        multiplier: gameState.multiplier,
        timeLeft: gameState.timeLeft,
        bets: gameState.bets,
        connectedPlayers: Object.keys(gameState.players).length
      });
      
      console.log('Fase de apostas iniciada, rodada:', gameState.roundId);
    } catch (error) {
      console.error('Erro ao iniciar fase de apostas:', error);
    }
  };

  // Função para iniciar uma rodada
  const startRound = () => {
    try {
      console.log('Iniciando rodada...');
      
      // Atualizar o estado do jogo
      gameState.phase = 'running';
      gameState.timeLeft = ROUND_DURATION;
      gameState.startTime = Date.now();
      gameState.endTime = Date.now() + ROUND_DURATION;
      
      // Atualizar o status da rodada no banco de dados
      // @ts-ignore - O modelo gameRound existe no schema mas não no tipo PrismaClient
      prisma.gameRound.update({
        where: { id: gameState.roundId },
        data: { 
          status: "RUNNING",
          totalBets: gameState.bets.length,
          totalAmount: gameState.bets.reduce((sum, bet) => sum + bet.amount, 0)
        }
      }).catch((err: Error) => console.error('Erro ao atualizar status da rodada:', err));
      
      // Iniciar o timer
      startTimer();
      
      // Emitir evento para todos os clientes
      io.emit('gamePhaseChange', 'running');
      io.emit('gameStarted', {
        roundId: gameState.roundId,
        timeLeft: gameState.timeLeft,
        bets: gameState.bets
      });
      
      // Atualizar o multiplicador periodicamente
      roundInterval = setInterval(() => {
        const newMultiplier = updateMultiplier();
        io.emit('multiplierUpdate', newMultiplier);
      }, 300); // Atualiza a cada 300ms
      
      console.log('Rodada iniciada, multiplicador ativo');
    } catch (error) {
      console.error('Erro ao iniciar rodada:', error);
      // Recuperar em caso de erro
      setTimeout(() => startBettingPhase(), 5000);
    }
  };

  // Função para encerrar uma rodada
  const endRound = async () => {
    try {
      console.log('Encerrando rodada...');
      
      // Atualizar o estado do jogo
      gameState.phase = 'ended';
      
      // Parar a atualização do multiplicador
      if (roundInterval) {
        clearInterval(roundInterval);
        roundInterval = null;
      }
      
      // Parar o timer
      if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
      }
      
      // Calcular resultado final da rodada
      const finalMultiplier = gameState.multiplier;
      
      // Atualizar o status da rodada no banco de dados
      // @ts-ignore - O modelo gameRound existe no schema mas não no tipo PrismaClient
      await prisma.gameRound.update({
        where: { id: gameState.roundId },
        data: { 
          status: "FINISHED",
          result: finalMultiplier,
          endTime: new Date()
        }
      }).catch((err: Error) => console.error('Erro ao atualizar status da rodada:', err));
      
      // Processar apostas não resgatadas com base no resultado final
      try {
        // Buscar todas as apostas registradas para esta rodada
        const betsInDB = await prisma.bet.findMany({
          where: { 
            roundId: gameState.roundId,
            status: "PENDING"
          },
          include: { user: true }
        });
        
        console.log(`Processando ${betsInDB.length} apostas pendentes para a rodada ${gameState.roundId}`);
        
        // Para cada aposta, atualizar o resultado e o saldo do usuário
        for (const bet of betsInDB) {
          try {
            // Verificar se o usuário já fez cash-out
            const hasCashOut = gameState.cashOuts.some(co => co.playerId === bet.userId);
            
            // Pular se já fez cash-out
            if (hasCashOut) continue;
            
            // Calcular o valor com base no multiplicador final
            const resultAmount = parseFloat((bet.amount * finalMultiplier).toFixed(2));
            const isWin = finalMultiplier >= 1.0;
            
            // Atualizar o status da aposta
            await prisma.bet.update({
              where: { id: bet.id },
              data: {
                status: "COMPLETED",
                result: finalMultiplier,
                winAmount: resultAmount,
                completedAt: new Date()
              }
            });
            
            // Se ganhou, atualizar o saldo do usuário
            if (isWin) {
              await prisma.user.update({
                where: { id: bet.userId },
                data: {
                  balance: {
                    increment: resultAmount
                  }
                }
              });
              
              // Atualizar saldo da casa
              // @ts-ignore - O modelo houseBalance existe no schema mas não no tipo PrismaClient
              await prisma.houseBalance.update({
                where: { gameType: "multiplicador" },
                data: {
                  balance: {
                    decrement: resultAmount
                  },
                  totalPayout: {
                    increment: resultAmount
                  }
                }
              });
              
              console.log(`Usuário ${bet.userId} ganhou R$ ${resultAmount.toFixed(2)} com a aposta ${bet.id}`);
            }
          } catch (betUpdateError) {
            console.error(`Erro ao processar aposta ${bet.id}:`, betUpdateError);
          }
        }
      } catch (dbError) {
        console.error('Erro ao processar apostas no banco de dados:', dbError);
      }
      
      // Emitir evento de fim da rodada com o resultado
      io.emit('gamePhaseChange', 'ended');
      io.emit('gameEnded', {
        finalMultiplier: finalMultiplier,
        bets: gameState.bets,
        cashOuts: gameState.cashOuts
      });
      
      console.log('Rodada finalizada, multiplicador final:', finalMultiplier);
      
      // Aguardar 5 segundos e iniciar uma nova rodada
      setTimeout(() => {
        startBettingPhase();
      }, 5000);
    } catch (roundError) {
      console.error('Erro no processo de finalização da rodada:', roundError);
      setTimeout(() => {
        startBettingPhase();
      }, 10000);
    }
  };

  // Eventos de conexão do Socket.IO
  io.on('connection', (socket) => {
    try {
      console.log('Cliente conectado ao jogo Multiplicador:', socket.id);
      
      // Armazenar informações do jogador
      gameState.players[socket.id] = {
        id: socket.id,
        connected: true,
        lastActivity: Date.now()
      };
      
      // Enviar estado atual do jogo para o novo jogador
      socket.emit('gameState', {
        phase: gameState.phase,
        roundId: gameState.roundId,
        multiplier: gameState.multiplier,
        timeLeft: gameState.timeLeft,
        bets: gameState.bets,
        cashOuts: gameState.cashOuts,
        connectedPlayers: Object.keys(gameState.players).length
      });
      
      // Informar a todos sobre o novo jogador
      io.emit('playerCount', Object.keys(gameState.players).length);
      
      // Ouvir apostas do cliente
      socket.on('placeBet', (data: any) => {
        try {
          // Verificar se o jogo está na fase de apostas
          if (gameState.phase !== 'betting') {
            return;
          }
          
          // Verificar se os dados da aposta são válidos
          if (!data || typeof data !== 'object' || !data.amount) {
            return;
          }
          
          console.log('Aposta recebida:', socket.id, data);
          
          // Adicionar aposta à lista
          const bet: Bet = {
            id: `bet-${Date.now()}-${socket.id}`,
            playerId: socket.id,
            amount: data.amount,
            timestamp: Date.now()
          };
          
          gameState.bets.push(bet);
          
          // Atualizar o timestamp de atividade do jogador
          if (gameState.players[socket.id]) {
            gameState.players[socket.id].lastActivity = Date.now();
          }
          
          // Notificar todos sobre a nova aposta
          io.emit('betPlaced', bet);
        } catch (error) {
          console.error('Erro ao processar aposta:', error);
        }
      });
      
      // Ouvir cash-out do cliente
      socket.on('cashOut', (data: any) => {
        try {
          // Verificar se o jogo está na fase de execução
          if (gameState.phase !== 'running') {
            return;
          }
          
          // Verificar se o jogador tem uma aposta ativa
          const playerBet = gameState.bets.find(bet => bet.playerId === socket.id);
          if (!playerBet) {
            return;
          }
          
          // Verificar se o jogador já fez cash-out
          const hasCashOut = gameState.cashOuts.some(co => co.playerId === socket.id);
          if (hasCashOut) {
            return;
          }
          
          console.log('Cash-out recebido:', socket.id, 'multiplicador:', gameState.multiplier);
          
          // Registrar o cash-out
          const cashOut: CashOut = {
            playerId: socket.id,
            multiplier: gameState.multiplier,
            timestamp: Date.now()
          };
          
          gameState.cashOuts.push(cashOut);
          
          // Atualizar o timestamp de atividade do jogador
          if (gameState.players[socket.id]) {
            gameState.players[socket.id].lastActivity = Date.now();
          }
          
          // Notificar todos sobre o novo cash-out
          io.emit('cashOutMade', cashOut);
        } catch (error) {
          console.error('Erro ao processar cash-out:', error);
        }
      });
      
      // Gerenciar desconexão do jogador
      socket.on('disconnect', () => {
        try {
          console.log('Cliente desconectado:', socket.id);
          
          // Atualizar estado do jogador como desconectado
          if (gameState.players[socket.id]) {
            gameState.players[socket.id].connected = false;
            gameState.players[socket.id].lastActivity = Date.now();
          }
          
          // Enviar contagem atualizada para todos os clientes
          const connectedCount = Object.keys(gameState.players).filter(id => 
            gameState.players[id].connected).length;
          
          io.emit('playerCount', connectedCount);
        } catch (error) {
          console.error('Erro ao processar desconexão:', error);
        }
      });
    } catch (error) {
      console.error('Erro ao manipular conexão:', error);
    }
  });

  // Limpeza ao encerrar
  res.socket.server.on('close', () => {
    if (roundInterval) clearInterval(roundInterval);
    if (timerInterval) clearInterval(timerInterval);
    if (cleanupInterval) clearInterval(cleanupInterval);
  });

  // Carregar configurações da casa
  await loadHouseConfig();

  // Iniciar o jogo com uma nova rodada apenas na primeira inicialização
  if (isFirstInitialization) {
    await startBettingPhase();
  }
  
  console.log('Socket.IO para o jogo Multiplicador inicializado!');
  res.end();
};

export default MultiplierSocketHandler; 