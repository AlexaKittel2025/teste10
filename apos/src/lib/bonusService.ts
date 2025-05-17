// Serviço para gerenciar bônus e multiplicadores especiais

export type BonusType = 'standard' | 'jackpot' | 'holiday' | 'special';
export type ThemeType = 'christmas' | 'halloween' | 'summer' | 'default';

export interface BonusMultiplier {
  id: string;
  type: BonusType;
  value: number;
  theme: ThemeType;
  chance: number; // Probabilidade de 0 a 1
  duration: number; // Em milissegundos
  minRound: number; // Número mínimo de rodadas antes de poder aparecer
  maxMultiplier: number; // Multiplicador máximo ao qual pode ser aplicado
  description: string;
  active: boolean;
}

// Datas de eventos sazonais (atualizadas para datas específicas)
export const SEASONAL_EVENTS = {
  christmas: {
    name: 'Christmas',
    theme: 'christmas' as ThemeType,
    startDate: new Date(new Date().getFullYear(), 11, 15), // 15 de Dezembro
    endDate: new Date(new Date().getFullYear(), 11, 31), // 31 de Dezembro
    description: 'Bônus especiais de Natal! Maior chance de multiplicadores altos.',
    active: true
  },
  halloween: {
    name: 'Halloween',
    theme: 'halloween' as ThemeType,
    startDate: new Date(new Date().getFullYear(), 9, 25), // 25 de Outubro
    endDate: new Date(new Date().getFullYear(), 10, 2), // 2 de Novembro
    description: 'Halloween Especial! Multiplicadores assustadoramente altos.',
    active: true
  },
  summer: {
    name: 'Summer Festival',
    theme: 'summer' as ThemeType,
    startDate: new Date(new Date().getFullYear(), 5, 21), // 21 de Junho
    endDate: new Date(new Date().getFullYear(), 7, 21), // 21 de Agosto
    description: 'Festival de Verão! Ganhos quentes para dias quentes.',
    active: true
  }
};

// Catálogo de bônus disponíveis
export const BONUS_CATALOG: BonusMultiplier[] = [
  {
    id: 'standard-bonus-1',
    type: 'standard',
    value: 1.5,
    theme: 'default',
    chance: 0.15, // 15% de chance
    duration: 8000,
    minRound: 3,
    maxMultiplier: 1.8,
    description: 'Bônus padrão que aumenta o multiplicador em 50%',
    active: true
  },
  {
    id: 'standard-bonus-2',
    type: 'standard',
    value: 1.25,
    theme: 'default',
    chance: 0.25, // 25% de chance
    duration: 8000,
    minRound: 2,
    maxMultiplier: 1.5,
    description: 'Bônus padrão que aumenta o multiplicador em 25%',
    active: true
  },
  {
    id: 'jackpot-bonus',
    type: 'jackpot',
    value: 2.0,
    theme: 'default',
    chance: 0.05, // 5% de chance
    duration: 10000,
    minRound: 10,
    maxMultiplier: 1.9,
    description: 'JACKPOT! Dobra o valor do multiplicador atual',
    active: true
  },
  {
    id: 'christmas-bonus',
    type: 'holiday',
    value: 1.75,
    theme: 'christmas',
    chance: 0.2, // 20% de chance durante o evento
    duration: 12000,
    minRound: 5,
    maxMultiplier: 1.8,
    description: 'Bônus de Natal! Aumenta o multiplicador em 75%',
    active: true
  },
  {
    id: 'halloween-bonus',
    type: 'holiday',
    value: 1.66,
    theme: 'halloween',
    chance: 0.18, // 18% de chance durante o evento
    duration: 12000,
    minRound: 5,
    maxMultiplier: 1.7,
    description: 'Bônus de Halloween! Aumenta o multiplicador em 66%',
    active: true
  },
  {
    id: 'summer-bonus',
    type: 'holiday',
    value: 1.5,
    theme: 'summer',
    chance: 0.22, // 22% de chance durante o evento
    duration: 12000,
    minRound: 4,
    maxMultiplier: 1.6,
    description: 'Bônus de Verão! Aumenta o multiplicador em 50%',
    active: true
  },
  {
    id: 'special-bonus-weekend',
    type: 'special',
    value: 1.8,
    theme: 'default',
    chance: 0.1, // 10% de chance
    duration: 10000,
    minRound: 7,
    maxMultiplier: 1.8,
    description: 'Bônus especial de fim de semana! Aumenta o multiplicador em 80%',
    active: true
  }
];

/**
 * Verifica se há algum evento sazonal ativo atualmente
 */
export function getActiveSeasonalEvent(): { name: string; theme: ThemeType } | null {
  const now = new Date();
  
  for (const [key, event] of Object.entries(SEASONAL_EVENTS)) {
    if (!event.active) continue;
    
    if (now >= event.startDate && now <= event.endDate) {
      return {
        name: event.name,
        theme: event.theme
      };
    }
  }
  
  return null;
}

/**
 * Verifica se um bônus deve ser ativado com base na chance e condições
 */
export function shouldActivateBonus(
  bonus: BonusMultiplier,
  currentRound: number,
  currentMultiplier: number,
  activeEvent: { name: string; theme: ThemeType } | null
): boolean {
  // Verificar se o bônus está ativo
  if (!bonus.active) return false;
  
  // Verificar número mínimo de rodadas
  if (currentRound < bonus.minRound) return false;
  
  // Verificar multiplicador máximo
  if (currentMultiplier > bonus.maxMultiplier) return false;
  
  // Para bônus de eventos, verificar se o evento correspondente está ativo
  if (bonus.type === 'holiday') {
    if (!activeEvent || activeEvent.theme !== bonus.theme) return false;
  }
  
  // Verificação de fim de semana para bônus especial de fim de semana
  if (bonus.id === 'special-bonus-weekend') {
    const dayOfWeek = new Date().getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) return false; // Sábado (6) ou Domingo (0)
  }
  
  // Verificar chance baseada em número aleatório
  return Math.random() < bonus.chance;
}

/**
 * Retorna um bônus aleatório do catálogo com base nas condições atuais
 */
export function getRandomBonus(
  currentRound: number,
  currentMultiplier: number
): BonusMultiplier | null {
  const activeEvent = getActiveSeasonalEvent();
  
  // Filtrar bônus elegíveis
  const eligibleBonuses = BONUS_CATALOG.filter(bonus => 
    shouldActivateBonus(bonus, currentRound, currentMultiplier, activeEvent)
  );
  
  if (eligibleBonuses.length === 0) return null;
  
  // Priorizar bônus de eventos se houver um evento ativo
  if (activeEvent) {
    const eventBonuses = eligibleBonuses.filter(bonus => 
      bonus.type === 'holiday' && bonus.theme === activeEvent.theme
    );
    
    if (eventBonuses.length > 0) {
      // Selecionar aleatoriamente entre os bônus do evento
      return eventBonuses[Math.floor(Math.random() * eventBonuses.length)];
    }
  }
  
  // Selecionar aleatoriamente entre todos os bônus elegíveis
  return eligibleBonuses[Math.floor(Math.random() * eligibleBonuses.length)];
}

/**
 * Calcula o valor final do multiplicador após aplicar o bônus
 */
export function applyBonusToMultiplier(
  currentMultiplier: number,
  bonus: BonusMultiplier
): number {
  return currentMultiplier * bonus.value;
}