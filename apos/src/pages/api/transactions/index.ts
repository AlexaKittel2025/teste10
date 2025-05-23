import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '../auth/[...nextauth]';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  console.log(`[${new Date().toISOString()}] Transactions API called - Method: ${req.method}`);
  
  // Set timeout for API response
  res.setHeader('Connection', 'keep-alive');
  
  try {
    const session = await getServerSession(req, res, authOptions);

  console.log('Sessão do usuário:', session ? 'Autenticado' : 'Não autenticado');
  console.log('Session data:', JSON.stringify(session, null, 2));

  if (!session) {
    console.error('No session found - returning 401');
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
      let detailsObj = {
        pixKey: pixKey || '',
        method: method || 'pix'
      };
      let detailsString = JSON.stringify(detailsObj);

      console.log('Criando transação com detalhes:', detailsString);
      
      // Usar transação do banco para garantir consistência
      const result = await prisma.$transaction(async (prisma) => {
        // Criar a transação com apenas campos básicos
        const transaction = await prisma.transaction.create({
          data: {
            amount: numericAmount,
            type,
            status,
            userId: user.id,
            details: detailsString
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

        console.log('Transação criada com sucesso, ID:', transaction.id);
        
        // Para saques, sempre debitar imediatamente
        if (type === 'WITHDRAWAL') {
          const updatedUser = await prisma.user.update({
            where: { id: user.id },
            data: {
              balance: {
                decrement: numericAmount,
              },
            },
          });
          console.log(`Saldo debitado: -${numericAmount}, novo saldo: ${updatedUser.balance}`);
        } 
        // Para depósitos, creditar imediatamente
        else if (type === 'DEPOSIT') {
          const updatedUser = await prisma.user.update({
            where: { id: user.id },
            data: {
              balance: {
                increment: numericAmount,
              },
            },
          });
          console.log(`Saldo creditado: +${numericAmount}, novo saldo: ${updatedUser.balance}`);
        }

        return transaction;
      });

      console.log('Transação concluída com sucesso:', result.id);
      return res.status(201).json(result);
    } catch (error) {
      console.error('Erro ao criar transação:', error);
      // Retornar mais detalhes sobre o erro para facilitar o diagnóstico
      let errorMessage = 'Erro interno do servidor';
      
      if (error instanceof Error) {
        errorMessage = error.message;
        
        // Se for erro do Prisma relacionado a saldo
        if (error.message.includes('balance') || error.message.includes('constraint')) {
          errorMessage = 'Saldo insuficiente para realizar esta operação';
        }
        // Se for erro de validação
        else if (error.message.includes('validation') || error.message.includes('required')) {
          errorMessage = 'Dados inválidos fornecidos. Verifique os campos e tente novamente.';
        }
      }
      
      console.error('Erro detalhado:', {
        message: errorMessage,
        type: error instanceof Error ? error.constructor.name : typeof error,
        stack: error instanceof Error ? error.stack : 'N/A'
      });
      
      return res.status(500).json({ message: errorMessage });
    }
  }

  if (req.method === 'GET') {
    try {
      console.log(`Fetching transactions for user: ${session.user.id}`);
      
      // Parâmetro opcional: limitar o número de transações retornadas
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      
      // Testar a conexão com o banco de dados
      const userExists = await prisma.user.findUnique({
        where: { id: session.user.id }
      });
      
      if (!userExists) {
        console.error(`User not found in database: ${session.user.id}`);
        return res.status(404).json({ message: 'Usuário não encontrado' });
      }
      
      console.log(`User found in database: ${userExists.email}`);
      
      // Buscar transações recentes do usuário, excluindo campos problemáticos
      const transactions = await prisma.transaction.findMany({
        where: {
          userId: session.user.id,
          type: {
            in: ['DEPOSIT', 'WITHDRAWAL'] // Retornar apenas depósitos e saques, não apostas
          }
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
          // Não incluir campos que podem não existir no banco
          // pixCode: false,
          // pixExpiration: false,
          // externalId: false,
          // paymentUrl: false,
          // qrCodeImage: false
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: Math.min(limit, 50) // Máximo de 50 transações
      });
      
      console.log(`Retornando ${transactions.length} transações para o usuário ${session.user.id}`);
      
      // Log de sucesso antes de enviar
      console.log('Enviando resposta com sucesso. Array de transações tem tamanho:', transactions.length);
      console.log('Primeira transação:', transactions[0] || 'Nenhuma transação');
      
      return res.status(200).json(transactions);
    } catch (error) {
      console.error('Erro detalhado ao buscar transações:', error);
      console.error('Stack trace:', (error as Error).stack);
      console.error('Nome do erro:', (error as Error).name);
      
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      console.error('Enviando resposta de erro:', { message: errorMessage });
      
      return res.status(500).json({ message: `Erro ao processar a requisição: ${errorMessage}` });
    }
  }

  return res.status(405).json({ error: 'Método não permitido' });
  } catch (globalError) {
    console.error('Erro global não capturado:', globalError);
    return res.status(500).json({ message: 'Erro interno do servidor' });
  }
} 