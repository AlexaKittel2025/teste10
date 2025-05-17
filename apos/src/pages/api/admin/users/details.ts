import { NextApiRequest, NextApiResponse } from 'next';
import { getSession } from 'next-auth/react';
import { PrismaClient } from '@prisma/client';

// Instância do Prisma
const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Verificar autenticação
    const session = await getSession({ req });
    
    if (!session || session.user.role !== 'ADMIN') {
      return res.status(401).json({ error: 'Não autorizado' });
    }
    
    // Verificar método HTTP
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Método não permitido' });
    }
    
    // Obter ID do usuário da query
    const { id } = req.query;
    
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'ID do usuário não fornecido' });
    }
    
    // Buscar informações detalhadas do usuário
    const user = await prisma.user.findUnique({
      where: {
        id: id
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        address: true,
        balance: true,
        createdAt: true,
        totalBets: true,
        dailyBetLimit: true,
        role: true,
        _count: {
          select: {
            bets: true,
            transactions: true
          }
        }
      }
    });
    
    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    
    // Contar bets e obter soma de valores (sem usar aggregate)
    const bets = await prisma.bet.findMany({
      where: {
        userId: id
      },
      select: {
        amount: true
      }
    });
    
    const totalBetsCount = bets.length;
    const totalBetsAmount = bets.reduce((acc, bet) => acc + bet.amount, 0);
    
    // Contar depósitos e obter soma de valores
    const deposits = await prisma.transaction.findMany({
      where: {
        userId: id,
        type: 'DEPOSIT',
        status: 'COMPLETED'
      },
      select: {
        amount: true
      }
    });
    
    const totalDepositsCount = deposits.length;
    const totalDeposits = deposits.reduce((acc, tx) => acc + tx.amount, 0);
    
    // Contar saques e obter soma de valores
    const withdrawals = await prisma.transaction.findMany({
      where: {
        userId: id,
        type: 'WITHDRAWAL',
        status: 'COMPLETED'
      },
      select: {
        amount: true
      }
    });
    
    const totalWithdrawalsCount = withdrawals.length;
    const totalWithdrawals = withdrawals.reduce((acc, tx) => acc + tx.amount, 0);
    
    // Complementar as informações do usuário com estatísticas
    const userDetails = {
      ...user,
      statistics: {
        totalBetsCount,
        totalBetsAmount,
        totalDeposits,
        totalDepositsCount,
        totalWithdrawals,
        totalWithdrawalsCount
      }
    };
    
    // Retornar os detalhes do usuário
    return res.status(200).json(userDetails);
  } catch (error) {
    console.error('Erro ao buscar detalhes do usuário:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
} 