import { io, Socket } from 'socket.io-client';

// Variável singleton para o socket
let socket: Socket | null = null;
let isInitializing = false;
let eventListeners: Record<string, Function[]> = {};

// Opções para o socket
const socketOptions = {
  reconnectionAttempts: 10,       // Aumentar número de tentativas de reconexão
  reconnectionDelay: 3000,        // Esperar mais tempo entre reconexões (ms)
  reconnectionDelayMax: 10000,    // Aumentar tempo máximo entre tentativas (ms)
  timeout: 30000,                 // Aumentar timeout da conexão (ms)
  transports: ['websocket'],      // Usar apenas WebSocket para evitar polling
  forceNew: false,                // Não forçar criação de nova conexão
  autoConnect: true,              // Conectar automaticamente
  reconnection: true              // Habilitar reconexão automática
};

// Socket mockado para ambientes sem suporte WebSocket
const createMockSocket = () => {
  const mockListeners: Record<string, Function[]> = {};
  
  return {
    connected: true,
    id: 'mock-socket-id',
    
    connect: () => {},
    disconnect: () => {},
    
    emit: (event: string, ...args: any[]) => {
      console.log(`[Mock Socket] Emitted event ${event}`, ...args);
      
      // Simular recebimento de resposta para eventos comuns
      if (event === 'requestGameState') {
        setTimeout(() => {
          if (mockListeners['gameState']) {
            mockListeners['gameState'].forEach(listener => {
              listener({
                phase: 'betting',
                timeLeft: 5000,
                multiplier: 1.0,
                roundId: 'mock-round-id-' + Date.now(),
                bets: [],
                connectedPlayers: 1
              });
            });
          }
        }, 100);
      }
    },
    
    on: (event: string, callback: Function) => {
      if (!mockListeners[event]) {
        mockListeners[event] = [];
      }
      mockListeners[event].push(callback);
    },
    
    off: (event: string) => {
      delete mockListeners[event];
    },
    
    hasListeners: (event: string) => {
      return !!mockListeners[event] && mockListeners[event].length > 0;
    }
  } as unknown as Socket;
};

// Inicializa o servidor Socket.IO e cria a conexão
export const initializeSocket = async (): Promise<Socket> => {
  // Detectar se estamos em um ambiente que talvez não suporte WebSockets
  const isBrowserEnv = typeof window !== 'undefined';
  
  if (socket && socket.connected) {
    console.log('Reutilizando socket existente');
    return socket;
  }
  
  if (isInitializing) {
    return new Promise((resolve, reject) => {
      // Esperar até que o socket seja inicializado, com timeout
      const checkInterval = setInterval(() => {
        if (socket && !isInitializing) {
          clearInterval(checkInterval);
          clearTimeout(timeoutId);
          resolve(socket);
        }
      }, 100);
      
      // Definir timeout para evitar promessa pendente infinita
      const timeoutId = setTimeout(() => {
        clearInterval(checkInterval);
        isInitializing = false;
        
        // Em caso de timeout, retornar socket mockado se necessário
        const mockSocket = createMockSocket();
        socket = mockSocket;
        console.warn('Timeout ao aguardar Socket.IO real, usando fallback');
        resolve(mockSocket);
      }, 8000); // 8 segundos de timeout
    });
  }
  
  try {
    isInitializing = true;
    console.log('Inicializando servidor Socket.IO...');
    
    // Inicializar o servidor Socket.IO com timeout
    if (isBrowserEnv) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      try {
        const initResponse = await fetch('/api/socket', { 
          signal: controller.signal 
        });
        clearTimeout(timeoutId);
        
        if (!initResponse.ok) {
          console.warn('API Socket retornou erro:', initResponse.status);
        }
      } catch (error) {
        console.warn('Timeout ao inicializar Socket.IO, continuando...');
        // Continuar mesmo com erro, o socket pode se conectar depois
      }
    }
    
    let newSocket: Socket;
    
    // Tentar criar um socket real, mas ter um fallback para ambientes sem suporte
    try {
      console.log('Criando nova conexão Socket.IO...');
      if (!isBrowserEnv) {
        throw new Error('Ambiente sem suporte WebSocket');
      }
      
      newSocket = io(socketOptions);
      
      // Configurar evento para detectar conexão inicial com timeout
      let connectionEstablished = false;
      
      // Configurar timeout para detecção de erro de conexão
      const connectionTimeout = setTimeout(() => {
        if (!connectionEstablished) {
          console.warn('Timeout ao conectar Socket.IO, usando fallback');
          
          // Limpar o socket real e usar mockado
          if (newSocket) {
            try {
              newSocket.disconnect();
            } catch (e) {}
          }
          
          // Criar socket mockado
          const mockSocket = createMockSocket();
          socket = mockSocket;
          isInitializing = false;
          triggerEvent('connect', 'mock-socket-id');
        }
      }, 5000); // 5 segundos para conectar
      
      // Configurar eventos básicos
      newSocket.on('connect', () => {
        connectionEstablished = true;
        clearTimeout(connectionTimeout);
        
        console.log('Conectado ao servidor Socket.IO:', newSocket.id);
        triggerEvent('connect', newSocket.id);
      });
      
      newSocket.on('disconnect', () => {
        console.log('Desconectado do servidor Socket.IO');
        triggerEvent('disconnect');
      });
      
      newSocket.on('connect_error', (error) => {
        console.error('Erro na conexão Socket.IO:', error);
        triggerEvent('error', error);
      });
      
      // Definir o socket como singleton
      socket = newSocket;
    } catch (error) {
      console.warn('Erro ao criar Socket.IO real, usando fallback:', error);
      
      // Criar socket mockado como fallback
      newSocket = createMockSocket();
      socket = newSocket;
      
      // Disparar evento de conexão simulada após um pequeno delay
      setTimeout(() => {
        triggerEvent('connect', 'mock-socket-id');
      }, 100);
    }
    
    isInitializing = false;
    return socket as Socket;
  } catch (error) {
    console.error('Erro global ao inicializar Socket.IO:', error);
    isInitializing = false;
    
    // Em caso de erro global, sempre retornar um socket mockado
    const mockSocket = createMockSocket();
    socket = mockSocket;
    
    // Disparar evento de conexão simulada
    setTimeout(() => {
      triggerEvent('connect', 'mock-socket-id');
    }, 100);
    
    return mockSocket;
  }
};

