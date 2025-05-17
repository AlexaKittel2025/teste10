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

// Constantes do jogo - estáticas, não mudam em tempo real
const INITIAL_MULTIPLIER = 1.0; // Multiplicador inicial padrão
const MAX_MULTIPLIER = 2.0; // Multiplicador máximo
const MIN_MULTIPLIER = 0.0; // Multiplicador mínimo

// Configurações de duração - precisam ser declaradas antes de usar
const BETTING_PHASE_DURATION_DEFAULT = 5000; // 5 segundos para apostas (padrão)
const ROUND_DURATION_DEFAULT = 20000; // 20 segundos para a rodada em execução (padrão)

// Função para gerar multiplicador inicial variável
const getRandomInitialMultiplier = () => {
  // Multiplicador inicial pode variar entre 0.7 e 1.3
  return 0.7 + (Math.random() * 0.6);
};

// Estado do jogo
let gameState: GameState = {
  phase: 'betting',
  roundId: '',
  multiplier: INITIAL_MULTIPLIER,
  players: {},
  bets: [],
  cashOuts: [],
  timeLeft: BETTING_PHASE_DURATION_DEFAULT,
  startTime: Date.now(),
  endTime: Date.now() + BETTING_PHASE_DURATION_DEFAULT,
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

  // Configuração padrão do jogo - valores mais variados
  const defaultConfig = {
    profitMargin: 5,
    initialMultiplier: 1.0,
    maxMultiplier: 2.0,
    minMultiplier: 0.0,
    trendStrength: 0.6,
    volatility: 0.7,
    crashProbability: 0.15,
    aboveOneProbability: 0.45,
    bettingPhaseDuration: 5000,
    roundDuration: 20000
  };

  // Configuração atual do jogo (pode ser sobrescrita pelo banco de dados)
  let gameConfig = { ...defaultConfig };

  // Variáveis para controlar a evolução do multiplicador - valores iniciais mais variados
  let trendDirection = 0; // -1 (diminuindo), 0 (neutro), 1 (aumentando)
  let trendStrength = 0.5 + (Math.random() * 0.5); // Força da tendência inicial aleatória (0.5 a 1.0)
  let trendDuration = 0; // Duração restante da tendência atual
  let volatility = 0.3 + (Math.random() * 0.7); // Volatilidade inicial aleatória (0.3 a 1.0)
  let crashProbability = 0.1 + (Math.random() * 0.2); // Probabilidade de "quebra" aleatória (10% a 30%)
  let aboveOneProbability = 0.35 + (Math.random() * 0.3); // Probabilidade de resultado acima de 1.0 (35% a 65%)
  
  // Configurações de duração - valores que podem ser sobrescritos pela configuração do banco
  let BETTING_PHASE_DURATION = BETTING_PHASE_DURATION_DEFAULT; // Usar valor padrão inicialmente
  let ROUND_DURATION = ROUND_DURATION_DEFAULT; // Usar valor padrão inicialmente

  // Buscar todas as configurações do jogo do banco de dados
  const loadGameConfig = async () => {
    try {
      // Parte 1: Carregar configuração financeira da casa
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
          console.log('Configurações financeiras carregadas do banco de dados:', houseConfig);
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
          console.log('Configurações financeiras iniciais criadas no banco de dados.');
        }
      } catch (err) {
        console.error('Erro ao carregar configurações financeiras da casa:', err);
      }
      
      // Parte 2: Carregar configurações avançadas do jogo
      try {
        // @ts-ignore - O modelo systemConfig existe no schema mas não no tipo PrismaClient
        const configRecord = await prisma.systemConfig.findFirst({
          where: { key: 'multiplier_config' }
        });
        
        if (configRecord) {
          // Analisar JSON das configurações avançadas
          try {
            const advancedConfig = JSON.parse(configRecord.value);
            
            // Aplicar configurações avançadas ao gameConfig
            gameConfig = { ...gameConfig, ...advancedConfig };
            
            // Aplicar às variáveis individuais
            if (advancedConfig.trendStrength !== undefined) trendStrength = advancedConfig.trendStrength;
            if (advancedConfig.volatility !== undefined) volatility = advancedConfig.volatility;
            if (advancedConfig.crashProbability !== undefined) crashProbability = advancedConfig.crashProbability;
            if (advancedConfig.aboveOneProbability !== undefined) aboveOneProbability = advancedConfig.aboveOneProbability;
            if (advancedConfig.bettingPhaseDuration !== undefined) BETTING_PHASE_DURATION = advancedConfig.bettingPhaseDuration;
            if (advancedConfig.roundDuration !== undefined) ROUND_DURATION = advancedConfig.roundDuration;
            
            // Garantir que profitMargin esteja sincronizada com a config da house
            if (advancedConfig.profitMargin !== undefined && advancedConfig.profitMargin !== houseConfig.profitMargin) {
              houseConfig.profitMargin = advancedConfig.profitMargin;
            }
            
            console.log('Configurações avançadas carregadas:', {
              trendStrength,
              volatility,
              crashProbability,
              aboveOneProbability,
              BETTING_PHASE_DURATION,
              ROUND_DURATION
            });
          } catch (parseError) {
            console.error('Erro ao analisar configurações avançadas:', parseError);
          }
        } else {
          console.log('Configurações avançadas não encontradas, usando valores padrão');
        }
      } catch (err) {
        console.error('Erro ao carregar configurações avançadas:', err);
      }
    } catch (error) {
      console.error('Erro ao carregar configurações do jogo:', error);
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
      // Calcular os tempos com base no tempo atual e durações configuráveis
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

  // Função para determinar o resultado final com distribuição mais variada
  const calculateFinalResult = () => {
    // Calcular o valor total apostado nesta rodada
    const totalBetAmount = gameState.bets.reduce((sum, bet) => sum + bet.amount, 0);
    
    // Se não houver apostas, gerar resultado aleatório variado
    if (totalBetAmount === 0) {
      return Math.random() * 2; // Qualquer valor entre 0.0 e 2.0
    }
    
    // Carregar configurações atuais
    const config = gameConfig || defaultConfig;
    const targetHouseEdge = config.profitMargin / 100;
    const baseProbability = config.aboveOneProbability / 100;
    
    // Adicionar variação aleatória para cada rodada
    const randomVariation = (Math.random() - 0.5) * 0.3; // ±15% de variação
    const adjustedProbability = Math.max(0.2, Math.min(0.8, baseProbability + randomVariation - targetHouseEdge));
    
    // Determinar categoria de multiplicador
    const roll = Math.random();
    
    if (roll < adjustedProbability) {
      // Resultado acima de 1.0 - Distribuição mais ampla
      const highValue = Math.random();
      if (highValue < 0.05) {
        // 5% chance de multiplicador especial alto (1.9 a 2.0)
        return 1.9 + (0.1 * Math.random());
      } else if (highValue < 0.15) {
        // 10% chance de valores muito altos (1.7 a 1.9)
        return 1.7 + (0.2 * Math.random());
      } else if (highValue < 0.35) {
        // 20% chance de valores altos (1.4 a 1.7)
        return 1.4 + (0.3 * Math.random());
      } else if (highValue < 0.65) {
        // 30% chance de valores médios (1.2 a 1.4)
        return 1.2 + (0.2 * Math.random());
      } else {
        // 35% chance de valores baixos (1.0 a 1.2)
        return 1.0 + (0.2 * Math.random());
      }
    } else {
      // Resultado abaixo de 1.0 - Distribuição mais variada
      const lowValue = Math.random();
      if (lowValue < 0.05) {
        // 5% chance de valores muito baixos (0.01 a 0.1)
        return 0.01 + (0.09 * Math.random());
      } else if (lowValue < 0.15) {
        // 10% chance de valores baixos (0.1 a 0.3)
        return 0.1 + (0.2 * Math.random());
      } else if (lowValue < 0.35) {
        // 20% chance de valores médios-baixos (0.3 a 0.6)
        return 0.3 + (0.3 * Math.random());
      } else if (lowValue < 0.65) {
        // 30% chance de valores médios (0.6 a 0.8)
        return 0.6 + (0.2 * Math.random());
      } else {
        // 35% chance de valores altos (0.8 a 0.95)
        return 0.8 + (0.15 * Math.random());
      }
    }
  };

  // Função para atualizar o multiplicador durante a rodada
  const updateMultiplier = () => {
    // Atualizar tendência se necessário
    if (trendDuration <= 0) {
      // Gerar nova tendência
      // Usar crashProbability da configuração para determinar chances de quebra
      if (Math.random() < crashProbability && gameState.multiplier > 1.1) {
        // Chance de quebra (multiplicador cai drasticamente)
        trendDirection = -1;
        trendStrength = 0.9 + Math.random() * 0.1; // 0.9 a 1.0 (queda muito forte)
        trendDuration = 5 + Math.floor(Math.random() * 4); // Quebra dura mais tempo (5-8 ciclos)
        console.log('QUEBRA! Multiplicador vai cair drasticamente.');
      } else {
        // Tendências mais aleatórias e dinâmicas
        const randomFactor = Math.random();
        let upProbability = 0.5; // Probabilidade base equilibrada
        
        // Adicionar variação aleatória geral
        upProbability += (Math.random() - 0.5) * 0.3; // ±15% de variação
        
        // Ajustes baseados no multiplicador atual (menos previsíveis)
        if (gameState.multiplier > 1.8) {
          upProbability *= 0.3 + (randomFactor * 0.4); // Mais chance de cair, mas com variação
        } else if (gameState.multiplier > 1.4) {
          upProbability *= 0.4 + (randomFactor * 0.3); 
        } else if (gameState.multiplier > 1.0) {
          upProbability *= 0.5 + (randomFactor * 0.3); // Médio quando acima de 1.0
        } else if (gameState.multiplier < 0.2) {
          upProbability *= 1.4 + (randomFactor * 0.4); // Tende a subir de valores muito baixos
        } else if (gameState.multiplier < 0.5) {
          upProbability *= 1.2 + (randomFactor * 0.3);
        } else {
          upProbability *= 0.8 + (randomFactor * 0.4); // Variação média
        }
        
        // Garantir que upProbability fique entre 0.1 e 0.9
        upProbability = Math.max(0.1, Math.min(0.9, upProbability));
        
        // Define a direção da tendência com base na probabilidade ajustada
        trendDirection = Math.random() < upProbability ? 1 : -1;
        if (Math.random() < 0.25) trendDirection = 0; // 25% chance de tendência neutra (mais momentos de estabilidade)
        
        // Força da tendência mais variada
        trendStrength = 0.1 + Math.random() * 0.9; // Entre 0.1 e 1.0 (mais amplitude)
        
        // Duração da tendência mais variável
        trendDuration = 3 + Math.floor(Math.random() * 15); // Entre 3 e 17 atualizações
      }
      
      // Volatilidade com mais variação
      volatility = 0.1 + Math.random() * 0.9; // Entre 0.1 e 1.0 (pode ser bem calmo ou muito volátil)
    }
    
    // Reduzir duração da tendência
    trendDuration--;
    
    // Calcular componente de tendência com escala maior para mais variação
    const trendComponent = trendDirection * trendStrength * 0.08; // Aumentado de 0.05 para 0.08
    
    // Calcular componente aleatório com mais amplitude
    const randomRange = 0.05 * volatility; // Aumentado de 0.03 para 0.05
    const noiseComponent = (Math.random() * randomRange * 2) - randomRange;
    
    // Movimento total
    const change = trendComponent + noiseComponent;
    
    // Atualizar multiplicador com limites
    gameState.multiplier = Math.max(MIN_MULTIPLIER, Math.min(MAX_MULTIPLIER, gameState.multiplier + change));
    
    // Adicionar lógica para garantir que o multiplicador termine próximo ao valor calculado
    const elapsedTimePercentage = (Date.now() - gameState.startTime) / ROUND_DURATION;
    
    // Começar a direcionar o resultado mais cedo e com ajuste mais forte
    if (elapsedTimePercentage > 0.5) { // Nos últimos 50% do tempo
      // Calcular o resultado final se ainda não foi determinado
      if (!gameState.targetEndValue) {
        // Usar a função calculateFinalResult para maior consistência e variedade
        gameState.targetEndValue = calculateFinalResult();
        console.log(`Definido valor final alvo: ${gameState.targetEndValue}`);
      }
      
      // Ajustar mais agressivamente em direção ao valor final
      const targetEndValue = gameState.targetEndValue;
      const remainingTimePercent = (1 - elapsedTimePercentage) * 2.0; // Fator de ajuste mais agressivo
      
      // Quanto mais perto do final, mais forte o ajuste (aumentando de 15% para 30%)
      const adjustmentFactor = 0.15 + (0.15 * (1 - remainingTimePercent));
      
      // Ajuste mais forte para valores acima de 1.0 que precisam diminuir
      const directionFactor = (targetEndValue < gameState.multiplier && gameState.multiplier > 1.0) ? 2.0 : 1.0;
      
      gameState.multiplier = gameState.multiplier + 
        ((targetEndValue - gameState.multiplier) * adjustmentFactor * directionFactor);
      
      // Log para debug
      if (elapsedTimePercentage > 0.9) {
        console.log(`Ajustando para valor final: atual=${gameState.multiplier.toFixed(2)}, alvo=${targetEndValue.toFixed(2)}`);
      }
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
      gameState.multiplier = INITIAL_MULTIPLIER; // Durante apostas, volta ao padrão
      gameState.bets = []; // Limpar apostas anteriores
      gameState.cashOuts = []; // Limpar cash-outs anteriores
      gameState.timeLeft = BETTING_PHASE_DURATION; // Usar duração configurável
      gameState.startTime = Date.now();
      gameState.endTime = Date.now() + BETTING_PHASE_DURATION; // Usar duração configurável
      
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
      gameState.timeLeft = ROUND_DURATION; // Usar duração configurável
      gameState.startTime = Date.now();
      gameState.endTime = Date.now() + ROUND_DURATION; // Usar duração configurável
      gameState.multiplier = getRandomInitialMultiplier(); // Começar com valor variável
      gameState.targetEndValue = null; // Resetar valor final
      
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
      
      // Processar apostas não resgatadas com base no resultado final (Sistema Trader)
      // IMPORTANTE: No sistema trader, o usuário SEMPRE recebe valor_apostado × multiplicador_final
      // Mesmo que o multiplicador seja menor que 1.0, o usuário recebe algo de volta
      try {
        // Buscar todas as apostas registradas para esta rodada
        const betsInDB = await prisma.bet.findMany({
          where: { 
            roundId: gameState.roundId,
            status: "PENDING"
          },
          include: { user: true }
        });
        
        console.log(`\n=== PROCESSANDO APOSTAS NO FIM DA RODADA (SOCKET) ===`);
        console.log(`Rodada: ${gameState.roundId}`);
        console.log(`Multiplicador final: ${finalMultiplier}x`);
        console.log(`Total de apostas pendentes: ${betsInDB.length}`);
        console.log(`==================================================`);
        
        // Para cada aposta, atualizar o resultado e o saldo do usuário
        for (const bet of betsInDB) {
          try {
            // Verificar se o usuário já fez cash-out
            const hasCashOut = gameState.cashOuts.some(co => co.playerId === bet.userId);
            
            // Pular se já fez cash-out
            if (hasCashOut) continue;
            
            // Calcular o valor com base no multiplicador final (estilo trader)
            const resultAmount = parseFloat((bet.amount * finalMultiplier).toFixed(2));
            
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
            
            // SEMPRE atualizar o saldo do usuário (sistema trader)
            // O valor retornado é sempre aposta × multiplicador
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
            
            console.log(`\n[SOCKET] Processamento de aposta:`);
            console.log(`- Usuário: ${bet.userId}`);
            console.log(`- Aposta: R$ ${bet.amount}`);
            console.log(`- Multiplicador: ${finalMultiplier}x`);
            console.log(`- Valor recebido: R$ ${resultAmount.toFixed(2)}`);
            console.log(`- Status: ${finalMultiplier < 1 ? 'RETORNO PARCIAL' : 'LUCRO'}`);
            console.log(`- Saldo incrementado em: R$ ${resultAmount.toFixed(2)}`);
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
        roundId: gameState.roundId,
        bets: gameState.bets,
        cashOuts: gameState.cashOuts
      });
      
      // Também emitir um gameState atualizado com o multiplicador final
      io.emit('gameState', {
        phase: 'ended',
        roundId: gameState.roundId,
        multiplier: finalMultiplier,
        finalMultiplier: finalMultiplier,
        timeLeft: 0,
        bets: gameState.bets,
        cashOuts: gameState.cashOuts,
        connectedPlayers: Object.keys(gameState.players).length
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

  // Carregar todas as configurações do jogo
  await loadGameConfig();

  // Iniciar o jogo com uma nova rodada apenas na primeira inicialização
  if (isFirstInitialization) {
    await startBettingPhase();
  }
  
  console.log('Socket.IO para o jogo Multiplicador inicializado!');
  res.end();
};

export default MultiplierSocketHandler; 