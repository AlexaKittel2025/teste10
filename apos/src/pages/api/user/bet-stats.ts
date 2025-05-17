import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '../auth/[...nextauth]';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Verificar autenticação
  const session = await getServerSession(req, res, authOptions);

  if (!session || !session.user?.id) {
    return res.status(401).json({ message: 'Não autorizado. Faça login primeiro.' });
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  try {
    // Primeiro, vamos tentar buscar o usuário para verificar se o campo totalBets existe
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { totalBets: true }
    });

    // Inicializar com zero caso não haja dados
    let totalBetAmount = 0;
    let dailyTotal = 0;

    // Buscar todas as apostas do usuário sem filtro de tempo
    const allBets = await prisma.bet.findMany({
      where: {
        userId: session.user.id,
      },
      select: {
        amount: true,
        createdAt: true,
      },
    });

    // Calcular o total apostado (soma de todos os valores)
    if (allBets && allBets.length > 0) {
      totalBetAmount = allBets.reduce((sum, bet) => sum + (bet.amount || 0), 0);
      
      // Calcular o total apostado hoje
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Início do dia atual
      
      dailyTotal = allBets
        .filter(bet => new Date(bet.createdAt) >= today)
        .reduce((sum, bet) => sum + (bet.amount || 0), 0);
        
      console.log(`Total apostado hoje por ${session.user.id}: R$ ${dailyTotal.toFixed(2)}`);
    }

    // Se o usuário existir e o valor no banco for diferente do calculado, atualizar
    // Ou se o valor totalBets não existir/for null, atualizá-lo
    if (user === null || user.totalBets === null || user.totalBets === undefined || user.totalBets !== totalBetAmount) {
      // Atualizar o valor totalBets do usuário no banco
      try {
        console.log(`Atualizando totalBets do usuário ${session.user.id} para ${totalBetAmount}`);
        await prisma.user.update({
          where: { id: session.user.id },
          data: { totalBets: totalBetAmount }
        });
      } catch (updateError) {
        console.error('Erro ao atualizar totalBets do usuário:', updateError);
        // Continuar mesmo com erro na atualização, apenas logando o erro
      }
    }

    // Retornar estatísticas para o frontend
    return res.status(200).json({
      totalBets: totalBetAmount,
      dailyTotal: dailyTotal,
      betCount: allBets.length,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Erro ao buscar estatísticas de apostas:', error);
    // Retornar dados vazios em vez de erro 500 para não bloquear a UI
    return res.status(200).json({
      totalBets: 0,
      dailyTotal: 0,
      betCount: 0,
      updatedAt: new Date().toISOString(),
      error: 'Erro ao processar dados, usando valores padrão'
    });
  }
} 