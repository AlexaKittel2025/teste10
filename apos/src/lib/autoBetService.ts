// Serviço para gerenciar apostas automáticas
import { AutoBetSettings } from "@/components/AutoBetConfig";

export interface BetResult {
  won: boolean;
  amount: number;
  multiplier: number;
}

export class AutoBetManager {
  private settings: AutoBetSettings;
  private roundsRemaining: number;
  private initialBetAmount: number;
  private currentBetAmount: number;
  private totalWon: number = 0;
  private totalLost: number = 0;
  private lastResult: BetResult | null = null;
  private active: boolean = false;
  private processingResult: boolean = false;
  
  constructor(settings: AutoBetSettings) {
    this.settings = settings;
    this.roundsRemaining = settings.rounds;
    this.initialBetAmount = settings.amount;
    this.currentBetAmount = settings.amount;
  }
  
  /**
   * Inicia o gerenciador de apostas automáticas
   */
  start(): void {
    this.active = true;
    this.roundsRemaining = this.settings.rounds;
    this.currentBetAmount = this.settings.amount;
  }
  
  /**
   * Para o gerenciador de apostas automáticas
   */
  stop(): void {
    this.active = false;
  }
  
  /**
   * Verifica se deve continuar apostando automaticamente
   */
  shouldContinueBetting(): boolean {
    if (!this.active || this.roundsRemaining <= 0) {
      return false;
    }
    
    // Verificar condições de parada
    if (this.settings.stopOnWin && this.totalWon >= this.settings.stopOnWin) {
      console.log(`Parando apostas automáticas: atingiu limite de ganho de R$ ${this.settings.stopOnWin}`);
      return false;
    }
    
    if (this.settings.stopOnLoss && this.totalLost >= this.settings.stopOnLoss) {
      console.log(`Parando apostas automáticas: atingiu limite de perda de R$ ${this.settings.stopOnLoss}`);
      return false;
    }
    
    return true;
  }
  
  /**
   * Registra o resultado de uma rodada e atualiza os contadores
   */
  processRoundResult(result: BetResult): void {
    // Evitar processar múltiplos resultados simultaneamente (race condition)
    if (this.processingResult) return;
    
    try {
      this.processingResult = true;
      
      this.lastResult = result;
      this.roundsRemaining--;
      
      if (result.won) {
        this.totalWon += result.amount;
        
        // Resetar o valor da aposta após uma vitória, se configurado
        if (this.settings.resetAfterWin) {
          this.currentBetAmount = this.initialBetAmount;
        } 
        // Ou aumentar a aposta após uma vitória, se configurado
        else if (this.settings.increaseBetOnWin) {
          const increase = this.currentBetAmount * (this.settings.increaseBetOnWin / 100);
          this.currentBetAmount += increase;
          this.currentBetAmount = Math.floor(this.currentBetAmount); // Usar floor em vez de round para evitar problemas de arredondamento
        }
      } else {
        this.totalLost += result.amount;
        
        // Aumentar a aposta após uma derrota, se configurado
        if (this.settings.increaseBetOnLoss) {
          const increase = this.currentBetAmount * (this.settings.increaseBetOnLoss / 100);
          this.currentBetAmount += increase;
          this.currentBetAmount = Math.floor(this.currentBetAmount); // Usar floor em vez de round para evitar problemas de arredondamento
        }
      }
      
      // Validar que o valor da aposta não seja negativo
      if (this.currentBetAmount < 1) {
        this.currentBetAmount = 1;
      }
    } finally {
      this.processingResult = false;
    }
  }
  
  /**
   * Verifica se deve fazer cash out com base no multiplicador atual
   */
  shouldCashOut(currentMultiplier: number): boolean {
    if (!this.active || !this.settings.autoCashoutAt) {
      return false;
    }
    
    return currentMultiplier >= this.settings.autoCashoutAt;
  }
  
  /**
   * Retorna o valor da próxima aposta
   */
  getNextBetAmount(): number {
    return this.currentBetAmount;
  }
  
  /**
   * Retorna o número de rodadas restantes
   */
  getRoundsRemaining(): number {
    return this.roundsRemaining;
  }
  
  /**
   * Retorna se o gerenciador está ativo
   */
  isActive(): boolean {
    return this.active;
  }
  
  /**
   * Retorna as configurações atuais
   */
  getSettings(): AutoBetSettings {
    return this.settings;
  }
  
  /**
   * Retorna estatísticas das apostas automáticas
   */
  getStats() {
    return {
      totalWon: this.totalWon,
      totalLost: this.totalLost,
      netResult: this.totalWon - this.totalLost,
      lastResult: this.lastResult,
      roundsRemaining: this.roundsRemaining,
      currentBetAmount: this.currentBetAmount
    };
  }
}