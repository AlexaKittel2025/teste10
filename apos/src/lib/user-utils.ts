import { prisma } from '@/lib/prisma';

/**
 * Atualiza o saldo de um usuário
 * @param userId ID do usuário
 * @param amount Valor a ser adicionado (positivo) ou subtraído (negativo)
 * @returns O novo saldo após a atualização
 */
export async function updateUserBalance(userId: string, amount: number): Promise<number> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { balance: true }
  });
  
  if (!user) {
    throw new Error('Usuário não encontrado');
  }
  
  // Calcular novo saldo
  const newBalance = Math.max(0, user.balance + amount);
  
  // Atualizar no banco de dados
  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: { balance: newBalance },
    select: { balance: true }
  });
  
  // Registrar a transação
  await prisma.transaction.create({
    data: {
      userId: userId,
      amount: amount,
      type: amount > 0 ? 'DEPOSIT' : 'WITHDRAWAL',
      status: 'COMPLETED',
      details: JSON.stringify({
        description: amount > 0 ? 'Ganho em jogo' : 'Aposta em jogo',
        balanceAfter: newBalance
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
  
  return updatedUser.balance;
} 