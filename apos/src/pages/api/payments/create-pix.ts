import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '../auth/[...nextauth]';
import { createPixCharge } from '@/lib/openpix';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  const session = await getServerSession(req, res, authOptions);

  if (!session) {
    return res.status(401).json({ message: 'Não autorizado. Faça login primeiro.' });
  }

  try {
    const { amount } = req.body;
    
    // Validar valor
    const numericAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ message: 'Valor de depósito inválido.' });
    }
    
    // Encontrar usuário
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, email: true, name: true }
    });

    if (!user) {
      return res.status(404).json({ message: 'Usuário não encontrado' });
    }

    // Criar cobrança PIX
    const pixCharge = await createPixCharge(
      numericAmount,
      user.id,
      user.email,
      user.name
    );

    if (!pixCharge) {
      return res.status(500).json({ message: 'Erro ao gerar cobrança PIX' });
    }

    const { charge } = pixCharge;
    
    // Calcular data de expiração
    const pixExpiration = new Date(charge.expiresAt);
    
    // Criar transação com status PENDING
    const transaction = await prisma.transaction.create({
      data: {
        userId: user.id,
        amount: numericAmount,
        type: 'DEPOSIT',
        status: 'PENDING',
        externalId: charge.globalID,
        pixCode: charge.brCode,
        pixExpiration,
        paymentUrl: charge.paymentLinkUrl,
        qrCodeImage: charge.qrCodeImage,
        details: JSON.stringify({
          correlationID: charge.correlationID,
          paymentMethod: 'PIX'
        })
      }
    });

    return res.status(201).json({
      transactionId: transaction.id,
      pixCode: charge.brCode,
      qrCodeImage: charge.qrCodeImage,
      paymentUrl: charge.paymentLinkUrl,
      expiresAt: pixExpiration
    });
  } catch (error) {
    console.error('Erro ao processar pagamento PIX:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro ao processar pagamento';
    return res.status(500).json({ message: errorMessage });
  }
}