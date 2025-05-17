import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import { prisma } from '@/lib/prisma';
import { redeemReward } from '@/lib/levelSystem';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Verificar a sessão do usuário
  const session = await getServerSession(req, res, authOptions);
  
  if (!session || !session.user?.id) {
    return res.status(401).json({ error: 'Não autorizado' });
  }
  
  const userId = session.user.id;
  
  // Apenas aceitar requisições POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }
  
  try {
    // Obter o ID da recompensa do corpo da requisição
    const { rewardId } = req.body;
    
    if (!rewardId) {
      return res.status(400).json({ error: 'ID da recompensa é obrigatório' });
    }
    
    console.log(`Iniciando resgate de recompensa - Usuário: ${userId}, Recompensa: ${rewardId}`);
    
    // Verificando informações da recompensa
    const rewardInfo = await prisma.reward.findUnique({
      where: { id: rewardId },
      select: { 
        id: true,
        name: true, 
        type: true, 
        value: true,
        pointsCost: true
      }
    });
    
    console.log('Recompensa a ser resgatada:', rewardInfo);
    
    // Verificando saldo de pontos antes do resgate
    const userBefore = await prisma.user.findUnique({
      where: { id: userId },
      select: { balance: true, loyaltyPoints: true }
    });
    
    console.log('Saldo antes do resgate:', userBefore);
    
    // Resgatar a recompensa
    const result = await redeemReward(userId, rewardId);
    
    console.log('Resultado do resgate:', result);
    
    if (!result.success) {
      return res.status(400).json({ error: result.message });
    }
    
    // Obter saldo atualizado
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { 
        balance: true,
        loyaltyPoints: true
      }
    });
    
    console.log('Saldo após resgate:', user);
    
    // Obter as transações recentes para verificar
    const recentTransactions = await prisma.transaction.findMany({
      where: { 
        userId,
        createdAt: {
          gte: new Date(Date.now() - 60000) // Últimos 60 segundos
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 1
    });
    
    console.log('Transação mais recente:', recentTransactions[0] || 'Nenhuma transação recente encontrada');
    
    // Retornar o resultado
    return res.status(200).json({
      success: true,
      message: result.message,
      reward: result.reward,
      updatedBalance: user?.balance || 0,
      updatedPoints: user?.loyaltyPoints || 0
    });
  } catch (error) {
    console.error('Erro ao resgatar recompensa:', error);
    return res.status(500).json({ error: 'Erro ao processar o resgate da recompensa' });
  }
} 