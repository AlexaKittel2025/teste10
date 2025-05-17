/**
 * Constantes do jogo
 * Centraliza valores usados em diferentes partes do sistema para manter consistência
 */

// Limites de apostas
export const MIN_BET_AMOUNT = 5;      // Aposta mínima: R$ 5,00
export const MAX_BET_AMOUNT = 1000;   // Aposta máxima: R$ 1000,00
export const DEFAULT_DAILY_BET_LIMIT = 5000; // Limite diário padrão: R$ 5000,00

// Duração das fases (em milissegundos)
export const BETTING_PHASE_DURATION = 5000; // 5 segundos para apostas
export const ROUND_DURATION = 20000; // 20 segundos para a rodada em execução

// Multiplicadores para ganhos
export const WIN_MULTIPLIER = 1.8; // Multiplicador para ganhos (1.8x o valor apostado)
export const MAX_POSSIBLE_MULTIPLIER = 2.0; // Multiplicador máximo possível em cash-out
export const MIN_POSSIBLE_MULTIPLIER = 0.0; // Multiplicador mínimo possível

// Tipos de apostas
export enum BetType {
  ABOVE = "ABOVE",
  BELOW = "BELOW"
}

// Status de rodadas
export enum RoundStatus {
  BETTING = "BETTING",
  RUNNING = "RUNNING",
  FINISHED = "FINISHED"
}

// Status de apostas
export enum BetStatus {
  PENDING = "PENDING",
  COMPLETED = "COMPLETED",
  CANCELED = "CANCELED"
}

// Resultado de apostas
export enum BetResult {
  WIN = "WIN",
  LOSE = "LOSE"
}