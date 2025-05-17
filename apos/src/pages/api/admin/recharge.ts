import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '../auth/[...nextauth]';
import { PrismaClient } from '@prisma/client';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  console.log('[RECHARGE API] Requisição recebida:', req.method);
  
  // Verificar autenticação
  const session = await getServerSession(req, res, authOptions);
  console.log('[RECHARGE API] Sessão:', session ? 'Autenticado' : 'Não autenticado');
  
  if (!session) {
    return res.status(401).json({ message: 'Não autorizado. Faça login primeiro.' });
  }

  // Verificar se o usuário é administrador
  if (session.user.role !== 'ADMIN') {
    console.log('[RECHARGE API] Usuário não é admin:', session.user.role);
    return res.status(403).json({ message: 'Acesso proibido. Apenas administradores podem acessar.' });
  }

  if (req.method === 'POST') {
    try {
      console.log('[RECHARGE API] Body recebido:', req.body);
      const { userId, amount } = req.body;

      if (!userId || amount === undefined || amount === null) {
        return res.status(400).json({ message: 'ID do usuário e valor são obrigatórios' });
      }

      // Converter para número se necessário
      const numericAmount = typeof amount === 'string' ? parseFloat(amount) : amount;

      if (isNaN(numericAmount) || numericAmount <= 0) {
        return res.status(400).json({ message: 'Valor deve ser um número positivo' });
      }

      console.log(`[RECHARGE API] Adicionando R$ ${numericAmount} ao usuário ${userId}`);
      
      // Verificar se o usuário existe
      const userExists = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          balance: true
        }
      });

      if (!userExists) {
        console.log('[RECHARGE API] Usuário não encontrado:', userId);
        return res.status(404).json({ message: 'Usuário não encontrado' });
      }

      console.log('[RECHARGE API] Usuário encontrado:', userExists.email, 'Saldo atual:', userExists.balance);

      // Usar transação para garantir consistência
      const result = await prisma.$transaction(async (tx) => {
        // 1. Atualizar o saldo do usuário
        const updatedUser = await tx.user.update({
          where: { id: userId },
          data: {
            balance: {
              increment: numericAmount
            }
          },
          select: {
            id: true,
            email: true,
            name: true,
            balance: true
          }
        });

        // 2. Registrar a transação (apenas campos básicos)
        await tx.transaction.create({
          data: {
            userId,
            amount: numericAmount,
            type: 'DEPOSIT',
            status: 'COMPLETED',
            details: JSON.stringify({
              method: 'admin_recharge',
              addedBy: session.user.email
            })
          },
          select: {
            id: true,
            amount: true,
            type: true,
            status: true,
            createdAt: true
          }
        });

        return updatedUser;
      });

      console.log('[RECHARGE API] Saldo atualizado com sucesso:', result);
      return res.status(200).json(result);
      
    } catch (error) {
      console.error('[RECHARGE API] Erro ao adicionar saldo:', error);
      
      let errorMessage = 'Erro interno do servidor';
      if (error instanceof Error) {
        console.error('[RECHARGE API] Detalhes do erro:', {
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

  return res.status(405).json({ message: 'Método não permitido' });
} 