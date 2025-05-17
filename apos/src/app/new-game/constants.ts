// Constantes do jogo
export const MIN_BET_AMOUNT = 5;          // Aposta mínima: R$ 5,00
export const MAX_BET_AMOUNT = 1000;       // Aposta máxima: R$ 1000,00
export const DAILY_BET_LIMIT = 15000;     // Limite diário: R$ 15000,00
export const BETTING_PHASE_DURATION = 5;  // 5 segundos para apostas
export const GAME_PHASE_DURATION = 20;    // 20 segundos para a rodada
export const INITIAL_MULTIPLIER = 1.0;    // Multiplicador inicial
export const MAX_MULTIPLIER = 2.0;        // Multiplicador máximo
export const MIN_MULTIPLIER = 0.0;        // Multiplicador mínimo

// Quick bets padrão
export const DEFAULT_QUICK_BETS = [5, 10, 20, 50, 100];

// Fases do jogo
export type GamePhase = 'betting' | 'running' | 'ended';

// Estado da aposta colocada
export interface PlacedBet {
  amount: number;
  timestamp: number;
}

// Estatísticas das apostas automáticas
export interface AutoBetStats {
  totalWon: number;
  totalLost: number;
  netResult: number;
  roundsRemaining: number;
}

// Estado do jogo recebido do servidor
export interface GameState {
  phase: GamePhase;
  timeLeft: number;
  multiplier: number;
  roundId: string;
  bets: any[];
  connectedPlayers: number;
}

// Últimos resultados
export interface GameResult {
  multiplier: number;
  timestamp: number;
}