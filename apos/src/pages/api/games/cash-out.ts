import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { prisma } from '@/lib/prisma';
import { updateUserBalance } from '@/lib/user-utils';
import { addBetRewards } from '@/lib/levelSystem';
import { 
  MAX_POSSIBLE_MULTIPLIER, 
  MIN_POSSIBLE_MULTIPLIER,
  BetStatus
} from '@/lib/game-constants';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  try {
    // Verificar autenticação
    const session = await getServerSession(req, res, authOptions);
    
    if (!session || !session.user) {
      return res.status(401).json({ message: 'Não autenticado' });
    }
    
    const { multiplier, roundId, betAmount } = req.body;
    
    console.log('Dados de cash-out recebidos:', { 
      multiplier, 
      roundId, 
      betAmount, 
      userId: session.user.id 
    });
    
    // Validar os parâmetros da requisição
    if (multiplier === undefined || typeof multiplier !== 'number' || isNaN(multiplier)) {
      return res.status(400).json({ message: 'Multiplicador inválido' });
    }
    
    if (!roundId) {
      return res.status(400).json({ message: 'ID da rodada inválido' });
    }
    
    // Verificar se o multiplicador está dentro dos limites válidos
    if (multiplier < MIN_POSSIBLE_MULTIPLIER || multiplier > MAX_POSSIBLE_MULTIPLIER) {
      return res.status(400).json({ 
        message: `Multiplicador fora dos limites válidos (${MIN_POSSIBLE_MULTIPLIER} a ${MAX_POSSIBLE_MULTIPLIER})` 
      });
    }
    
    let isGameRound = false;
    let validRound = false;
    
    // Verificar se é uma rodada do jogo multiplicador
    try {
      // @ts-ignore - O modelo gameRound existe no schema mas não no tipo PrismaClient
      const gameRound = await prisma.gameRound.findUnique({
        where: { id: roundId },
      });
      
      if (gameRound) {
        isGameRound = true;
        // Verificar status da rodada
        if (gameRound.status === 'RUNNING') {
          validRound = true;
        } else {
          return res.status(400).json({ 
            message: `A rodada não está em andamento (status: ${gameRound.status})` 
          });
        }
      }
    } catch (error) {
      console.error('Erro ao buscar gameRound:', error);
    }
    
    // Se não encontrou como gameRound, verificar como Round padrão
    if (!isGameRound) {
      try {
        const round = await prisma.round.findUnique({
          where: { id: roundId },
        });
        
        if (round) {
          // Verificar status da rodada padrão
          if (round.status === 'RUNNING') {
            validRound = true;
          } else {
            return res.status(400).json({ 
              message: `A rodada não está em andamento (status: ${round.status})` 
            });
          }
        }
      } catch (error) {
        console.error('Erro ao buscar round:', error);
      }
    }
    
    if (!validRound) {
      return res.status(404).json({ message: 'Rodada não encontrada ou inválida' });
    }
    
    // Verificar se o usuário tem uma aposta nesta rodada
    const bet = await prisma.bet.findFirst({
      where: {
        userId: session.user.id,
        roundId: roundId,
        status: BetStatus.PENDING
      },
    });
    
    // Verificar tempo limite para cash-out
    const now = Date.now();
    const lastAllowedTime = new Date(now - 2000); // Não permitir cashout após 2s do fim da rodada
    
    // Verificar se o round já finalizou
    if (validRound) {
      let isFinished = false;
      
      if (isGameRound) {
        // @ts-ignore
        const gameRound = await prisma.gameRound.findUnique({
          where: { id: roundId },
        });
        
        if (gameRound?.status === 'FINISHED' || 
            (gameRound?.endTime && gameRound.endTime < lastAllowedTime)) {
          isFinished = true;
        }
      } else {
        const round = await prisma.round.findUnique({
          where: { id: roundId },
        });
        
        if (round?.status === 'FINISHED' || 
            (round?.endTime && round.endTime < lastAllowedTime)) {
          isFinished = true;
        }
      }
      
      if (isFinished) {
        return res.status(400).json({ 
          message: 'A rodada já foi encerrada, não é possível fazer cash-out' 
        });
      }
    }
    
    if (!bet) {
      return res.status(404).json({ message: 'Aposta não encontrada para esta rodada' });
    }
    
    // Verificar se já existe um cash-out para esta aposta
    try {
      // @ts-ignore - O modelo cashOut existe no schema mas não no tipo PrismaClient
      const existingCashOut = await prisma.cashOut.findFirst({
        where: { betId: bet.id }
      });
      
      if (existingCashOut) {
        return res.status(400).json({ 
          message: 'Você já fez cash-out nesta rodada',
          cashout: existingCashOut
        });
      }
    } catch (error) {
      console.error('Erro ao verificar cash-out existente:', error);
    }
    
    // Calcular o valor a ser recebido
    const winAmount = bet.amount * multiplier;
    console.log(`Calculando ganho: ${bet.amount} x ${multiplier} = ${winAmount}`);
    
    let updatedBet, newBalance, cashout, levelRewards;
    
    // Usar transação para garantir consistência em todas as operações
    try {
      // Executar todas as operações dentro de uma transação
      const result = await prisma.$transaction(async (tx) => {
        // 1. Atualizar o status da aposta para finalizada
        const updatedBetTx = await tx.bet.update({
          where: { id: bet.id },
          data: {
            status: 'COMPLETED',
            result: multiplier,
            winAmount: winAmount,
            completedAt: new Date()
          },
        });
        
        // 2. Atualizar o saldo da casa
        // @ts-ignore - O modelo houseBalance existe no schema mas não no tipo PrismaClient
        const houseBalance = await tx.houseBalance.findFirst({
          where: { gameType: 'multiplicador' },
        });
        
        if (houseBalance) {
          // @ts-ignore - O modelo houseBalance existe no schema mas não no tipo PrismaClient
          await tx.houseBalance.update({
            where: { id: houseBalance.id },
            data: {
              balance: houseBalance.balance - winAmount,
              totalPayout: houseBalance.totalPayout + winAmount,
            },
          });
        }
        
        // 3. Atualizar o saldo do usuário via transação ao invés de função
        const user = await tx.user.findUnique({
          where: { id: session.user.id },
          select: { balance: true }
        });
        
        if (!user) {
          throw new Error('Usuário não encontrado');
        }
        
        // Calcular novo saldo
        const newBalanceTx = Math.max(0, user.balance + winAmount);
        
        // Atualizar no banco de dados
        const updatedUser = await tx.user.update({
          where: { id: session.user.id },
          data: { balance: newBalanceTx },
          select: { balance: true }
        });
        
        // Registrar a transação
        await tx.transaction.create({
          data: {
            userId: session.user.id,
            amount: winAmount,
            type: 'DEPOSIT',
            status: 'COMPLETED',
            details: JSON.stringify({
              description: 'Cash-out em jogo',
              gameType: 'multiplicador',
              roundId: roundId,
              betId: bet.id,
              multiplier: multiplier,
              balanceAfter: newBalanceTx
            })
          },
          // Selecionar apenas campos que existem no banco
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
        
        // 4. Registrar o cashout
        // @ts-ignore - O modelo cashOut existe no schema mas não no tipo PrismaClient
        const cashoutTx = await tx.cashOut.create({
          data: {
            userId: session.user.id,
            betId: bet.id,
            roundId: roundId,
            multiplier: multiplier,
            amount: winAmount,
          },
        });
        
        // Retornar todos os dados relevantes
        return {
          updatedBet: updatedBetTx,
          newBalance: updatedUser.balance,
          cashout: cashoutTx
        };
      });
      
      // Atribuir resultados da transação às variáveis locais
      updatedBet = result.updatedBet;
      newBalance = result.newBalance;
      cashout = result.cashout;
      
      console.log('Cash-out processado com sucesso via transação');
      
      // Após a transação bem-sucedida, adicionar XP e pontos de fidelidade
      try {
        // O cash-out bem-sucedido é considerado uma vitória!
        console.log('Adicionando recompensas de nível para aposta bem-sucedida...');
        const rewards = await addBetRewards(session.user.id, bet, true);
        
        console.log('Recompensas de nível adicionadas:', rewards);
        levelRewards = rewards;
        
        // Se houve subida de nível, registre no log
        if (rewards.levelUp) {
          console.log(`Usuário ${session.user.id} subiu do nível ${rewards.oldLevel} para ${rewards.newLevel}!`);
        }
      } catch (rewardsError) {
        // Não falhar a operação principal se as recompensas falharem
        console.error('Erro ao adicionar recompensas de nível:', rewardsError);
      }
    } catch (error) {
      console.error('Erro na transação de cash-out:', error);
      return res.status(500).json({ 
        message: 'Erro ao processar cash-out, tente novamente',
        error: error instanceof Error ? error.message : String(error)
      });
    }
    
    // Retornar sucesso, incluindo informações do nível se disponível
    return res.status(200).json({ 
      success: true, 
      cashout: cashout,
      newBalance: newBalance,
      winAmount: winAmount,
      level: levelRewards ? {
        addedXP: levelRewards.addedXP,
        addedPoints: levelRewards.addedPoints,
        levelUp: levelRewards.levelUp,
        newLevel: levelRewards.levelUp ? levelRewards.newLevel : undefined
      } : undefined
    });
    
  } catch (error) {
    console.error('Erro ao processar cash-out:', error);
    return res.status(500).json({ 
      message: 'Erro interno do servidor',
      error: error instanceof Error ? error.message : String(error)
    });
  }
} 