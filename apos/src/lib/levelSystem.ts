import { PrismaClient } from '@prisma/client';
import { prisma } from './prisma';

// Tipos simplificados
interface User {
  id: string;
  email: string;
  password: string;
  name: string;
  balance: number;
  level: number;
  xp: number;
  loyaltyPoints: number;
  totalPlayed: number;
  daysActive: number;
  lastActive: Date;
  [key: string]: any;
}

interface Bet {
  id: string;
  userId: string;
  amount: number;
  type: string;
  result?: string | null;
  [key: string]: any;
}

interface PlayerLevel {
  id: string;
  level: number;
  name: string;
  requiredXP: number;
  bonusMultiplier: number;
  loyaltyMultiplier: number;
  dailyBonus: number;
  description?: string | null;
  icon?: string | null;
  [key: string]: any;
}

interface Reward {
  id: string;
  name: string;
  description: string;
  pointsCost: number;
  type: string;
  value: number;
  icon?: string | null;
  isActive: boolean;
  minimumLevel: number;
  [key: string]: any;
}

// Configurações do sistema de níveis
const LEVEL_XP_BASE = 1000;  // XP base para o primeiro nível
const LEVEL_XP_MULTIPLIER = 1.5; // Multiplicador de XP para cada nível
const XP_PER_BET = 10;  // XP ganho por aposta
const XP_PER_BET_WON = 25; // XP adicional por aposta ganha
const LOYALTY_POINTS_PER_BET = 1; // Pontos de fidelidade por R$ apostado
const DAY_ACTIVITY_THRESHOLD = 1; // Quantidade de apostas necessárias para contar como dia ativo

/**
 * Inicializar o sistema de níveis, garantindo que os níveis estejam definidos no banco de dados
 * @returns Número de níveis criados/encontrados
 */
