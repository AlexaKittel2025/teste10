#!/usr/bin/env node

/**
 * Script simplificado e compatível com qualquer sistema
 * para iniciar o Next.js sem problemas de cache
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Definir cores para console
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m'
};

console.log(`${colors.blue}✨ Starting Next.js development server ${colors.reset}`);
console.log(`${colors.yellow}Platform: ${os.platform()} (${os.release()})${colors.reset}`);
console.log(`${colors.yellow}Node: ${process.version}${colors.reset}`);

// Limpar o diretório .next
console.log(`${colors.yellow}Cleaning .next directory...${colors.reset}`);
try {
  const nextDir = path.join(process.cwd(), '.next');
  if (fs.existsSync(nextDir)) {
    if (os.platform() === 'win32') {
      execSync('rmdir /s /q .next', { stdio: 'ignore' });
    } else {
      execSync('rm -rf .next', { stdio: 'ignore' });
    }
    console.log(`${colors.green}Cache cleaned successfully.${colors.reset}`);
  } else {
    console.log(`${colors.green}No cache found, continuing...${colors.reset}`);
  }
} catch (err) {
  console.warn(`${colors.red}Unable to clean .next directory: ${err.message}${colors.reset}`);
}

// Configurar variáveis de ambiente para qualquer plataforma
process.env.NEXT_WEBPACK_DISABLE_COMPRESSION = 'true';
process.env.CHOKIDAR_USEPOLLING = 'true';
process.env.WATCHPACK_POLLING = 'true';
process.env.NODE_OPTIONS = '--max-old-space-size=4096';

// Executar next dev diretamente
console.log(`${colors.blue}Launching Next.js...${colors.reset}`);
try {
  // Usar execSync para manter o processo vivo e conectado ao terminal
  execSync('npx next dev', { 
    stdio: 'inherit',
    env: process.env 
  });
} catch (err) {
  // O código será executado quando o usuário encerrar o processo com Ctrl+C
  console.log(`\n${colors.yellow}Next.js server stopped.${colors.reset}`);
  process.exit(0);
}