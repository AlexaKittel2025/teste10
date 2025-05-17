import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '../auth/[...nextauth]';
import { checkPixChargeStatus } from '@/lib/openpix';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  const session = await getServerSession(req, res, authOptions);

  if (!session) {
    return res.status(401).json({ message: 'Não autorizado. Faça login primeiro.' });
  }

  try {
    const { transactionId } = req.query;
    
    if (!transactionId || typeof transactionId !== 'string') {
      return res.status(400).json({ message: 'ID da transação não fornecido' });
    }
    
    // Buscar transação
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      select: { 
        id: true,
        userId: true,
        status: true,
        details: true,
        externalId: true,
        amount: true 
      }
    });

    if (!transaction) {
      return res.status(404).json({ message: 'Transação não encontrada' });
    }
    
    // Verificar se o usuário é o dono da transação
    if (transaction.userId !== session.user.id) {
      return res.status(403).json({ message: 'Acesso negado à esta transação' });
    }
    
    // Se a transação já estiver concluída, apenas retorne o status
    if (transaction.status === 'COMPLETED') {
      return res.status(200).json({ status: 'COMPLETED' });
    }
    
    // Extrair correlationID dos detalhes
    let correlationID = '';
    try {
      const details = JSON.parse(transaction.details || '{}');
      correlationID = details.correlationID;
    } catch (e) {
      console.error('Erro ao extrair detalhes da transação:', e);
    }
    
    if (!correlationID) {
      return res.status(400).json({ message: 'Dados de transação inválidos' });
    }
    
    // Verificar status na API
    const pixStatus = await checkPixChargeStatus(correlationID);
    
    // Se o status for PAID ou COMPLETED, atualizar a transação no banco
    if (pixStatus === 'PAID' || pixStatus === 'COMPLETED') {
      // Atualizar transaction para COMPLETED
      await prisma.transaction.update({
        where: { id: transaction.id },
        data: { status: 'COMPLETED' }
      });
      
      // Incrementar o saldo do usuário
      await prisma.user.update({
        where: { id: transaction.userId },
        data: {
          balance: {
            increment: transaction.amount
          }
        }
      });
      
      return res.status(200).json({ status: 'COMPLETED' });
    }
    
    return res.status(200).json({ status: pixStatus });
  } catch (error) {
    console.error('Erro ao verificar status do pagamento:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro ao verificar pagamento';
    return res.status(500).json({ message: errorMessage });
  }
}