export async function initializeLevelSystem(): Promise<number> {
  // Definir níveis padrão do sistema
  const defaultLevels: Omit<PlayerLevel, 'id' | 'createdAt' | 'updatedAt'>[] = [
    {
      level: 1,
      name: 'Iniciante',
      requiredXP: 0,
      bonusMultiplier: 0,
      loyaltyMultiplier: 1.0,
      dailyBonus: 0,
      description: 'Bem-vindo ao jogo! Comece sua jornada.',
      icon: '/images/levels/default.png',
    },
    {
      level: 2,
      name: 'Amador',
      requiredXP: 1000,
      bonusMultiplier: 0.01, // +1%
      loyaltyMultiplier: 1.1,
      dailyBonus: 5,
      description: 'Seus primeiros passos foram dados. Continue apostando!',
      icon: '/images/levels/default.png',
    },
    {
      level: 3,
      name: 'Aprendiz',
      requiredXP: 2500,
      bonusMultiplier: 0.02, // +2%
      loyaltyMultiplier: 1.2,
      dailyBonus: 10,
      description: 'Você está pegando o jeito!',
      icon: '/images/levels/default.png',
    },
    {
      level: 4,
      name: 'Competidor',
      requiredXP: 5000,
      bonusMultiplier: 0.03, // +3%
      loyaltyMultiplier: 1.3,
      dailyBonus: 15,
      description: 'Um competidor nato. Suas habilidades estão melhorando.',
      icon: '/images/levels/default.png',
    },
    {
      level: 5,
      name: 'Especialista',
      requiredXP: 10000,
      bonusMultiplier: 0.04, // +4%
      loyaltyMultiplier: 1.4,
      dailyBonus: 20,
      description: 'Um especialista no jogo. Suas apostas são mais certeiras.',
      icon: '/images/levels/default.png',
    },
    {
      level: 6,
      name: 'Prata',
      requiredXP: 17500,
      bonusMultiplier: 0.05, // +5%
      loyaltyMultiplier: 1.5,
      dailyBonus: 25,
      description: 'Alcançou o nível Prata! Bônus especiais desbloqueados.',
      icon: '/images/levels/default.png',
    },
    {
      level: 7,
      name: 'Ouro',
      requiredXP: 27500,
      bonusMultiplier: 0.06, // +6%
      loyaltyMultiplier: 1.6,
      dailyBonus: 40,
      description: 'Um jogador de Ouro! Seu prestígio é notável.',
      icon: '/images/levels/default.png',
    },
    {
      level: 8,
      name: 'Platina',
      requiredXP: 40000,
      bonusMultiplier: 0.07, // +7%
      loyaltyMultiplier: 1.7,
      dailyBonus: 60,
      description: 'Nível Platina alcançado! Poucos chegam tão longe.',
      icon: '/images/levels/default.png',
    },
    {
      level: 9,
      name: 'Diamante',
      requiredXP: 60000,
      bonusMultiplier: 0.08, // +8%
      loyaltyMultiplier: 1.8,
      dailyBonus: 90,
      description: 'Um diamante entre jogadores! Acesso a recompensas exclusivas.',
      icon: '/images/levels/default.png',
    },
    {
      level: 10,
      name: 'Mestre',
      requiredXP: 100000,
      bonusMultiplier: 0.10, // +10%
      loyaltyMultiplier: 2.0,
      dailyBonus: 150,
      description: 'Você atingiu a maestria! O melhor dos melhores.',
      icon: '/images/levels/default.png',
    },
  ];

  // Verificar e criar níveis no banco de dados
  let createdCount = 0;
  for (const levelData of defaultLevels) {
    const existingLevel = await prisma.playerLevel.findUnique({
      where: { level: levelData.level }
    });

    if (!existingLevel) {
      await prisma.playerLevel.create({
        data: levelData
      });
      console.log(`Nível ${levelData.level} (${levelData.name}) criado com sucesso.`);
      createdCount++;
    }
  }

  // Inicializar recompensas padrão
  const defaultRewards: Omit<Reward, 'id' | 'createdAt' | 'updatedAt'>[] = [
    {
      name: 'Aposta Gratuita (R$ 5)',
      description: 'Uma aposta gratuita de R$ 5,00 para usar em qualquer rodada.',
      pointsCost: 100,
      type: 'FREE_BET',
      value: 5,
      icon: '/images/rewards/default.png',
      isActive: true,
      minimumLevel: 1
    },
    {
      name: 'Aposta Gratuita (R$ 20)',
      description: 'Uma aposta gratuita de R$ 20,00 para usar em qualquer rodada.',
      pointsCost: 350,
      type: 'FREE_BET',
      value: 20,
      icon: '/images/rewards/default.png',
      isActive: true,
      minimumLevel: 3
    },
    {
      name: 'Aposta Gratuita (R$ 50)',
      description: 'Uma aposta gratuita de R$ 50,00 para usar em qualquer rodada.',
      pointsCost: 800,
      type: 'FREE_BET',
      value: 50,
      icon: '/images/rewards/default.png',
      isActive: true,
      minimumLevel: 5
    },
    {
      name: 'Bônus de Multiplicador (+3%)',
      description: 'Aumento temporário de 3% no multiplicador por 24 horas.',
      pointsCost: 200,
      type: 'MULTIPLIER_BOOST',
      value: 0.03,
      icon: '/images/rewards/default.png',
      isActive: true,
      minimumLevel: 2
    },
    {
      name: 'Bônus de Multiplicador (+5%)',
      description: 'Aumento temporário de 5% no multiplicador por 24 horas.',
      pointsCost: 400,
      type: 'MULTIPLIER_BOOST',
      value: 0.05,
      icon: '/images/rewards/default.png',
      isActive: true,
      minimumLevel: 4
    },
    {
      name: 'Bônus de Multiplicador (+10%)',
      description: 'Aumento temporário de 10% no multiplicador por 24 horas.',
      pointsCost: 1000,
      type: 'MULTIPLIER_BOOST',
      value: 0.1,
      icon: '/images/rewards/default.png',
      isActive: true,
      minimumLevel: 7
    },
    {
      name: 'Bônus em Dinheiro (R$ 10)',
      description: 'Receba R$ 10,00 em bônus adicionado diretamente ao seu saldo.',
      pointsCost: 500,
      type: 'CASH_BONUS',
      value: 10,
      icon: '/images/rewards/default.png',
      isActive: true,
      minimumLevel: 2
    },
    {
      name: 'Bônus em Dinheiro (R$ 50)',
      description: 'Receba R$ 50,00 em bônus adicionado diretamente ao seu saldo.',
      pointsCost: 2000,
      type: 'CASH_BONUS',
      value: 50,
      icon: '/images/rewards/default.png',
      isActive: true,
      minimumLevel: 5
    },
    {
      name: 'Bônus em Dinheiro (R$ 100)',
      description: 'Receba R$ 100,00 em bônus adicionado diretamente ao seu saldo.',
      pointsCost: 3500,
      type: 'CASH_BONUS',
      value: 100,
      icon: '/images/rewards/default.png',
      isActive: true,
      minimumLevel: 8
    },
    {
      name: 'Aumento de Limite Diário (+50%)',
      description: 'Aumento de 50% no seu limite diário de apostas por 24 horas.',
      pointsCost: 300,
      type: 'DAILY_LIMIT_BOOST',
      value: 0.5, // +50%
      icon: '/images/rewards/default.png',
      isActive: true,
      minimumLevel: 3
    }
  ];

  // Verificar e criar recompensas no banco de dados
  let rewardCount = 0;
  for (const rewardData of defaultRewards) {
    const existingReward = await prisma.reward.findFirst({
      where: { 
        name: rewardData.name,
        type: rewardData.type,
        value: rewardData.value
      }
    });

    if (!existingReward) {
      await prisma.reward.create({
        data: rewardData
      });
      console.log(`Recompensa "${rewardData.name}" criada com sucesso.`);
      rewardCount++;
    }
  }

  // Verificar quantos níveis existem no total
  const totalLevels = await prisma.playerLevel.count();
  
  console.log(`Inicialização concluída: ${createdCount} níveis criados, ${totalLevels} níveis no total`);
  console.log(`${rewardCount} recompensas criadas.`);
  
  return totalLevels;
}

