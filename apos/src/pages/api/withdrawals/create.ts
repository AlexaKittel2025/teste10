import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '../auth/[...nextauth]';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  try {
    const session = await getServerSession(req, res, authOptions);
    
    if (!session) {
      return res.status(401).json({ message: 'Não autorizado. Faça login primeiro.' });
    }

    const { amount, pixKey, method } = req.body;

    // Validações
    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Valor inválido' });
    }

    if (!pixKey) {
      return res.status(400).json({ message: 'Chave PIX ou dados bancários são obrigatórios' });
    }

    // Buscar usuário
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (!user) {
      return res.status(404).json({ message: 'Usuário não encontrado' });
    }

    if (user.balance < amount) {
      return res.status(400).json({ message: 'Saldo insuficiente' });
    }

    // Preparar detalhes
    const details = JSON.stringify({
      pixKey: pixKey,
      method: method || 'pixWithdraw'
    });

    // Usar transação para garantir atomicidade
    const result = await prisma.$transaction(async (tx) => {
      // Criar transação de saque com campos básicos apenas
      const transaction = await tx.transaction.create({
        data: {
          userId: user.id,
          amount: amount,
          type: 'WITHDRAWAL',
          status: 'PENDING',
          details: details
        },
        select: {
          id: true,
          userId: true,
          amount: true,
          type: true,
          status: true,
          details: true,
          createdAt: true,
          updatedAt: true
        }
      });

      // Debitar saldo do usuário
      await tx.user.update({
        where: { id: user.id },
        data: {
          balance: {
            decrement: amount
          }
        }
      });

      return transaction;
    });

    console.log('Saque criado com sucesso:', result.id);
    return res.status(201).json(result);

  } catch (error) {
    console.error('Erro ao criar saque:', error);
    
    let message = 'Erro ao processar saque';
    if (error instanceof Error) {
      // Tratamento específico de erros do Prisma
      if (error.message.includes('balance') || error.message.includes('constraint')) {
        message = 'Saldo insuficiente';
      } else if (error.message.includes('does not exist')) {
        message = 'Erro na estrutura do banco de dados';
      }
    }
    
    return res.status(500).json({ message });
  }
}