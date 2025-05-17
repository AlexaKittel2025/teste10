import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import { prisma } from '@/lib/prisma';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Verificar autenticação e permissão
  const session = await getServerSession(req, res, authOptions);

  if (!session) {
    return res.status(401).json({ message: 'Não autorizado' });
  }

  // Verificar se é um admin
  if (session.user.role !== 'ADMIN') {
    return res.status(403).json({ message: 'Acesso proibido' });
  }

  if (req.method === 'GET') {
    try {
      const { userId } = req.query;
      
      if (!userId || typeof userId !== 'string') {
        return res.status(400).json({ message: 'ID de usuário é obrigatório' });
      }

      // Buscar informações detalhadas do usuário
      const user = await prisma.user.findUnique({
        where: {
          id: userId
        },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          address: true,
          balance: true,
          createdAt: true,
          role: true,
          _count: {
            select: {
              transactions: true,
              bets: true
            }
          }
        }
      });

      if (!user) {
        return res.status(404).json({ message: 'Usuário não encontrado' });
      }

      // Buscar últimas transações do usuário
      const transactions = await prisma.transaction.findMany({
        where: {
          userId: userId
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: 5,
        select: {
          id: true,
          amount: true,
          type: true,
          status: true,
          createdAt: true
        }
      });

      return res.status(200).json({
        ...user,
        transactions
      });
    } catch (error) {
      console.error('Erro ao buscar informações do usuário:', error);
      return res.status(500).json({ message: 'Erro interno do servidor' });
    }
  }

  return res.status(405).json({ message: 'Método não permitido' });
} 