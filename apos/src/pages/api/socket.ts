import { Server } from 'socket.io';
import type { NextApiRequest } from 'next';
import type { Socket as NetSocket } from 'net';
import type { Server as HTTPServer } from 'http';
import type { NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { 
  BETTING_PHASE_DURATION, 
  ROUND_DURATION, 
  WIN_MULTIPLIER,
  BetType,
  RoundStatus
} from '@/lib/game-constants';

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
  type: string;
  timestamp: number;
}

interface GameState {
  linePosition: number;
  phase: string;
  roundId: string;
  players: Record<string, Player>;
  bets: Bet[];
  timeLeft: number;
  startTime: number;
  endTime: number;
}

// Constantes já importadas de @/lib/game-constants

// Estado do jogo
let gameState: GameState = {
  linePosition: 50,
  phase: 'betting',
  roundId: '',
  players: {},
  bets: [],
  timeLeft: BETTING_PHASE_DURATION,
  startTime: Date.now(),
  endTime: Date.now() + BETTING_PHASE_DURATION,
};

// Armazenar a instância do servidor para evitar recriação
let cachedIo: Server | null = null;

const SocketHandler = async (req: NextApiRequest, res: NextApiResponseWithSocket) => {
  // Se o socket já existe, não crie um novo
  if (res.socket.server.io) {
    console.log('Socket já está em execução');
    res.end();
    return;
  }
  
  console.log('Inicializando Socket.IO...');
  
  // Reutilizar a instância se existir
  const io = cachedIo || new Server(res.socket.server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    },
    // Adicionar configurações para estabilizar a conexão
    pingTimeout: 60000,       // Tempo para aguardar resposta do ping (ms)
    pingInterval: 25000,      // Intervalo entre pings (ms)
    transports: ['websocket', 'polling'],  // Tenta websocket primeiro, depois polling
    allowUpgrades: true,      // Permite upgrade de polling para websocket
    upgradeTimeout: 10000,    // Tempo para tentar upgrade (ms)
    maxHttpBufferSize: 1e8,   // Aumentar tamanho do buffer
    connectTimeout: 45000,    // Tempo para estabelecer conexão (ms)
    path: '/api/socket.io',   // Caminho atualizado para corresponder à configuração do cliente
    serveClient: false        // Não servir cliente
  });
  
  // Armazenar para reutilização
  cachedIo = io;
  res.socket.server.io = io;
  
  // Variáveis de controle do jogo
  let roundInterval: NodeJS.Timeout | null = null;
  let timerInterval: NodeJS.Timeout | null = null;
  let activeConnections = 0;
  let isProcessingConnection = false;
  let connectionDebounceMap: Record<string, number> = {}; // Controle de reconexões por IP
  let isFirstInitialization = !gameState.roundId; // Verificar se é a primeira inicialização

  // Variáveis para controlar a tendência do gráfico
  let trendDirection = 0; // -1 (descendo), 0 (neutro), 1 (subindo)
  let trendStrength = 0.5; // Força da tendência atual (0 a 1)
  let trendDuration = 0; // Duração restante da tendência atual
  let volatility = 0.5; // Volatilidade atual (0 a 1)

  // Adicionar função para limpar jogadores inativos
  const cleanupInactivePlayers = () => {
    const now = Date.now();
    const inactiveTime = 60000; // Aumentado para 60 segundos
    
    Object.keys(gameState.players).forEach(playerId => {
      const player = gameState.players[playerId];
      if (now - player.lastActivity > inactiveTime && !player.connected) {
        console.log(`Removendo jogador inativo: ${playerId}`);
        delete gameState.players[playerId];
      }
    });
    
    // Limpar também mapa de controle de debounce
    Object.keys(connectionDebounceMap).forEach(ip => {
      if (now - connectionDebounceMap[ip] > inactiveTime) {
        delete connectionDebounceMap[ip];
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
      const bettingEndTime = new Date(now.getTime() + BETTING_PHASE_DURATION);
      const roundEndTime = new Date(bettingEndTime.getTime() + ROUND_DURATION);
      
      // Gerar um resultado aleatório para esta rodada
      const result = Math.random() * 100;
      
      // Criar a rodada no banco de dados
      const round = await prisma.round.create({
        data: {
          result,
          startTime: now,
          endTime: roundEndTime,
          status: 'BETTING',
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

  // Função para simular o movimento da linha com características de mercado financeiro
  const updateLine = () => {
    // Atualizar tendência se necessário
    if (trendDuration <= 0) {
      // Gerar nova tendência
      trendDirection = Math.random() > 0.5 ? 1 : -1; // 50% chance de subir ou descer
      if (Math.random() < 0.2) trendDirection = 0; // 20% chance de tendência neutra
      
      // Força da tendência (maior valor = movimento mais forte na direção da tendência)
      trendStrength = 0.3 + Math.random() * 0.7; // Entre 0.3 e 1.0
      
      // Duração da tendência (em número de atualizações)
      trendDuration = 5 + Math.floor(Math.random() * 10); // Entre 5 e 14 atualizações
      
      // Volatilidade (maior valor = movimentos mais bruscos)
      volatility = 0.2 + Math.random() * 0.8; // Entre 0.2 e 1.0
      
      console.log(`Nova tendência: ${trendDirection > 0 ? 'ALTA' : trendDirection < 0 ? 'BAIXA' : 'NEUTRA'}, 
                   força: ${trendStrength.toFixed(2)}, 
                   duração: ${trendDuration}, 
                   volatilidade: ${volatility.toFixed(2)}`);
    }
    
    // Reduzir duração da tendência
    trendDuration--;
    
    // Calcular componente de tendência
    const trendComponent = trendDirection * trendStrength * 3; // Escala para ter efeito perceptível
    
    // Calcular componente aleatório (ruído)
    const randomRange = 5 * volatility; // Maior volatilidade = maior range de variação aleatória
    const noiseComponent = (Math.random() * randomRange * 2) - randomRange;
    
    // Movimento total
    const change = trendComponent + noiseComponent;
    
    // Atualizar posição com limites
    gameState.linePosition = Math.max(0, Math.min(100, gameState.linePosition + change));
    
    // Adicionar pequena chance de reversão de tendência se valores muito extremos
    if (gameState.linePosition > 90 && trendDirection > 0) {
      if (Math.random() < 0.3) { // 30% chance de reverter se muito alto
        trendDirection = -1;
        trendDuration = 3 + Math.floor(Math.random() * 5);
        console.log('Reversão para baixo devido a valor muito alto');
      }
    } else if (gameState.linePosition < 10 && trendDirection < 0) {
      if (Math.random() < 0.3) { // 30% chance de reverter se muito baixo
        trendDirection = 1;
        trendDuration = 3 + Math.floor(Math.random() * 5);
        console.log('Reversão para cima devido a valor muito baixo');
      }
    }
    
    return gameState.linePosition;
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
      gameState.linePosition = 50; // Resetar posição da linha
      gameState.bets = []; // Limpar apostas anteriores
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
      io.emit('bettingStart', {
        roundId: gameState.roundId,
        timeLeft: gameState.timeLeft,
        linePosition: gameState.linePosition
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
      prisma.round.update({
        where: { id: gameState.roundId },
        data: { status: 'RUNNING' }
      }).catch(err => console.error('Erro ao atualizar status da rodada:', err));
      
      // Iniciar o timer
      startTimer();
      
      // Emitir evento para todos os clientes
      io.emit('roundStart', {
        roundId: gameState.roundId,
        timeLeft: gameState.timeLeft,
        bets: gameState.bets
      });
      
      // Atualizar a posição da linha periodicamente
      roundInterval = setInterval(() => {
        const newLine = updateLine();
        io.emit('lineUpdate', newLine);
      }, 300); // Atualiza a cada 300ms
      
      console.log('Rodada iniciada, movimento da linha ativado');
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
      gameState.phase = 'finished';
      
      // Parar a atualização da linha
      if (roundInterval) {
        clearInterval(roundInterval);
        roundInterval = null;
      }
      
      // Parar o timer
      if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
      }
      
      // Atualizar o status da rodada no banco de dados
      await prisma.round.update({
        where: { id: gameState.roundId },
        data: { status: 'FINISHED' }
      }).catch(err => console.error('Erro ao atualizar status da rodada:', err));
      
      // Processar resultado e determinar vencedores
      try {
        const finalResult = gameState.linePosition;
        // Correção: no CSS, valores menores significam posição mais alta na tela
        // Então se finalResult < 50, a linha está acima do meio visualmente
        const isAbove = finalResult < 50; // Corrigido: agora < 50 significa ACIMA visualmente
        
        // Processar apostas e atualizar saldos dos jogadores
        const winType = isAbove ? 'ABOVE' : 'BELOW';
        
        console.log(`Multiplicador de ganho definido como: ${WIN_MULTIPLIER}x`);
        
        // Processar apostas no banco de dados
        try {
          // Buscar todas as apostas registradas para esta rodada que estão PENDENTES
          // Isso exclui apostas que já foram processadas via cash-out
          const betsInDB = await prisma.bet.findMany({
            where: { 
              roundId: gameState.roundId,
              status: 'PENDING'  // Importante: processar apenas apostas pendentes
            },
            include: { user: true }
          });
          
          console.log(`Processando ${betsInDB.length} apostas pendentes para a rodada ${gameState.roundId}`);
          
          // Para cada aposta, atualizar o resultado e o saldo do usuário
          for (const bet of betsInDB) {
            try {
              // Verificar se há um cash-out associado a esta aposta
              // @ts-ignore
              const cashOut = await prisma.cashOut.findFirst({
                where: { betId: bet.id }
              });
              
              if (cashOut) {
                console.log(`Aposta ${bet.id} já processada via cash-out, ignorando`);
                continue; // Pular para a próxima aposta
              }
              
              // Determinar se a aposta foi vencedora
              const didWin = bet.type === winType;
              const betResult = didWin ? 'WIN' : 'LOSE';
              
              // Usar uma transação para garantir a consistência
              await prisma.$transaction(async (tx) => {
                // Atualizar o resultado da aposta
                await tx.bet.update({
                  where: { id: bet.id },
                  data: { 
                    status: 'COMPLETED',
                    result: betResult,
                    completedAt: new Date()
                  }
                });
                
                // Se ganhou, atualizar o saldo do usuário com o multiplicador correto
                if (didWin) {
                  // Calcular valor ganho com o multiplicador definido
                  const winAmount = parseFloat((bet.amount * WIN_MULTIPLIER).toFixed(2));
                  
                  console.log(`Aplicando ganho: Aposta ${bet.amount} x ${WIN_MULTIPLIER} = ${winAmount}`);
                  
                  await tx.user.update({
                    where: { id: bet.userId },
                    data: {
                      balance: {
                        increment: winAmount
                      }
                    }
                  });
                  
                  // Registrar o ganho como transação para melhor rastreabilidade
                  await tx.transaction.create({
                    data: {
                      userId: bet.userId,
                      amount: winAmount,
                      type: 'DEPOSIT',
                      status: 'COMPLETED',
                      details: JSON.stringify({
                        description: 'Ganho em jogo',
                        gameType: 'multiplicador',
                        roundId: gameState.roundId,
                        betId: bet.id,
                        multiplier: WIN_MULTIPLIER
                      })
                    }
                  });
                  
                  console.log(`Usuário ${bet.userId} ganhou R$ ${winAmount.toFixed(2)} com a aposta ${bet.id}`);
                }
              });
            } catch (betUpdateError) {
              console.error(`Erro ao processar aposta ${bet.id}:`, betUpdateError);
              // Continuar processando outras apostas
            }
          }
        } catch (dbError) {
          console.error('Erro ao processar apostas no banco de dados:', dbError);
        }
        
        // Emitir evento de fim da rodada com o resultado e multiplicador explícito
        io.emit('roundEnd', {
          result: finalResult,
          displayResult: Math.round(100 - finalResult), // Conversão para exibição: inverter a escala para corresponder à intuição visual
          winType: winType,
          bets: gameState.bets,
          multiplier: WIN_MULTIPLIER // Certificar-se de enviar o multiplicador correto
        });
        
        console.log('Rodada finalizada, resultado:', finalResult, 'exibição:', Math.round(100 - finalResult), 'winType:', winType, 'multiplicador:', WIN_MULTIPLIER);
      } catch (error) {
        console.error('Erro ao processar resultado:', error);
      }
      
      // Aguardar 5 segundos e iniciar uma nova rodada
      setTimeout(() => {
        startBettingPhase();
      }, 5000);
    } catch (roundError) {
      console.error('Erro no processo de finalização da rodada:', roundError);
      // Tentar reiniciar o jogo após um pequeno atraso
      setTimeout(() => {
        startBettingPhase();
      }, 10000);
    }
  };

  // Eventos de conexão do Socket.IO
  io.on('connection', (socket) => {
    try {
      // Obter IP do cliente
      const clientIp = socket.handshake.headers['x-real-ip'] || 
                       socket.handshake.headers['x-forwarded-for'] || 
                       socket.handshake.address;
      const now = Date.now();
      
      // Verificar se este IP se conectou recentemente (debounce)
      if (connectionDebounceMap[clientIp as string] && 
          now - connectionDebounceMap[clientIp as string] < 1000) { // Reduzido para 1 segundo
        console.log('Conexão muito rápida do mesmo IP, ignorando limitação para melhorar a experiência');
        // Não rejeitamos mais, apenas registramos o aviso
      }
      
      // Registrar timestamp da conexão para este IP
      connectionDebounceMap[clientIp as string] = now;
      
      // Adicionar lógica anti-spam com limite maior
      activeConnections++;
      if (activeConnections > 200) { // Aumentado para 200
        console.log('Limite de conexões atingido, rejeitando: ', socket.id);
        socket.disconnect(true);
        activeConnections--;
        return;
      }
      
      // Remover lógica de bloqueio por processamento
      // para evitar problemas com múltiplas conexões
      console.log('Cliente conectado:', socket.id);
      
      try {
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
          linePosition: gameState.linePosition,
          timeLeft: gameState.timeLeft,
          bets: gameState.bets,
          connectedPlayers: Object.keys(gameState.players).length
        });
        
        // Enviar evento específico baseado na fase atual
        if (gameState.phase === 'betting') {
          socket.emit('bettingStart', {
            roundId: gameState.roundId,
            timeLeft: gameState.timeLeft,
            linePosition: gameState.linePosition
          });
        } else if (gameState.phase === 'running') {
          socket.emit('roundStart', {
            roundId: gameState.roundId,
            timeLeft: gameState.timeLeft,
            bets: gameState.bets
          });
        }
        
        // Informar a todos sobre o novo jogador
        io.emit('playerCount', Object.keys(gameState.players).length);
        
        // Ouvir apostas do cliente com tratamento de erros
        socket.on('placeBet', (data: any) => {
          try {
            // Verificar se o jogo está na fase de apostas
            if (gameState.phase !== 'betting') {
              return;
            }
            
            // Verificar se os dados da aposta são válidos
            if (!data || typeof data !== 'object' || !data.amount || !data.type) {
              return;
            }
            
            console.log('Aposta recebida:', socket.id, data);
            
            // Adicionar aposta à lista
            const bet: Bet = {
              id: `bet-${Date.now()}-${socket.id}`,
              playerId: socket.id,
              amount: data.amount,
              type: data.type,
              timestamp: Date.now()
            };
            
            gameState.bets.push(bet);
            
            // Atualizar o timestamp de atividade do jogador
            if (gameState.players[socket.id]) {
              gameState.players[socket.id].lastActivity = Date.now();
            }
            
            // Notificar todos sobre a nova aposta
            io.emit('newBet', bet);
          } catch (error) {
            console.error('Erro ao processar aposta:', error);
          }
        });
        
        // Gerenciar desconexão do jogador
        socket.on('disconnect', () => {
          try {
            console.log('Cliente desconectado:', socket.id);
            
            // Atualizar estado do jogador como desconectado, mas manter dados
            if (gameState.players[socket.id]) {
              gameState.players[socket.id].connected = false;
              gameState.players[socket.id].lastActivity = Date.now();
            }
            
            // Atualizar contagem de jogadores
            activeConnections--;
            
            // Enviar contagem atualizada para todos os clientes
            const connectedCount = Object.keys(gameState.players).filter(id => 
              gameState.players[id].connected).length;
            
            io.emit('playerCount', connectedCount);
          } catch (error) {
            console.error('Erro ao processar desconexão:', error);
          }
        });
        
        // Ouvir chat dos jogadores com validação
        socket.on('chatMessage', (message: string) => {
          try {
            // Verificar se a mensagem é válida e não está vazia
            if (!message || typeof message !== 'string' || !message.trim()) {
              return;
            }
            
            // Limitar tamanho da mensagem e remover caracteres potencialmente perigosos
            const sanitizedMessage = message.substring(0, 200)
              .replace(/[<>]/g, ''); // Remover caracteres HTML
            
            // Atualizar timestamp de atividade do jogador
            if (gameState.players[socket.id]) {
              gameState.players[socket.id].lastActivity = Date.now();
            }
            
            // Emitir mensagem para todos os jogadores
            io.emit('chatMessage', {
              playerId: socket.id,
              message: sanitizedMessage,
              timestamp: Date.now()
            });
          } catch (error) {
            console.error('Erro ao processar mensagem de chat:', error);
          }
        });
      } finally {
        isProcessingConnection = false;
      }
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

  // Iniciar o jogo com uma nova rodada apenas na primeira inicialização
  if (isFirstInitialization) {
    await startBettingPhase();
  }
  
  console.log('Socket.IO inicializado com recursos multiplayer!');
  res.end();
};

export default SocketHandler; 