// Funções utilitárias para o jogo

// Calcular a cor do multiplicador com base no valor
export const getMultiplierColor = (multiplier: number | undefined) => {
  if (multiplier === undefined || isNaN(Number(multiplier))) return 'text-white';
  if (multiplier >= 1.8) return 'text-green-400 animate-pulse';
  if (multiplier >= 1.5) return 'text-green-500';
  if (multiplier >= 1.2) return 'text-blue-300';
  if (multiplier >= 1.0) return 'text-blue-400';
  if (multiplier >= 0.7) return 'text-yellow-500';
  if (multiplier >= 0.5) return 'text-orange-500';
  return 'text-red-500';
};

// Obter apostas rápidas personalizadas do localStorage
export const getCustomQuickBets = (defaultBets: number[]): number[] => {
  if (typeof window !== 'undefined') {
    try {
      const savedBets = localStorage.getItem('customQuickBets');
      if (savedBets) {
        const bets = JSON.parse(savedBets);
        // Garantir que é um array válido
        if (Array.isArray(bets) && bets.length > 0) {
          return bets;
        }
      }
    } catch (error) {
      console.error('Erro ao carregar apostas rápidas personalizadas:', error);
    }
  }
  return defaultBets || [5, 10, 20, 50, 100];
};

// Salvar apostas rápidas personalizadas
export const saveCustomQuickBets = (bets: number[]) => {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('customQuickBets', JSON.stringify(bets));
    } catch (error) {
      console.error('Erro ao salvar apostas rápidas personalizadas:', error);
    }
  }
};

// Verificar se o tutorial foi visto
export const getTutorialSeen = (): boolean => {
  if (typeof window !== 'undefined') {
    try {
      return localStorage.getItem('gameMultiplierTutorialSeen') === 'true';
    } catch (error) {
      console.error('Error accessing localStorage:', error);
    }
  }
  return false;
};

// Marcar tutorial como visto
export const setTutorialSeen = () => {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('gameMultiplierTutorialSeen', 'true');
    } catch (error) {
      console.error('Error saving tutorial state:', error);
    }
  }
};

// Obter preferência de tooltips
export const getTooltipsEnabled = (): boolean => {
  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem('gameMultiplierTooltipsEnabled');
      return saved === null ? true : saved === 'true';
    } catch (error) {
      console.error('Error accessing localStorage:', error);
    }
  }
  return true;
};

// Salvar preferência de tooltips
export const saveTooltipsPreference = (enabled: boolean) => {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('gameMultiplierTooltipsEnabled', String(enabled));
    } catch (error) {
      console.error('Error saving tooltips preference:', error);
    }
  }
};