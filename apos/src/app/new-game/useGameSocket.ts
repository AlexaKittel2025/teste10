import { useCallback, useRef, useEffect } from 'react';
import io, { Socket } from 'socket.io-client';
import { GamePhase, GameState } from './constants';

interface UseGameSocketProps {
  onGameStateUpdate: (state: GameState) => void;
  onPhaseChange: (phase: GamePhase) => void;
  onTimeUpdate: (time: number) => void;
  onMultiplierUpdate: (multiplier: number) => void;
  onBetResult: (data: any) => void;
  onCashOutResult: (data: any) => void;
  onPlayerCountUpdate: (count: number) => void;
  onError: (error: any) => void;
  onGameEnded?: (data: any) => void;
  sessionUserId?: string;
}

// Variável global para armazenar a única instância do socket
let globalSocketInstance: Socket | null = null;

export const useGameSocket = ({
  onGameStateUpdate,
  onPhaseChange,
  onTimeUpdate,
  onMultiplierUpdate,
  onBetResult,
  onCashOutResult,
  onPlayerCountUpdate,
  onError,
  onGameEnded,
  sessionUserId
}: UseGameSocketProps) => {
  const socketRef = useRef<Socket | null>(null);

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
      path: '/api/socket.io',
      reconnectionAttempts: 10,
      reconnectionDelay: 3000,
      reconnectionDelayMax: 10000,
      timeout: 30000,
      transports: ['websocket', 'polling'],
      forceNew: true,
      autoConnect: true,
      reconnection: true
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
      // Emitir evento específico para o jogo multiplicador
      socketClient.emit('connect-multiplier');
      socketClient.emit('requestGameState');
    });
    
    socketClient.on('gameState', (state: GameState) => {
      console.log('Estado do jogo recebido:', state);
      onGameStateUpdate(state);
    });
    
    socketClient.on('gamePhaseChange', (phase: GamePhase) => {
      console.log('Mudança de fase:', phase);
      onPhaseChange(phase);
    });
    
    socketClient.on('timeUpdate', (time: number) => {
      if (typeof time !== 'number' || isNaN(time)) {
        console.warn('Recebido tempo inválido:', time);
        return;
      }
      onTimeUpdate(time);
    });
    
    socketClient.on('multiplierUpdate', (data: any) => {
      // O multiplicador pode vir diretamente como número ou dentro de um objeto
      const multiplierValue = typeof data === 'number' ? data : data?.value;
      
      if (typeof multiplierValue !== 'number' || isNaN(multiplierValue)) {
        console.warn('Recebido multiplicador inválido:', data);
        return;
      }
      onMultiplierUpdate(multiplierValue);
    });
    
    socketClient.on('betPlaced', (data: any) => {
      console.log('Aposta confirmada:', data);
      onBetResult(data);
    });
    
    socketClient.on('cashOutMade', (data: any) => {
      console.log('CashOut confirmado:', data);
      onCashOutResult(data);
    });
    
    socketClient.on('gameEnded', (data: any) => {
      console.log('Jogo encerrado:', data);
      if (onGameEnded) {
        onGameEnded(data);
      }
    });
    
    socketClient.on('playerCount', (count: number) => {
      onPlayerCountUpdate(count);
    });
    
    socketClient.on('error', (error: any) => {
      console.error('Erro do socket:', error);
      onError(error);
    });
    
    socketClient.on('disconnect', () => {
      console.log('Desconectado do servidor Socket.IO');
    });
  }, [
    onGameStateUpdate,
    onPhaseChange,
    onTimeUpdate,
    onMultiplierUpdate,
    onBetResult,
    onCashOutResult,
    onPlayerCountUpdate,
    onError,
    onGameEnded
  ]);

  // Inicializar socket - apenas uma vez
  useEffect(() => {
    if (!socketRef.current) {
      const socketClient = getOrCreateSocketInstance();
      socketRef.current = socketClient;
      setupSocketEvents(socketClient);
    }

    return () => {
      // Não desconectar o socket global
    };
  }, []); // Removemos as dependências para executar apenas uma vez

  return {
    socket: socketRef.current,
    isConnected: socketRef.current?.connected ?? false
  };
};