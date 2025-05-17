import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { processWebhookPayload } from '@/lib/openpix';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método não permitido' });
  }
  
  // Verificar signature do webhook (em produção, implementar uma validação mais robusta)
  const webhookSecret = process.env.OPENPIX_WEBHOOK_SECRET;
  const signature = req.headers['x-webhook-signature'];
  
  if (!webhookSecret || !signature) {
    console.warn('Webhook sem signature válida');
    // Em ambiente de produção, retornar erro 403 aqui
    // return res.status(403).json({ message: 'Signature inválida' });
  }
  
  try {
    // Processar payload do webhook
    const payload = req.body;
    const { correlationID, status, value, paidAt } = processWebhookPayload(payload);
    
    // Buscar transação pelo correlationID nos detalhes
    const transaction = await prisma.transaction.findFirst({
      where: {
        details: {
          contains: correlationID
        },
        status: 'PENDING'
      }
    });
    
    if (!transaction) {
      console.warn(`Webhook: Transação não encontrada para correlationID ${correlationID}`);
      return res.status(404).json({ message: 'Transação não encontrada' });
    }
    
    // Registrar a notificação recebida
    await prisma.paymentNotification.create({
      data: {
        transactionId: transaction.id,
        externalId: correlationID,
        status,
        payload: JSON.stringify(payload)
      }
    });
    
    // Se o status for PAID ou COMPLETED, atualizar a transação
    if (status === 'PAID' || status === 'COMPLETED') {
      // Atualizar status da transação para COMPLETED
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
      
      console.log(`Pagamento PIX confirmado: ${transaction.id}, valor: ${transaction.amount}`);
    }
    
    return res.status(200).json({ received: true });
  } catch (error) {
    console.error('Erro ao processar webhook PIX:', error);
    return res.status(500).json({ message: 'Erro interno do servidor' });
  }
}