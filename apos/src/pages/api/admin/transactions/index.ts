import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '../../auth/[...nextauth]';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Verificar autenticação e permissão de admin
  const session = await getServerSession(req, res, authOptions);

  if (!session) {
    return res.status(401).json({ message: 'Não autorizado. Faça login primeiro.' });
  }

  if (session.user.role !== 'ADMIN') {
    return res.status(403).json({ message: 'Acesso proibido. Apenas administradores podem acessar este recurso.' });
  }

  // Aceitar somente método GET
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  try {
    // Obter o tipo de transação do query param
    const { type } = req.query;
    
    if (!type || !['DEPOSIT', 'WITHDRAWAL'].includes(type as string)) {
      return res.status(400).json({ message: 'Tipo de transação inválido. Use DEPOSIT ou WITHDRAWAL' });
    }

    // Buscar transações pelo tipo, usando apenas campos existentes
    const transactions = await prisma.transaction.findMany({
      where: {
        type: type as string
      },
      select: {
        id: true,
        userId: true,
        amount: true,
        type: true,
        status: true,
        details: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return res.status(200).json(transactions);
  } catch (error) {
    console.error('Erro ao buscar transações:', error);
    return res.status(500).json({ message: 'Erro interno do servidor' });
  }
} 