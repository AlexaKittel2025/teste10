const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testDatabase() {
  try {
    console.log('🔍 Testando estrutura do banco de dados...\n');
    
    // 1. Verificar se as tabelas existem
    console.log('1. Verificando tabelas:');
    
    try {
      const userCount = await prisma.user.count();
      console.log('✓ Tabela User:', userCount, 'registros');
    } catch (error) {
      console.log('✗ Erro User:', error.message);
    }
    
    try {
      const rewardCount = await prisma.reward.count();
      console.log('✓ Tabela Reward:', rewardCount, 'registros');
    } catch (error) {
      console.log('✗ Erro Reward:', error.message);
    }
    
    try {
      const redemptionCount = await prisma.rewardRedemption.count();
      console.log('✓ Tabela RewardRedemption:', redemptionCount, 'registros');
    } catch (error) {
      console.log('✗ Erro RewardRedemption:', error.message);
    }
    
    // 2. Listar todas as tabelas (via raw query)
    console.log('\n2. Listando todas as tabelas:');
    try {
      const tables = await prisma.$queryRaw`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        ORDER BY table_name;
      `;
      
      console.log('Tabelas no banco:');
      tables.forEach(table => {
        console.log('-', table.table_name);
      });
    } catch (error) {
      console.log('Erro ao listar tabelas:', error.message);
    }
    
    // 3. Verificar estrutura da tabela RewardRedemption
    console.log('\n3. Estrutura da tabela RewardRedemption:');
    try {
      const columns = await prisma.$queryRaw`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'RewardRedemption'
        ORDER BY ordinal_position;
      `;
      
      if (columns.length > 0) {
        console.log('Colunas:');
        columns.forEach(col => {
          console.log(`- ${col.column_name} (${col.data_type}) ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'}`);
        });
      } else {
        console.log('Tabela RewardRedemption não encontrada ou sem colunas');
      }
    } catch (error) {
      console.log('Erro ao verificar estrutura:', error.message);
    }
    
  } catch (error) {
    console.error('Erro geral:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testDatabase();