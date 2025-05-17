#!/usr/bin/env node

/**
 * Script otimizado para iniciar o Next.js em ambientes Windows
 * Resolve problemas comuns de cache e configuração
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Limpar o diretório .next se existir
console.log('🧹 Cleaning Next.js cache directory...');
try {
  const nextDir = path.join(process.cwd(), '.next');
  if (fs.existsSync(nextDir)) {
    fs.rmSync(nextDir, { recursive: true, force: true });
    console.log('✅ Next.js cache directory cleaned successfully.');
  }
} catch (err) {
  console.warn('⚠️ Unable to clean .next directory:', err.message);
}

// Configurar variáveis de ambiente otimizadas para Windows
process.env.NEXT_WEBPACK_DISABLE_COMPRESSION = 'true';
process.env.CHOKIDAR_USEPOLLING = 'true';
process.env.WATCHPACK_POLLING = 'true';
process.env.NODE_OPTIONS = '--max-old-space-size=4096';

// Log da plataforma para diagnóstico
console.log(`🚀 Starting Next.js on ${os.platform()} (${os.release()}) with Node ${process.version}`);
console.log('🔧 Using optimized Windows configuration');

// Iniciar o servidor Next.js
console.log('🌐 Starting Next.js development server...');

// No Windows, precisamos usar o caminho correto e comandos específicos
const isWindows = os.platform() === 'win32';
let command, args;

if (isWindows) {
  // Em Windows, usamos o path relativo do node_modules
  command = 'node';
  args = ['./node_modules/next/dist/bin/next', 'dev'];
  console.log('📌 Using Windows-specific command path');
} else {
  // Em outros sistemas, podemos usar npx normalmente
  command = 'npx';
  args = ['next', 'dev'];
}

console.log(`Executing: ${command} ${args.join(' ')}`);

const nextDev = spawn(command, args, {
  stdio: 'inherit',
  env: process.env,
  shell: isWindows // Use shell no Windows para melhor compatibilidade
});

// Gerenciar erros e encerramento
nextDev.on('error', (error) => {
  console.error('❌ Error starting Next.js server:', error);
  process.exit(1);
});

process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down Next.js server...');
  nextDev.kill();
  process.exit(0);
});