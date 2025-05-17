import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '../auth/[...nextauth]';
import { WIN_MULTIPLIER } from '@/lib/game-constants';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Obter sessão do usuário
  const session = await getServerSession(req, res, authOptions);

  if (!session) {
    return res.status(401).json({ message: 'Não autorizado. Faça login primeiro.' });
  }

  if (req.method === 'GET') {
    try {
      // Buscar as últimas 10 rodadas finalizadas com cash-outs
      // @ts-ignore - O modelo CashOut existe no schema mas não no tipo PrismaClient
      const cashOuts = await prisma.cashOut.findMany({
        where: {
          userId: session.user.id,
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: 10,
        include: {
          bet: true
        }
      });

      // Buscar as últimas rodadas do jogo multiplicador
      // @ts-ignore - O modelo gameRound existe no schema mas não no tipo PrismaClient
      const gameRounds = await prisma.gameRound.findMany({
        where: {
          status: 'FINISHED',
          gameType: 'multiplicador'
        },
        orderBy: {
          endTime: 'desc'
        },
        take: 10
      });

      // Buscar também do modelo Round para backup
      const rounds = await prisma.round.findMany({
        where: { 
          status: 'FINISHED'
        },
        orderBy: {
          endTime: 'desc'
        },
        take: 10
      });

      // Consolidar todos os IDs de rodadas para buscar as apostas do usuário
      const allRoundIds = new Set([
        ...gameRounds.map(r => r.id),
        ...rounds.map(r => r.id)
      ]);

      // Buscar apostas do usuário para essas rodadas
      const userBets = await prisma.bet.findMany({
        where: {
          userId: session.user.id,
          roundId: { in: Array.from(allRoundIds) }
        }
      });

      // Consolidar resultados, priorizando os do gameRound
      const consolidatedRounds = new Map();

      // Primeiro adicionar os do gameRound
      for (const round of gameRounds) {
        consolidatedRounds.set(round.id, {
          id: round.id,
          result: round.result || 1.0, // usar o resultado salvo ou 1.0 como padrão
          timestamp: round.endTime?.toISOString() || new Date().toISOString()
        });
      }

      // Adicionar rounds que não estejam no mapa
      for (const round of rounds) {
        if (!consolidatedRounds.has(round.id)) {
          consolidatedRounds.set(round.id, {
            id: round.id,
            result: round.result,
            timestamp: round.endTime.toISOString()
          });
        }
      }

      // Processar os dados para o formato esperado pelo frontend
      const processedResults = Array.from(consolidatedRounds.values())
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 10)
        .map(round => {
          // Encontrar aposta do usuário para essa rodada
          const userBet = userBets.find(bet => bet.roundId === round.id);
          
          // Encontrar cash-out se houver
          const cashOut = cashOuts.find(co => co.roundId === round.id && co.betId === userBet?.id);
          
          // Determinar o multiplicador final
          // Para o jogo de multiplicador, o valor resultado está entre 0.0 e 2.0
          let multiplier;
          if (typeof round.result === 'number') {
            // Se o resultado já for um multiplicador direto (0.0 - 2.0)
            if (round.result >= 0 && round.result <= 2.0) {
              multiplier = round.result;
            } else {
              // Caso contrário, é o formato antigo (0-100) que precisa ser convertido
              multiplier = round.result < 50
                ? 1.0 + (50 - round.result) / 25 // Conversão para 1.0 - 2.0
                : Math.max(0, 1.0 - (round.result - 50) / 50); // Conversão para 0.0 - 1.0
            }
          } else {
            multiplier = 1.0; // valor padrão
          }
          
          // Definir o valor final
          const cashOutValue = cashOut ? cashOut.multiplier : null;
          const isCashOut = !!cashOut;
          
          let userBetInfo = null;
          if (userBet) {
            const isWin = cashOutValue
              ? cashOutValue >= 1.0 // No caso de cash-out, ganha se ≥ 1.0
              : multiplier >= 1.0;  // No caso normal, ganha se ≥ 1.0
            
            const profitMultiplier = cashOutValue || (isWin ? WIN_MULTIPLIER : 0);
            const profit = userBet.amount * profitMultiplier;
            
            userBetInfo = {
              amount: userBet.amount,
              type: userBet.type,
              won: isWin,
              profit: isWin ? profit : 0,
              cashOutValue
            };
          }
          
          return {
            id: round.id,
            result: multiplier, // O resultado é o próprio multiplicador
            timestamp: round.timestamp,
            userBet: userBetInfo
          };
        });

      return res.status(200).json({ results: processedResults });
    } catch (error) {
      console.error('Erro ao buscar últimos resultados:', error);
      return res.status(500).json({ message: 'Erro interno do servidor' });
    }
  }

  return res.status(405).json({ message: 'Método não permitido' });
}