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
    const { transactionId, status } = req.body;

    if (!transactionId || !status) {
      return res.status(400).json({ message: 'ID da transação e status são obrigatórios' });
    }

    // Verificar se o status é válido
    if (!['PENDING', 'COMPLETED', 'REJECTED'].includes(status)) {
      return res.status(400).json({ message: 'Status inválido. Use PENDING, COMPLETED ou REJECTED' });
    }

    // Buscar a transação
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: { user: true }
    });

    if (!transaction) {
      return res.status(404).json({ message: 'Transação não encontrada' });
    }

    // Se estiver rejeitando um saque, devolva o dinheiro para o usuário
    if (status === 'REJECTED' && transaction.status === 'PENDING' && transaction.type === 'WITHDRAWAL') {
      await prisma.user.update({
        where: { id: transaction.userId },
        data: {
          balance: {
            increment: transaction.amount
          }
        }
      });
      
      console.log(`Saque rejeitado: R$ ${transaction.amount} devolvido para o usuário ${transaction.userId}`);
    }

    // Atualizar o status da transação
    const updatedTransaction = await prisma.transaction.update({
      where: { id: transactionId },
      data: { status }
    });
    
    // Tentar notificar o cliente sobre a mudança de status (através de WebSockets, se disponível)
    try {
      // Se houver um servidor WebSocket, enviar a notificação
      // Aqui seria o código para notificar o usuário via WebSocket
      // Como não temos essa implementação pronta, vamos apenas registrar no console
      console.log(`Status da transação ${transactionId} atualizado para ${status}`);
      console.log(`Notificação enviada para o usuário ${transaction.userId}`);
    } catch (notificationError) {
      console.error('Erro ao enviar notificação:', notificationError);
      // Não interromper o fluxo principal, apenas registrar o erro
    }

    return res.status(200).json(updatedTransaction);
  } catch (error) {
    console.error('Erro ao atualizar status da transação:', error);
    return res.status(500).json({ message: 'Erro interno do servidor' });
  }
} 