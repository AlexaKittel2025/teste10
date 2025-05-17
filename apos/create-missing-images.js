// Script para criar imagens placeholder para o sistema de níveis

const fs = require('fs');
const path = require('path');

// Diretórios
const levelsDir = path.join(process.cwd(), 'public', 'images', 'levels');
const rewardsDir = path.join(process.cwd(), 'public', 'images', 'rewards');

// Garantir que os diretórios existam
const ensureDirectoryExists = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`Diretório criado: ${dir}`);
  }
};

// Criar um arquivo SVG placeholder
const createPlaceholderSVG = (text, color = '#666') => {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <rect width="100" height="100" fill="${color}" rx="10"/>
  <text x="50" y="50" font-family="Arial" font-size="12" fill="white" text-anchor="middle" dy=".3em">
    ${text}
  </text>
</svg>`;
};

// Imagens de níveis necessárias
const levelImages = [
  'default.png',
  'level1.png',
  'level2.png',
  'level3.png',
  'level4.png',
  'level5.png',
  'level6.png',
  'level7.png',
  'level8.png',
  'level9.png',
  'level10.png'
];

// Imagens de recompensas necessárias
const rewardImages = [
  'default.png',
  'free_bet.png',
  'free_bet_med.png',
  'free_bet_small.png',
  'cash_small.png',
  'cash_med.png',
  'cash_large.png',
  'multiplier_small.png',
  'multiplier_med.png',
  'multiplier_large.png',
  'limit_boost.png'
];

// Criar imagens de níveis
ensureDirectoryExists(levelsDir);
levelImages.forEach((imageName) => {
  const filePath = path.join(levelsDir, imageName);
  if (!fs.existsSync(filePath)) {
    const levelNumber = imageName.replace('level', '').replace('.png', '');
    const displayText = imageName === 'default.png' ? 'Level' : `Level ${levelNumber}`;
    const svg = createPlaceholderSVG(displayText, '#3bc37a');
    
    // Salvar como arquivo SVG temporário
    const svgPath = filePath.replace('.png', '.svg');
    fs.writeFileSync(svgPath, svg);
    console.log(`Criado: ${svgPath}`);
    
    // Como estamos no servidor Node.js, vamos criar um PNG simples
    // Em produção, você poderia usar uma biblioteca como sharp ou canvas
    // Por enquanto, vamos copiar um arquivo placeholder se existir
    
    // Criar um arquivo PNG vazio como placeholder
    const pngBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
    fs.writeFileSync(filePath, pngBuffer);
    console.log(`Criado placeholder: ${filePath}`);
  }
});

// Criar imagens de recompensas
ensureDirectoryExists(rewardsDir);
rewardImages.forEach((imageName) => {
  const filePath = path.join(rewardsDir, imageName);
  if (!fs.existsSync(filePath)) {
    const rewardType = imageName.replace('.png', '').replace(/_/g, ' ');
    const svg = createPlaceholderSVG(rewardType, '#1a86c7');
    
    // Salvar como arquivo SVG temporário
    const svgPath = filePath.replace('.png', '.svg');
    fs.writeFileSync(svgPath, svg);
    console.log(`Criado: ${svgPath}`);
    
    // Criar um arquivo PNG vazio como placeholder
    const pngBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
    fs.writeFileSync(filePath, pngBuffer);
    console.log(`Criado placeholder: ${filePath}`);
  }
});

console.log('\nImagens placeholder criadas com sucesso!');
console.log('Nota: Estas são imagens temporárias. Substitua-as por imagens reais em produção.');