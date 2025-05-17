// Script para verificar e inicializar o socket server

const checkSocketServer = async () => {
  console.log('=== Verificando Socket Server ===\n');
  
  try {
    // 1. Verificar se o socket está acessível
    console.log('1. Testando endpoint /api/socket...');
    const socketResponse = await fetch('http://localhost:3000/api/socket');
    console.log(`Status: ${socketResponse.status}`);
    
    // 2. Verificar se o socket-multiplier está acessível
    console.log('\n2. Testando endpoint /api/socket-multiplier...');
    const multiplierResponse = await fetch('http://localhost:3000/api/socket-multiplier');
    console.log(`Status: ${multiplierResponse.status}`);
    
    // 3. Tentar conectar via socket.io
    console.log('\n3. Tentando conectar via Socket.IO...');
    const script = document.createElement('script');
    script.src = 'http://localhost:3000/socket.io/socket.io.js';
    document.head.appendChild(script);
    
    script.onload = () => {
      const socket = io('http://localhost:3000');
      
      socket.on('connect', () => {
        console.log('✅ Socket conectado com sucesso!');
        console.log(`Socket ID: ${socket.id}`);
        
        // Testar evento do multiplicador
        socket.emit('connect-multiplier');
        console.log('Emitido evento connect-multiplier');
        
        // Solicitar estado do jogo
        socket.emit('requestGameState');
        console.log('Solicitado estado do jogo');
      });
      
      socket.on('error', (error) => {
        console.error('❌ Erro no socket:', error);
      });
      
      socket.on('connect_error', (error) => {
        console.error('❌ Erro de conexão:', error.message);
      });
      
      socket.on('gameState', (state) => {
        console.log('✅ Estado do jogo recebido:', state);
      });
    };
    
    script.onerror = () => {
      console.error('❌ Erro ao carregar socket.io.js');
      console.log('\nPossível solução:');
      console.log('1. Verificar se o servidor está rodando');
      console.log('2. Verificar se a porta 3000 está livre');
      console.log('3. Reiniciar o servidor com: npm run dev');
    };
    
  } catch (error) {
    console.error('Erro ao verificar socket server:', error);
  }
  
  console.log('\n=== Soluções Recomendadas ===');
  console.log('1. Reiniciar o servidor: npm run dev');
  console.log('2. Limpar cache do navegador');
  console.log('3. Verificar logs do servidor');
  console.log('4. Testar em aba anônima');
};

// Se estiver no navegador, executar
if (typeof window !== 'undefined') {
  checkSocketServer();
} else {
  console.log('Este script deve ser executado no navegador');
}