/**
 * Calcular e atualizar o nível do usuário com base no XP
 * @param userId ID do usuário
 * @returns Objeto com informações do nível e se houve uma subida de nível
 */
export async function updateUserLevel(userId: string): Promise<{
  user: User;
  levelUp: boolean;
  oldLevel: number;
  newLevel: number;
}> {
  // Buscar informações do usuário
  const user = await prisma.user.findUnique({
    where: { id: userId }
  });

  if (!user) {
    throw new Error('Usuário não encontrado');
  }

  // Buscar todos os níveis do sistema, ordenados por nível
  const levels = await prisma.playerLevel.findMany({
    orderBy: { level: 'asc' }
  });

  if (levels.length === 0) {
    throw new Error('Níveis do sistema não configurados. Execute initializeLevelSystem() primeiro.');
  }

  // Determinar o nível atual com base no XP
  const oldLevel = user.level;
  let newLevel = 1;

  for (const level of levels) {
    if (user.xp >= level.requiredXP) {
      newLevel = level.level;
    } else {
      break;
    }
  }

  // Atualizar o nível do usuário se for diferente
  if (newLevel !== user.level) {
    await prisma.user.update({
      where: { id: userId },
      data: { level: newLevel }
    });

    // Se o nível aumentou, retornar true para levelUp
    return {
      user: { ...user, level: newLevel } as User,
      levelUp: newLevel > oldLevel,
      oldLevel,
      newLevel
    };
  }

  return {
    user: user as User,
    levelUp: false,
    oldLevel,
    newLevel
  };
}

/**
 * Adicionar XP e pontos de fidelidade ao usuário após uma aposta
 * @param userId ID do usuário
 * @param bet Objeto da aposta realizada
 * @param isWin Indica se o usuário ganhou a aposta
 */
