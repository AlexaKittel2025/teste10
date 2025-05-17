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
    console.log('### INÍCIO: ATUALIZAÇÃO FORÇADA DE SALDO ###');
    
    // Verificar autenticação
    const session = await getServerSession(req, res, authOptions);
    
    if (!session || !session.user) {
      console.log('Erro: Usuário não autenticado');
      return res.status(401).json({ message: 'Não autenticado' });
    }
    
    const { multiplier, roundId, betAmount } = req.body;
    
    console.log('Dados recebidos para atualização FORÇADA de saldo:', { 
      multiplier, 
      roundId, 
      betAmount, 
      userId: session.user.id 
    });
    
    // Validar os parâmetros da requisição
    if (multiplier === undefined || typeof multiplier !== 'number' || isNaN(multiplier)) {
      console.log('Erro: Multiplicador inválido:', multiplier);
      return res.status(400).json({ message: 'Multiplicador inválido' });
    }
    
    if (!roundId) {
      console.log('Erro: ID da rodada inválido');
      return res.status(400).json({ message: 'ID da rodada inválido' });
    }

    if (!betAmount || typeof betAmount !== 'number' || isNaN(betAmount) || betAmount <= 0) {
      console.log('Erro: Valor da aposta inválido:', betAmount);
      return res.status(400).json({ message: 'Valor da aposta inválido' });
    }
    
    // Verificar se o usuário tem uma aposta nesta rodada
    const bet = await prisma.bet.findFirst({
      where: {
        userId: session.user.id,
        roundId: roundId,
        status: { in: [BetStatus.PENDING, BetStatus.COMPLETED] } // Aceita apostas pendentes ou já completadas
      },
    });
    
    if (!bet) {
      console.log('Tentando criar uma nova aposta para atualização de saldo');
      
      // Se não encontrar aposta, criar uma nova para este usuário e rodada
      try {
        const newBet = await prisma.bet.create({
          data: {
            userId: session.user.id,
            roundId: roundId,
            amount: betAmount,
            status: BetStatus.COMPLETED,
            result: multiplier,
            winAmount: betAmount * multiplier,
            completedAt: new Date()
          }
        });
        
        console.log('Nova aposta criada com sucesso:', newBet);
      } catch (error) {
        console.error('Erro ao criar nova aposta:', error);
        return res.status(500).json({ 
          message: 'Erro ao criar nova aposta para atualização de saldo',
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    
    // Calcular o valor a ser adicionado ao saldo do usuário
    // SEMPRE é multiplicador × valor da aposta, independentemente do valor do multiplicador
    const winAmount = betAmount * multiplier;
    
    console.log(`Calculando valor para adicionar ao saldo: ${betAmount} × ${multiplier} = ${winAmount}`);
    console.log(`Este valor ${winAmount} será ADICIONADO ao saldo do usuário, independentemente do multiplicador ser < 1.00`);
    
    // Atualizar o saldo do usuário diretamente
    let newBalance = 0;
    try {
      // Buscar o saldo atual do usuário
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { balance: true }
      });
      
      if (!user) {
        console.error('Usuário não encontrado para atualização de saldo');
        throw new Error('Usuário não encontrado');
      }
      
      // Calcular o novo saldo (saldo atual + valor ganho)
      // Garante que nunca será negativo
      const oldBalance = user.balance;
      newBalance = Math.max(0, oldBalance + winAmount);
      
      console.log(`Atualizando saldo: ${oldBalance} + ${winAmount} = ${newBalance}`);
      
      // Atualizar o saldo no banco de dados
      await prisma.user.update({
        where: { id: session.user.id },
        data: { balance: newBalance }
      });
      
      // Registrar a transação
      await prisma.transaction.create({
        data: {
          userId: session.user.id,
          amount: winAmount,
          type: 'DEPOSIT',
          status: 'COMPLETED',
          details: JSON.stringify({
            description: 'Atualização FORÇADA de saldo no fim da rodada',
            gameType: 'multiplicador',
            roundId: roundId,
            multiplier: multiplier,
            betAmount: betAmount,
            balanceAfter: newBalance
          })
        }
      });
      
      console.log('Saldo atualizado com sucesso para', newBalance);
      
      // Adicionar recompensas de nível
      try {
        console.log('Adicionando recompensas de nível...');
        const rewards = await addBetRewards(
          session.user.id, 
          bet || { amount: betAmount, id: 'temp-id' }, 
          true // Sempre consideramos como sucesso
        );
        
        console.log('Recompensas adicionadas:', rewards);
      } catch (rewardsError) {
        console.error('Erro ao adicionar recompensas (ignorado):', rewardsError);
        // Não falhar a operação principal
      }
      
    } catch (error) {
      console.error('Erro ao atualizar saldo do usuário:', error);
      return res.status(500).json({ 
        message: 'Erro ao atualizar saldo do usuário',
        error: error instanceof Error ? error.message : String(error) 
      });
    }
    
    console.log('### FIM: ATUALIZAÇÃO FORÇADA DE SALDO CONCLUÍDA COM SUCESSO ###');
    
    // Retornar sucesso com o novo saldo
    return res.status(200).json({
      success: true,
      newBalance: newBalance,
      winAmount: winAmount,
      message: 'Saldo atualizado com sucesso ao fim da rodada'
    });
    
  } catch (error) {
    console.error('Erro geral ao processar atualização forçada de saldo:', error);
    return res.status(500).json({ 
      message: 'Erro interno do servidor',
      error: error instanceof Error ? error.message : String(error)
    });
  }
}