import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '../auth/[...nextauth]';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Obter sessão do usuário
  const session = await getServerSession(req, res, authOptions);

  if (!session) {
    return res.status(401).json({ message: 'Não autorizado. Faça login primeiro.' });
  }

  // Processar requisição para obter as apostas de hoje
  if (req.method === 'GET') {
    try {
      // Definir o início do dia de hoje
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Buscar apostas feitas hoje
      const dailyBets = await prisma.bet.findMany({
        where: {
          userId: session.user.id,
          createdAt: {
            gte: today,
          },
        },
      });
      
      // Calcular o total apostado hoje
      const todayBetAmount = dailyBets.reduce((sum, bet) => sum + bet.amount, 0);
      
      console.log(`Total apostado hoje pelo usuário ${session.user.name}: R$ ${todayBetAmount.toFixed(2)}`);
      
      // Buscar o limite diário
      const user = await prisma.user.findUnique({
        where: { id: session.user.id }
      });
      
      if (!user) {
        return res.status(404).json({ message: 'Usuário não encontrado' });
      }
      
      // Retornar o total apostado hoje e o limite diário
      return res.status(200).json({
        todayBetAmount,
        dailyBetLimit: user.dailyBetLimit,
        betsCount: dailyBets.length
      });
    } catch (error) {
      console.error('Erro ao buscar apostas do dia:', error);
      return res.status(500).json({ message: 'Erro ao buscar apostas do dia' });
    }
  }

  // Processar requisição para registrar uma aposta
  if (req.method === 'POST') {
    try {
      const { amount, totalToday } = req.body;
      
      if (typeof amount !== 'number' || isNaN(amount)) {
        return res.status(400).json({ message: 'Valor de aposta inválido' });
      }
      
      console.log(`Registrando aposta de R$ ${amount.toFixed(2)} para o usuário ${session.user.name}`);
      console.log(`Total apostado hoje: R$ ${totalToday.toFixed(2)}`);
      
      // Sucesso - não precisamos realmente salvar nada aqui, apenas logs para debug
      return res.status(200).json({ 
        success: true,
        message: 'Aposta registrada para fins de rastreamento',
        amount,
        totalToday
      });
    } catch (error) {
      console.error('Erro ao processar registro de aposta:', error);
      return res.status(500).json({ message: 'Erro interno do servidor' });
    }
  }

  return res.status(405).json({ message: 'Método não permitido' });
}