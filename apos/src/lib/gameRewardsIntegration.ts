import { addBetRewards, getUserBonusMultiplier } from './levelSystem';

/**
 * Funções para integrar o sistema de níveis e recompensas com os jogos
 */

/**
 * Aplicar recompensas de nível para uma aposta bem-sucedida
 * @param userId ID do usuário
 * @param betId ID da aposta
 * @param betAmount Valor da aposta
 * @param isWin Se a aposta foi ganha ou não
 * @returns Objeto com informações sobre as recompensas aplicadas
 */
export async function applyGameRewards(
  userId: string, 
  bet: any, 
  isWin: boolean
): Promise<{
  addedXP: number;
  addedPoints: number;
  levelUp: boolean;
  oldLevel: number;
  newLevel: number;
}> {
  try {
    // Adicionar XP e pontos de fidelidade com base na aposta
    const rewards = await addBetRewards(userId, bet, isWin);
    
    console.log('Recompensas de nível aplicadas:', rewards);
    
    return rewards;
  } catch (error) {
    console.error('Erro ao aplicar recompensas de nível:', error);
    
    // Retornar valores padrão em caso de erro
    return {
      addedXP: 0,
      addedPoints: 0,
      levelUp: false,
      oldLevel: 0,
      newLevel: 0
    };
  }
}

/**
 * Obter o multiplicador de bônus do usuário com base em seu nível
 * @param userId ID do usuário
 * @returns Valor do multiplicador de bônus (em decimal)
 */
export async function getPlayerBonusMultiplier(userId: string): Promise<number> {
  try {
    const bonusMultiplier = await getUserBonusMultiplier(userId);
    console.log(`Multiplicador de bônus do usuário ${userId}: ${bonusMultiplier}`);
    return bonusMultiplier;
  } catch (error) {
    console.error('Erro ao obter multiplicador de bônus do usuário:', error);
    return 0; // Valor padrão em caso de erro
  }
}

/**
 * Aplicar o multiplicador de bônus do nível ao multiplicador do jogo
 * @param baseMultiplier Multiplicador base do jogo
 * @param bonusMultiplier Multiplicador de bônus do nível do jogador
 * @returns Multiplicador final com bônus aplicado
 */
export function applyLevelBonusToMultiplier(
  baseMultiplier: number, 
  bonusMultiplier: number
): number {
  // Garantir que os valores são números
  if (typeof baseMultiplier !== 'number' || typeof bonusMultiplier !== 'number') {
    return baseMultiplier;
  }
  
  // Aplicar o bônus (por exemplo, um bonusMultiplier de 0.05 significa +5%)
  return baseMultiplier * (1 + bonusMultiplier);
}

/**
 * Calcular o valor de ganho com o multiplicador de bônus aplicado
 * @param betAmount Valor da aposta
 * @param gameMultiplier Multiplicador do jogo
 * @param levelBonusMultiplier Multiplicador de bônus do nível
 * @returns Valor final do ganho com bônus aplicado
 */
export function calculateWinWithBonus(
  betAmount: number,
  gameMultiplier: number,
  levelBonusMultiplier: number
): number {
  // Calcula o multiplicador final com bônus
  const finalMultiplier = applyLevelBonusToMultiplier(gameMultiplier, levelBonusMultiplier);
  
  // Calcular o valor final do ganho
  return betAmount * finalMultiplier;
}