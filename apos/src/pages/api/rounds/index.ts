import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '../auth/[...nextauth]';

// Constantes de tempo
const BETTING_PHASE_DURATION = 10000; // 10 segundos para apostas
const ROUND_DURATION = 30000; // 30 segundos para a rodada

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Obter sessão usando getServerSession em vez de getSession
  const session = await getServerSession(req, res, authOptions);

  console.log('Sessão do usuário:', session ? 'Autenticado' : 'Não autenticado');

  if (!session) {
    return res.status(401).json({ message: 'Não autorizado. Faça login primeiro.' });
  }

  if (req.method === 'GET') {
    try {
      console.log('Buscando rodada atual...');
      const currentRound = await prisma.round.findFirst({
        where: {
          endTime: {
            gt: new Date(),
          },
        },
        orderBy: {
          startTime: 'desc',
        },
        include: {
          bets: {
            where: {
              userId: session.user.id,
            },
          },
        },
      });

      if (!currentRound) {
        console.log('Nenhuma rodada em andamento, criando nova rodada...');
        const now = new Date();
        
        // A fase de apostas começa agora
        const startTime = now;
        
        // A fase de apostas termina em 10 segundos
        const bettingEndTime = new Date(now.getTime() + BETTING_PHASE_DURATION);
        
        // A rodada termina 30 segundos após o fim da fase de apostas
        const endTime = new Date(bettingEndTime.getTime() + ROUND_DURATION);
        
        // Resultado gerado aleatoriamente
        const result = Math.random() * 100; 

        const newRound = await prisma.round.create({
          data: {
            result,
            startTime,
            endTime,
            status: 'BETTING', // Começamos na fase de apostas
          },
        });

        console.log('Nova rodada criada:', newRound.id);
        
        // Aqui seria o ideal enviar um evento via socket.io para notificar os clientes
        // sobre o início da fase de apostas

        return res.status(200).json({
          ...newRound,
          bettingEndTime,
          phase: 'BETTING'
        });
      }

      // Verificar a fase atual da rodada
      console.log('Rodada encontrada:', currentRound.id);
      const now = new Date();
      const bettingEndTime = new Date(currentRound.startTime.getTime() + BETTING_PHASE_DURATION);
      
      let phase = 'BETTING';
      if (now > bettingEndTime) {
        phase = 'RUNNING';
      }

      console.log('Fase atual da rodada:', phase);
      return res.status(200).json({
        ...currentRound,
        bettingEndTime,
        phase
      });
    } catch (error) {
      console.error('Erro ao buscar rodada:', error);
      return res.status(500).json({ message: 'Erro interno do servidor' });
    }
  }

  if (req.method === 'POST' && session.user.role === 'ADMIN') {
    try {
      console.log('Solicitação para atualizar rodada (admin):', req.body);
      const { houseProfit } = req.body;

      const currentRound = await prisma.round.findFirst({
        where: {
          endTime: {
            gt: new Date(),
          },
        },
        orderBy: {
          startTime: 'desc',
        },
      });

      if (!currentRound) {
        return res.status(400).json({ message: 'Não há rodada em andamento' });
      }

      console.log('Atualizando lucro da casa para rodada:', currentRound.id);
      const updatedRound = await prisma.round.update({
        where: { id: currentRound.id },
        data: {
          houseProfit,
        },
      });

      return res.status(200).json(updatedRound);
    } catch (error) {
      console.error('Erro ao atualizar rodada:', error);
      return res.status(500).json({ message: 'Erro interno do servidor' });
    }
  }

  return res.status(405).json({ message: 'Método não permitido' });
} 