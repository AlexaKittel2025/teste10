import { useState, useCallback, useEffect } from 'react';
import { 
  getRandomBonus, 
  getActiveSeasonalEvent, 
  BonusMultiplier as BonusType 
} from '@/lib/bonusService';
import { GamePhase } from './constants';

export const useBonusSystem = (currentPhase: GamePhase, currentMultiplier: number) => {
  const [activeBonus, setActiveBonus] = useState<BonusType | null>(null);
  const [isBonusActive, setIsBonusActive] = useState(false);
  const [activeSeason, setActiveSeason] = useState<{
    name: string; 
    theme: 'christmas' | 'halloween' | 'summer' | 'default'
  } | null>(null);
  const [currentRound, setCurrentRound] = useState(0);
  const [lastBonusRound, setLastBonusRound] = useState(0);

  // Verificar eventos sazonais ativos
  useEffect(() => {
    const season = getActiveSeasonalEvent();
    setActiveSeason(season);
    
    // Log para debugging
    if (season) {
      console.log(`Evento sazonal ativo: ${season.name} com tema ${season.theme}`);
    }
  }, []);

  // Função para verificar e ativar bônus com base nas condições atuais
  const checkAndActivateBonus = useCallback(() => {
    // Evitar verificação de bônus durante fase de apostas ou se já tiver um bônus ativo
    if (currentPhase !== 'running' || isBonusActive) return;
    
    // Evitar bônus muito frequentes (mínimo 3 rodadas entre bônus)
    if (currentRound - lastBonusRound < 3) return;
    
    // Evitar bônus com multiplicador muito baixo
    if (currentMultiplier < 1.0) return;
    
    // Chance de verificação de bônus (só verifica a cada X frames para otimização)
    if (Math.random() > 0.05) return; // 5% de chance de verificar em cada chamada
    
    // Buscar um bônus aleatório com base nas condições atuais
    const bonus = getRandomBonus(currentRound, currentMultiplier);
    
    if (bonus) {
      console.log(`Bônus ativado: ${bonus.description} com valor ${bonus.value}x`);
      setActiveBonus(bonus);
      setIsBonusActive(true);
      setLastBonusRound(currentRound);
      
      // Desativar o bônus após sua duração
      setTimeout(() => {
        setIsBonusActive(false);
        setActiveBonus(null);
      }, bonus.duration);
    }
  }, [currentPhase, isBonusActive, currentRound, lastBonusRound, currentMultiplier]);

  // Incrementar contador de rodadas
  const incrementRound = useCallback(() => {
    setCurrentRound(prev => prev + 1);
  }, []);

  // Resetar sistema de bônus
  const resetBonusSystem = useCallback(() => {
    setActiveBonus(null);
    setIsBonusActive(false);
    setCurrentRound(0);
    setLastBonusRound(0);
  }, []);

  return {
    activeBonus,
    isBonusActive,
    activeSeason,
    checkAndActivateBonus,
    incrementRound,
    resetBonusSystem
  };
};