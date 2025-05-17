#!/usr/bin/env node

/**
 * Este script resolve problemas comuns do Next.js quando executado no WSL com Windows
 * Ele limpa o cache e inicia o servidor de desenvolvimento com as configurações otimizadas
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Limpar o cache do webpack
console.log('🧹 Limpando o cache do Next.js...');
try {
  const cachePath = path.join(__dirname, '.next', 'cache');
  if (fs.existsSync(cachePath)) {
    fs.rmSync(cachePath, { recursive: true, force: true });
    console.log('✅ Cache limpo com sucesso!');
  } else {
    console.log('⚠️ Diretório de cache não encontrado, pulando limpeza...');
  }
} catch (error) {
  console.error('❌ Erro ao limpar cache:', error);
}

// Definir variáveis de ambiente otimizadas para WSL
process.env.NEXT_WEBPACK_USEPOLLING = 'true';
process.env.NEXT_WEBPACK_DISABLE_COMPRESSION = 'true';
process.env.CHOKIDAR_USEPOLLING = 'true';
process.env.NODE_OPTIONS = '--max-old-space-size=4096';

// Iniciar o servidor Next.js
console.log('🚀 Iniciando servidor Next.js com configurações para WSL...');

const nextDev = spawn('npx', ['next', 'dev'], {
  stdio: 'inherit',
  env: process.env
});

nextDev.on('error', (error) => {
  console.error('❌ Erro ao iniciar servidor Next.js:', error);
  process.exit(1);
});

// Gerenciar encerramento limpo
process.on('SIGINT', () => {
  console.log('\n🛑 Encerrando servidor Next.js...');
  nextDev.kill();
  process.exit(0);
});

console.log('⚡ Servidor iniciado com configurações otimizadas para WSL');