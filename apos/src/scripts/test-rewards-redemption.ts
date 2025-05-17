import { prisma } from '../lib/prisma';

async function testRewardsRedemption() {
  try {
    console.log('🔍 Testando sistema de resgate de recompensas...\n');
    
    // 1. Verificar se as tabelas existem
    console.log('1. Verificando tabelas necessárias:');
    try {
      const userCount = await prisma.user.count();
      console.log('✓ Tabela User existe:', userCount, 'usuários');
    } catch (error) {
      console.log('✗ Erro ao acessar tabela User:', (error as Error).message);
    }
    
    try {
      const rewardCount = await prisma.reward.count();
      console.log('✓ Tabela Reward existe:', rewardCount, 'recompensas');
    } catch (error) {
      console.log('✗ Erro ao acessar tabela Reward:', (error as Error).message);
    }
    
    try {
      const redemptionCount = await prisma.rewardRedemption.count();
      console.log('✓ Tabela RewardRedemption existe:', redemptionCount, 'resgates');
    } catch (error) {
      console.log('✗ Erro ao acessar tabela RewardRedemption:', (error as Error).message);
    }
    
    // 2. Verificar se existem recompensas no banco
    console.log('\n2. Recompensas disponíveis:');
    const rewards = await prisma.reward.findMany({
      select: {
        id: true,
        name: true,
        type: true,
        pointsCost: true,
        isActive: true
      }
    });
    
    if (rewards.length === 0) {
      console.log('⚠️ Nenhuma recompensa encontrada no banco de dados');
    } else {
      rewards.forEach(reward => {
        console.log(`- ${reward.name} (${reward.type}) - ${reward.pointsCost} pontos - Ativa: ${reward.isActive}`);
      });
    }
    
    // 3. Verificar um usuário específico
    console.log('\n3. Verificando usuário específico:');
    const users = await prisma.user.findMany({
      take: 1,
      select: {
        id: true,
        name: true,
        loyaltyPoints: true,
        level: true
      }
    });
    
    if (users.length > 0) {
      const user = users[0];
      console.log(`Usuário: ${user.name}`);
      console.log(`ID: ${user.id}`);
      console.log(`Pontos: ${user.loyaltyPoints}`);
      console.log(`Nível: ${user.level}`);
      
      // 4. Tentar resgatar uma recompensa
      if (rewards.length > 0) {
        const rewardToRedeem = rewards[0];
        console.log(`\n4. Tentando resgatar: ${rewardToRedeem.name}`);
        
        try {
          // Verificar se o usuário tem pontos suficientes
          if (user.loyaltyPoints < rewardToRedeem.pointsCost) {
            console.log(`⚠️ Usuário não tem pontos suficientes (${user.loyaltyPoints} < ${rewardToRedeem.pointsCost})`);
          } else {
            // Simular o processo de resgate
            console.log('Simulando processo de resgate...');
            
            // Verificar se a transação funciona
            await prisma.$transaction(async (tx) => {
              console.log('- Atualizando pontos do usuário...');
              await tx.user.update({
                where: { id: user.id },
                data: {
                  loyaltyPoints: { decrement: rewardToRedeem.pointsCost }
                }
              });
              
              console.log('- Criando registro de resgate...');
              await tx.rewardRedemption.create({
                data: {
                  userId: user.id,
                  rewardId: rewardToRedeem.id,
                  points: rewardToRedeem.pointsCost
                }
              });
              
              console.log('- Conectando recompensa ao usuário...');
              await tx.user.update({
                where: { id: user.id },
                data: {
                  rewards: { connect: { id: rewardToRedeem.id } }
                }
              });
              
              console.log('✓ Transação simulada com sucesso!');
              
              // Reverter a transação (não queremos alterar dados reais)
              throw new Error('Teste completo - revertendo transação');
            });
          }
        } catch (error) {
          if ((error as Error).message === 'Teste completo - revertendo transação') {
            console.log('✓ Teste concluído - transação revertida');
          } else {
            console.log('✗ Erro durante o teste:', (error as Error).message);
          }
        }
      }
    } else {
      console.log('⚠️ Nenhum usuário encontrado para teste');
    }
    
  } catch (error) {
    console.error('Erro geral:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Executar o teste
testRewardsRedemption().catch(console.error);