import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { prisma } from '@/lib/prisma';
import { BetStatus } from '@/lib/game-constants';
import { addBetRewards } from '@/lib/levelSystem';

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
    
    console.log('Dados de atualização de saldo recebidos:', { 
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
    
    // Verificar se o usuário tem uma aposta nesta rodada
    const bet = await prisma.bet.findFirst({
      where: {
        userId: session.user.id,
        roundId: roundId,
        status: BetStatus.PENDING
      },
    });
    
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
        return res.status(200).json({ 
          message: 'Usuário já fez cash-out nesta rodada, saldo já atualizado',
          newBalance: null
        });
      }
    } catch (error) {
      console.error('Erro ao verificar cash-out existente:', error);
    }
    
    // Calcular o valor a ser recebido (sempre valor da aposta × multiplicador, mesmo abaixo de 1.00)
    // O jogo é estilo trader, onde o usuário sempre recebe algo de volta
    const winAmount = bet.amount * multiplier;
    
    // Verificação de segurança para garantir que winAmount seja um número positivo 
    // e seja calculado corretamente
    if (isNaN(winAmount) || winAmount < 0) {
      console.error('ERRO: Valor de retorno calculado inválido:', winAmount);
      console.error('Dados usados para cálculo:', { aposta: bet.amount, multiplicador: multiplier });
      return res.status(400).json({ message: 'Erro no cálculo do valor de retorno' });
    }
    
    console.log(`Calculando ganho no fim da rodada: ${bet.amount} x ${multiplier} = ${winAmount}`);
    console.log(`IMPORTANTE: multiplicador ${multiplier < 1 ? 'é menor que 1.00, mas ainda' : 'é maior que 1.00 e'} adicionará ${winAmount.toFixed(2)} ao saldo do usuário`);
    
    let updatedBet, newBalance, levelRewards;
    
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
        
        // 3. Atualizar o saldo do usuário
        const user = await tx.user.findUnique({
          where: { id: session.user.id },
          select: { balance: true }
        });
        
        if (!user) {
          throw new Error('Usuário não encontrado');
        }
        
        // Calcular novo saldo - sempre adicione o valor da aposta × multiplicador,
        // independentemente se o multiplicador é menor que 1.00
        const newBalanceTx = Math.max(0, user.balance + winAmount);
        
        console.log(`Atualizando saldo do usuário: ${user.balance} + ${winAmount} = ${newBalanceTx}`);
        console.log(`Multiplicador: ${multiplier}, Aposta: ${bet.amount}, Retorno: ${winAmount}`);
        
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
              description: 'Atualização de saldo no fim da rodada',
              gameType: 'multiplicador',
              roundId: roundId,
              betId: bet.id,
              multiplier: multiplier,
              balanceAfter: newBalanceTx
            })
          }
        });
        
        // Não criar registro de cash-out, apenas atualizar o saldo
        
        // Retornar todos os dados relevantes
        return {
          updatedBet: updatedBetTx,
          newBalance: updatedUser.balance
        };
      });
      
      // Atribuir resultados da transação às variáveis locais
      updatedBet = result.updatedBet;
      newBalance = result.newBalance;
      
      console.log('Atualização de saldo processada com sucesso via transação');
      
      // Após a transação bem-sucedida, adicionar XP e pontos de fidelidade
      try {
        // Sempre considerar como jogada concluída, não como derrota
        // No nosso jogo estilo trader, o usuário sempre recebe algo de volta
        const won = true; // Sempre considerar como concluído com sucesso
        console.log('Adicionando recompensas de nível para aposta completada');
        const rewards = await addBetRewards(session.user.id, bet, won);
        
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
      console.error('Erro na transação de atualização de saldo:', error);
      return res.status(500).json({ 
        message: 'Erro ao processar atualização de saldo, tente novamente',
        error: error instanceof Error ? error.message : String(error)
      });
    }
    
    // Retornar sucesso, incluindo informações do nível se disponível
    return res.status(200).json({ 
      success: true, 
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
    console.error('Erro ao processar atualização de saldo:', error);
    return res.status(500).json({ 
      message: 'Erro interno do servidor',
      error: error instanceof Error ? error.message : String(error)
    });
  }
}