export async function addBetRewards(userId: string, bet: Bet, isWin: boolean): Promise<{
  addedXP: number;
  addedPoints: number;
  levelUp: boolean;
  oldLevel: number;
  newLevel: number;
}> {
  // Buscar informações do usuário
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { bets: { take: 1, orderBy: { createdAt: 'desc' } } }
  });

  if (!user) {
    throw new Error('Usuário não encontrado');
  }

  // Buscar informações do nível do usuário
  const userLevel = await prisma.playerLevel.findUnique({
    where: { level: user.level }
  });

  if (!userLevel) {
    throw new Error('Nível do usuário não encontrado');
  }

  // Calcular XP ganho pela aposta
  let xpGain = XP_PER_BET;
  
  // XP adicional por vitória
  if (isWin) {
    xpGain += XP_PER_BET_WON;
  }
  
  // XP adicional baseado no valor da aposta (10 XP por cada R$ 100)
  xpGain += Math.floor(bet.amount / 100) * 10;

  // Calcular pontos de fidelidade (com multiplicador do nível)
  const loyaltyPointsGain = Math.ceil(
    bet.amount * LOYALTY_POINTS_PER_BET * userLevel.loyaltyMultiplier
  );

  // Verificar se é um novo dia de atividade
  let daysActiveIncrement = 0;
  const lastActive = new Date(user.lastActive);
  const today = new Date();
  
  // Se a última atividade foi em um dia diferente
  if (lastActive.toDateString() !== today.toDateString()) {
    daysActiveIncrement = 1;
  }

  // Atualizar o usuário
  await prisma.user.update({
    where: { id: userId },
    data: {
      xp: { increment: xpGain },
      loyaltyPoints: { increment: loyaltyPointsGain },
      totalPlayed: { increment: 1 },
      daysActive: { increment: daysActiveIncrement },
      lastActive: today
    }
  });

  // Verificar e atualizar o nível do usuário
  const levelResult = await updateUserLevel(userId);

  return {
    addedXP: xpGain,
    addedPoints: loyaltyPointsGain,
    levelUp: levelResult.levelUp,
    oldLevel: levelResult.oldLevel,
    newLevel: levelResult.newLevel
  };
}

/**
 * Obter o multiplicador de bônus para o usuário com base em seu nível
 * @param userId ID do usuário
 * @returns Valor do multiplicador de bônus (em decimal)
 */
export async function getUserBonusMultiplier(userId: string): Promise<number> {
  const user = await prisma.user.findUnique({
    where: { id: userId }
  });

  if (!user) {
    throw new Error('Usuário não encontrado');
  }

  // Buscar informações do nível
  const userLevel = await prisma.playerLevel.findUnique({
    where: { level: user.level }
  });

  if (!userLevel) {
    return 0; // Valor padrão se o nível não for encontrado
  }

  return userLevel.bonusMultiplier;
}

/**
 * Resgatar uma recompensa de pontos de fidelidade
 * @param userId ID do usuário
 * @param rewardId ID da recompensa
 * @returns Objeto de resultado do resgate
 */
