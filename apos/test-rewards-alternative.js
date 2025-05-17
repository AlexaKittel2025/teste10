const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testRewardsAlternative() {
  console.log('🔍 Teste alternativo do sistema de recompensas\n');
  
  try {
    // 1. Buscar um usuário
    console.log('1. Buscando usuário...');
    const user = await prisma.user.findFirst({
      select: {
        id: true,
        name: true,
        loyaltyPoints: true,
        balance: true
      }
    });
    
    if (!user) {
      console.log('Nenhum usuário encontrado');
      return;
    }
    
    console.log(`Usuário: ${user.name}`);
    console.log(`Pontos: ${user.loyaltyPoints}`);
    console.log(`Saldo: R$ ${user.balance}`);
    
    // 2. Buscar uma recompensa
    console.log('\n2. Buscando recompensa...');
    const reward = await prisma.reward.findFirst({
      where: {
        isActive: true,
        type: 'CASH_BONUS'
      },
      select: {
        id: true,
        name: true,
        value: true,
        pointsCost: true
      }
    });
    
    if (!reward) {
      console.log('Nenhuma recompensa de bônus em dinheiro encontrada');
      return;
    }
    
    console.log(`Recompensa: ${reward.name}`);
    console.log(`Valor: R$ ${reward.value}`);
    console.log(`Custo: ${reward.pointsCost} pontos`);
    
    // 3. Simular resgate sem usar RewardRedemption
    console.log('\n3. Simulando resgate...');
    
    if (user.loyaltyPoints < reward.pointsCost) {
      console.log(`❌ Pontos insuficientes (${user.loyaltyPoints} < ${reward.pointsCost})`);
      return;
    }
    
    await prisma.$transaction(async (tx) => {
      console.log('- Removendo pontos...');
      const updatedUser = await tx.user.update({
        where: { id: user.id },
        data: {
          loyaltyPoints: { decrement: reward.pointsCost }
        }
      });
      console.log(`✓ Novos pontos: ${updatedUser.loyaltyPoints}`);
      
      console.log('- Adicionando saldo...');
      const userWithBalance = await tx.user.update({
        where: { id: user.id },
        data: {
          balance: { increment: reward.value }
        }
      });
      console.log(`✓ Novo saldo: R$ ${userWithBalance.balance}`);
      
      console.log('- Criando transação...');
      const transaction = await tx.transaction.create({
        data: {
          userId: user.id,
          amount: reward.value,
          type: 'DEPOSIT',
          status: 'COMPLETED',
          details: JSON.stringify({
            source: 'reward',
            rewardId: reward.id,
            type: 'CASH_BONUS',
            message: `Bônus: ${reward.name}`
          })
        }
      });
      console.log(`✓ Transação criada: ${transaction.id}`);
      
      // Testar criação de RewardRedemption separadamente
      try {
        console.log('- Tentando criar registro de resgate...');
        const redemption = await tx.rewardRedemption.create({
          data: {
            userId: user.id,
            rewardId: reward.id,
            points: reward.pointsCost
          }
        });
        console.log(`✓ Registro de resgate criado: ${redemption.id}`);
      } catch (error) {
        console.log(`⚠️ Erro ao criar registro de resgate:`, error.message);
        console.log('Continuando sem registro de resgate...');
      }
      
      console.log('\n✅ Resgate simulado com sucesso!');
    });
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
    console.error('Detalhes:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testRewardsAlternative();