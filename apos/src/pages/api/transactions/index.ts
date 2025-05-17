import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '../auth/[...nextauth]';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const session = await getServerSession(req, res, authOptions);

  console.log('Sessão do usuário:', session ? 'Autenticado' : 'Não autenticado');

  if (!session) {
    return res.status(401).json({ message: 'Não autorizado. Faça login primeiro.' });
  }

  if (req.method === 'POST') {
    try {
      console.log('Solicitação de transação recebida:', req.body);
      const { amount, type, pixKey, method } = req.body;

      // Validações mais robustas
      if (!amount || !type) {
        return res.status(400).json({ message: 'Dados incompletos. Informe valor e tipo da transação.' });
      }

      // Converter amount para número caso seja string
      const numericAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
      
      if (isNaN(numericAmount) || numericAmount <= 0) {
        return res.status(400).json({ message: 'Valor da transação inválido.' });
      }

      if (!['DEPOSIT', 'WITHDRAWAL'].includes(type)) {
        return res.status(400).json({ message: 'Tipo de transação inválido. Use DEPOSIT ou WITHDRAWAL.' });
      }
      
      console.log('Buscando usuário:', session.user.id);
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
      });

      if (!user) {
        return res.status(404).json({ message: 'Usuário não encontrado' });
      }

      if (type === 'WITHDRAWAL' && user.balance < numericAmount) {
        return res.status(400).json({ message: 'Saldo insuficiente para este saque' });
      }

      // Definir status de acordo com o tipo de transação
      const status = type === 'WITHDRAWAL' ? 'PENDING' : 'COMPLETED';
      
      // Preparar os detalhes da transação de forma mais segura
      let detailsString = "{}";
      try {
        const detailsObj = {
          pixKey: pixKey || '',
          method: method || 'pix'
        };
        detailsString = JSON.stringify(detailsObj);
      } catch (error) {
        console.error('Erro ao serializar detalhes da transação:', error);
        // Usar objeto vazio em caso de erro
        detailsString = "{}";
      }

      console.log('Criando transação...');
      const transaction = await prisma.transaction.create({
        data: {
          amount: numericAmount,
          type,
          status,
          userId: user.id,
          details: detailsString
        },
      });

      console.log('Transação criada com sucesso, ID:', transaction.id);
      console.log('Atualizando saldo do usuário...');
      
      // Para saques, sempre debitar imediatamente
      if (type === 'WITHDRAWAL') {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            balance: {
              decrement: numericAmount,
            },
          },
        });
        console.log(`Saldo debitado: -${numericAmount}, novo saldo: ${user.balance - numericAmount}`);
      } 
      // Para depósitos, creditar imediatamente
      else if (type === 'DEPOSIT') {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            balance: {
              increment: numericAmount,
            },
          },
        });
        console.log(`Saldo creditado: +${numericAmount}, novo saldo: ${user.balance + numericAmount}`);
      }

      console.log('Transação concluída com sucesso:', transaction.id);
      return res.status(201).json(transaction);
    } catch (error) {
      console.error('Erro ao criar transação:', error);
      // Retornar mais detalhes sobre o erro para facilitar o diagnóstico
      const errorMessage = error instanceof Error ? error.message : 'Erro interno do servidor';
      return res.status(500).json({ message: errorMessage });
    }
  }

  if (req.method === 'GET') {
    try {
      // Parâmetro opcional: limitar o número de transações retornadas
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      
      // Buscar transações recentes do usuário
      const transactions = await prisma.transaction.findMany({
        where: {
          userId: session.user.id,
          type: {
            in: ['DEPOSIT', 'WITHDRAWAL'] // Retornar apenas depósitos e saques, não apostas
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: Math.min(limit, 50) // Máximo de 50 transações
      });
      
      console.log(`Retornando ${transactions.length} transações para o usuário ${session.user.id}`);
      
      return res.status(200).json(transactions);
    } catch (error) {
      console.error('Erro ao buscar transações:', error);
      return res.status(500).json({ error: 'Erro ao processar a requisição' });
    }
  }

  return res.status(405).json({ error: 'Método não permitido' });
} 