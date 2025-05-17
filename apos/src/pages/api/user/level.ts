import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { prisma } from '@/lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Verificar a sessão do usuário
  const session = await getServerSession(req, res, authOptions);
  
  if (!session || !session.user?.id) {
    return res.status(401).json({ error: 'Não autorizado' });
  }
  
  const userId = session.user.id;

  try {
    // Obter informações do usuário com XP e nível
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        level: true,
        xp: true,
        loyaltyPoints: true,
        totalPlayed: true,
        daysActive: true,
        lastActive: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    // Obter informações do nível atual
    const currentLevel = await prisma.playerLevel.findUnique({
      where: { level: user.level }
    });

    // Obter informações do próximo nível (se houver)
    const nextLevel = await prisma.playerLevel.findUnique({
      where: { level: user.level + 1 }
    });

    // Calcular progresso para o próximo nível
    let progress = 100; // Se não houver próximo nível, considerar 100%
    let xpRequired = 0;
    
    if (nextLevel) {
      xpRequired = nextLevel.requiredXP - (currentLevel?.requiredXP || 0);
      const xpProgress = user.xp - (currentLevel?.requiredXP || 0);
      progress = Math.min(100, Math.max(0, Math.floor((xpProgress / xpRequired) * 100)));
    }

    // Obter recompensas disponíveis para o nível do usuário
    const availableRewards = await prisma.reward.findMany({
      where: {
        minimumLevel: { lte: user.level },
        isActive: true
      },
      orderBy: [
        { minimumLevel: 'desc' },
        { pointsCost: 'asc' }
      ]
    });

    // Obter recompensas resgatadas pelo usuário
    const redeemedRewards = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        rewards: {
          select: {
            id: true,
            name: true,
            type: true,
            value: true,
            createdAt: true
          }
        }
      }
    });

    // Retornar as informações
    return res.status(200).json({
      user,
      currentLevel,
      nextLevel,
      progress,
      xpRequired,
      xpCurrent: user.xp - (currentLevel?.requiredXP || 0),
      availableRewards,
      redeemedRewards: redeemedRewards?.rewards || []
    });
  } catch (error) {
    console.error('Erro ao buscar informações de nível:', error);
    return res.status(500).json({ error: 'Erro ao processar a requisição' });
  }
} 