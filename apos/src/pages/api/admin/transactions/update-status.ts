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

  // Aceitar somente método POST
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  try {
    console.log('Recebendo requisição para atualizar status:', req.body);
    const { transactionId, status } = req.body;

    if (!transactionId || !status) {
      return res.status(400).json({ message: 'ID da transação e status são obrigatórios' });
    }

    // Verificar se o status é válido
    if (!['PENDING', 'COMPLETED', 'REJECTED'].includes(status)) {
      return res.status(400).json({ message: 'Status inválido. Use PENDING, COMPLETED ou REJECTED' });
    }

    console.log(`Buscando transação: ${transactionId}`);
    
    // Buscar a transação com select específico para evitar campos não existentes
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
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
            email: true,
            balance: true
          }
        }
      }
    });

    if (!transaction) {
      console.log(`Transação não encontrada: ${transactionId}`);
      return res.status(404).json({ message: 'Transação não encontrada' });
    }

    console.log(`Transação encontrada:`, {
      id: transaction.id,
      status: transaction.status,
      type: transaction.type,
      amount: transaction.amount
    });

    // Usar transação para garantir consistência
    const result = await prisma.$transaction(async (tx) => {
      // Se estiver rejeitando um saque, devolva o dinheiro para o usuário
      if (status === 'REJECTED' && transaction.status === 'PENDING' && transaction.type === 'WITHDRAWAL') {
        const updatedUser = await tx.user.update({
          where: { id: transaction.userId },
          data: {
            balance: {
              increment: transaction.amount
            }
          }
        });
        
        console.log(`Saque rejeitado: R$ ${transaction.amount} devolvido para o usuário ${transaction.userId}`);
        console.log(`Novo saldo do usuário: R$ ${updatedUser.balance}`);
      }

      // Atualizar o status da transação
      const updatedTransaction = await tx.transaction.update({
        where: { id: transactionId },
        data: { status },
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

      return updatedTransaction;
    });
    
    console.log(`Status da transação ${transactionId} atualizado para ${status}`);
    
    return res.status(200).json(result);
  } catch (error) {
    console.error('Erro ao atualizar status da transação:', error);
    
    let errorMessage = 'Erro interno do servidor';
    if (error instanceof Error) {
      console.error('Detalhes do erro:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      
      if (error.message.includes('does not exist')) {
        errorMessage = 'Erro na estrutura do banco de dados';
      } else if (error.message.includes('constraint')) {
        errorMessage = 'Erro de restrição do banco de dados';
      } else {
        errorMessage = error.message;
      }
    }
    
    return res.status(500).json({ message: errorMessage });
  }
} 