export async function redeemReward(userId: string, rewardId: string): Promise<{
  success: boolean;
  message: string;
  reward?: Reward;
}> {
  // Buscar informações do usuário e da recompensa
  const user = await prisma.user.findUnique({
    where: { id: userId }
  });

  if (!user) {
    return { 
      success: false, 
      message: 'Usuário não encontrado' 
    };
  }

  const reward = await prisma.reward.findUnique({
    where: { id: rewardId }
  });

  if (!reward) {
    return { 
      success: false, 
      message: 'Recompensa não encontrada' 
    };
  }

  // Verificar se o usuário tem nível suficiente
  if (user.level < reward.minimumLevel) {
    return { 
      success: false, 
      message: `Você precisa ser pelo menos nível ${reward.minimumLevel} para resgatar esta recompensa` 
    };
  }

  // Verificar se o usuário tem pontos suficientes
  if (user.loyaltyPoints < reward.pointsCost) {
    return { 
      success: false, 
      message: `Pontos insuficientes. Você tem ${user.loyaltyPoints} pontos, mas precisa de ${reward.pointsCost}` 
    };
  }

  // Verificar se a recompensa está ativa
  if (!reward.isActive) {
    return { 
      success: false, 
      message: 'Esta recompensa não está disponível no momento' 
    };
  }

  try {
    // Usar uma transação para garantir consistência
    return await prisma.$transaction(async (tx) => {
      // Remover pontos do usuário
      await tx.user.update({
        where: { id: userId },
        data: {
          loyaltyPoints: { decrement: reward.pointsCost },
          rewards: { connect: { id: rewardId } } // Criar relação com a recompensa
        }
      });

      // Registrar o resgate
      await tx.rewardRedemption.create({
        data: {
          userId,
          rewardId,
          points: reward.pointsCost
        }
      });

      // Processar a recompensa com base no tipo
      switch (reward.type) {
        case 'FREE_BET':
          // Adicionar o valor da aposta gratuita ao saldo
          await tx.user.update({
            where: { id: userId },
            data: {
              balance: { increment: reward.value }
            }
          });

          // Criar uma transação para registrar o bônus
          await tx.transaction.create({
            data: {
              userId,
              amount: reward.value,
              type: 'DEPOSIT',
              status: 'COMPLETED',
              details: JSON.stringify({
                source: 'reward',
                rewardId: reward.id,
                type: 'FREE_BET',
                message: `Aposta Gratuita (Recompensa): R$ ${reward.value.toFixed(2)}`
              })
            }
          });
          break;

        case 'CASH_BONUS':
          // Adicionar o valor do bônus ao saldo
          await tx.user.update({
            where: { id: userId },
            data: {
              balance: { increment: reward.value }
            }
          });

          // Criar uma transação para registrar o bônus
          await tx.transaction.create({
            data: {
              userId,
              amount: reward.value,
              type: 'DEPOSIT',
              status: 'COMPLETED',
              details: JSON.stringify({
                source: 'reward',
                rewardId: reward.id,
                type: 'CASH_BONUS',
                message: `Bônus em Dinheiro (Recompensa): R$ ${reward.value.toFixed(2)}`
              })
            }
          });
          break;

        // Outros tipos de recompensa seriam implementados aqui...
        default:
          // Para tipos que não precisam de processamento imediato
          break;
      }

      return { 
        success: true, 
        message: `Recompensa "${reward.name}" resgatada com sucesso!`,
        reward 
      };
    });
  } catch (error) {
    console.error('Erro ao resgatar recompensa:', error);
    return {
      success: false,
      message: 'Ocorreu um erro ao processar o resgate da recompensa.'
    };
  }
}

/**
 * Obter a próxima recompensa de login diário para o usuário
 * @param userId ID do usuário
 */
export async function getDailyLoginReward(userId: string): Promise<{
  points: number;
  message: string;
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId }
  });

  if (!user) {
    throw new Error('Usuário não encontrado');
  }

  // Buscar informações do nível
  const userLevel = await prisma.playerLevel.findUnique({
    where: { level: user.level }
  });

  if (!userLevel) {
    return { 
      points: 0, 
      message: 'Nível do usuário não encontrado' 
    };
  }

  // Verificar se o usuário já recebeu o bônus hoje
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const existingBonus = await prisma.transaction.findFirst({
    where: {
      userId,
      createdAt: { gte: today },
      details: { contains: 'daily_bonus' }
    }
  });

  if (existingBonus) {
    return { 
      points: 0, 
      message: 'Você já recebeu seu bônus diário hoje' 
    };
  }

  // Adicionar o bônus diário de pontos
  const bonusPoints = userLevel.dailyBonus;
  
  if (bonusPoints > 0) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        loyaltyPoints: { increment: bonusPoints }
      }
    });

    // Registrar o bônus
    await prisma.transaction.create({
      data: {
        userId,
        amount: 0, // Não afeta o saldo
        type: 'DEPOSIT',
        status: 'COMPLETED',
        details: JSON.stringify({
          source: 'daily_bonus',
          points: bonusPoints,
          level: user.level,
          message: `Bônus diário de pontos: +${bonusPoints} pontos`
        })
      }
    });

    return { 
      points: bonusPoints, 
      message: `Você recebeu ${bonusPoints} pontos de fidelidade como bônus diário!` 
    };
  }

  return { 
    points: 0, 
    message: 'Nenhum bônus diário disponível para seu nível' 
  };
} 