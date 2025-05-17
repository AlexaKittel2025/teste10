import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '../auth/[...nextauth]';
import { PrismaClient } from '@prisma/client';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Verificar autenticação
  const session = await getServerSession(req, res, authOptions);

  // Verificar se o usuário é administrador
  if (!session || session.user.role !== 'ADMIN') {
    return res.status(401).json({ message: 'Não autorizado. Apenas administradores podem acessar.' });
  }

  if (req.method === 'POST') {
    try {
      const { userId, amount } = req.body;

      if (!userId || !amount) {
        return res.status(400).json({ message: 'ID do usuário e valor são obrigatórios' });
      }

      if (typeof amount !== 'number' || amount <= 0) {
        return res.status(400).json({ message: 'Valor deve ser um número positivo' });
      }

      console.log(`Adicionando R$ ${amount} ao usuário ${userId}`);
      
      // Verificar se o usuário existe
      const userExists = await prisma.user.findUnique({
        where: { id: userId }
      });

      if (!userExists) {
        return res.status(404).json({ message: 'Usuário não encontrado' });
      }

      // Executar operações sequenciais
      // 1. Atualizar o saldo do usuário
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          balance: {
            increment: amount
          }
        },
        select: {
          id: true,
          email: true,
          name: true,
          balance: true
        }
      });

      // 2. Registrar a transação
      await prisma.transaction.create({
        data: {
          userId,
          amount,
          type: 'DEPOSIT',
          status: 'COMPLETED'
        }
      });

      return res.status(200).json(updatedUser);
    } catch (error) {
      console.error('Erro ao adicionar saldo:', error);
      return res.status(500).json({ message: 'Erro interno do servidor' });
    }
  }

  return res.status(405).json({ message: 'Método não permitido' });
} 