// Adicionar um event listener
export const addEventListener = (event: string, callback: Function): () => void => {
  if (!eventListeners[event]) {
    eventListeners[event] = [];
  }
  eventListeners[event].push(callback);
  
  // Se o socket já existir, adicionar o listener diretamente
  const wrappedCallback = (...args: any[]) => callback(...args);
  
  if (socket) {
    socket.on(event, wrappedCallback);
  }
  
  // Retornar função para remover o listener
  return () => removeEventListener(event, callback);
};

// Remover um event listener
export const removeEventListener = (event: string, callback: Function): void => {
  if (eventListeners[event]) {
    eventListeners[event] = eventListeners[event].filter(cb => cb !== callback);
  }
};

// Disparar evento para todos os listeners
const triggerEvent = (event: string, ...args: any[]): void => {
  if (eventListeners[event]) {
    eventListeners[event].forEach(callback => callback(...args));
  }
};

// Obter o socket atual
export const getSocket = (): Socket | null => {
  return socket;
};

// Fechar o socket
export const closeSocket = (): void => {
  if (socket) {
    console.log('Fechando conexão Socket.IO...');
    
    // Remover todos os listeners registrados no socket
    if (socket.hasListeners('connect')) socket.off('connect');
    if (socket.hasListeners('disconnect')) socket.off('disconnect');
    if (socket.hasListeners('connect_error')) socket.off('connect_error');
    
    // Remover listeners adicionais que possam ter sido registrados
    Object.keys(eventListeners).forEach(event => {
      if (socket && socket.hasListeners(event)) {
        socket.off(event);
      }
    });
    
    socket.disconnect();
    socket = null;
    eventListeners = {};
  }
};

// Enviar um evento para o servidor
export const emitEvent = (event: string, ...args: any[]): Promise<boolean> => {
  return new Promise((resolve) => {
    try {
      if (socket) {
        try {
          socket.emit(event, ...args);
          resolve(true);
        } catch (error) {
          console.error(`Erro ao emitir evento ${event}:`, error);
          resolve(false);
        }
      } else {
        // Se o socket não estiver disponível, tentar inicializar e depois emitir
        console.warn('Socket não está inicializado, tentando inicializar e emitir...');
        initializeSocket()
          .then((newSocket) => {
            try {
              newSocket.emit(event, ...args);
              resolve(true);
            } catch (error) {
              console.error(`Erro ao emitir evento ${event} após inicialização:`, error);
              resolve(false);
            }
          })
          .catch((error) => {
            console.error('Falha ao inicializar socket para emitir evento:', error);
            resolve(false);
          });
      }
    } catch (error) {
      // Capturar quaisquer erros não esperados
      console.error(`Erro inesperado ao emitir ${event}:`, error);
      resolve(false);
    }
  });
}; 