import { useState, useRef, useCallback } from 'react';
import { AutoBetSettings } from '@/components/AutoBetConfig';
import { AutoBetManager } from '@/lib/autoBetService';
import { AutoBetStats } from './constants';

export const useAutoBetting = () => {
  const [isAutoBetting, setIsAutoBetting] = useState(false);
  const [autoBetSettings, setAutoBetSettings] = useState<AutoBetSettings | null>(null);
  const [autoBetStats, setAutoBetStats] = useState<AutoBetStats | null>(null);
  const autoBetManagerRef = useRef<AutoBetManager | null>(null);

  // Start auto-betting with the given settings
  const startAutoBetting = useCallback((settings: AutoBetSettings) => {
    console.log('Iniciando apostas automáticas com configuração:', settings);
    
    // Criar uma nova instância do gerenciador de apostas automáticas
    const manager = new AutoBetManager(settings);
    manager.start();
    
    // Armazenar referência e configuração
    autoBetManagerRef.current = manager;
    setAutoBetSettings(settings);
    setIsAutoBetting(true);
    
    // Inicializar estatísticas
    setAutoBetStats({
      totalWon: 0,
      totalLost: 0,
      netResult: 0,
      roundsRemaining: settings.rounds
    });
  }, []);

  // Stop auto-betting
  const stopAutoBetting = useCallback(() => {
    if (autoBetManagerRef.current) {
      console.log('Parando apostas automáticas');
      autoBetManagerRef.current.stop();
      
      // Atualizar estatísticas finais
      const stats = autoBetManagerRef.current.getStats();
      setAutoBetStats({
        totalWon: stats.totalWon,
        totalLost: stats.totalLost,
        netResult: stats.netResult,
        roundsRemaining: stats.roundsRemaining
      });
    }
    
    setIsAutoBetting(false);
    setAutoBetSettings(null);
  }, []);

  // Update auto-bet stats
  const updateAutoBetStats = useCallback((stats: AutoBetStats) => {
    setAutoBetStats(stats);
  }, []);

  // Check if should continue auto-betting
  const shouldContinueAutoBetting = useCallback(() => {
    return autoBetManagerRef.current?.shouldContinueBetting() ?? false;
  }, []);

  // Process auto-bet result
  const processAutoBetResult = useCallback((bet: any, result: any) => {
    if (autoBetManagerRef.current) {
      autoBetManagerRef.current.processBetResult(bet, result);
      
      // Atualizar estatísticas
      const stats = autoBetManagerRef.current.getStats();
      updateAutoBetStats({
        totalWon: stats.totalWon,
        totalLost: stats.totalLost,
        netResult: stats.netResult,
        roundsRemaining: stats.roundsRemaining
      });
      
      // Verificar se deve continuar
      if (!autoBetManagerRef.current.shouldContinueBetting()) {
        console.log('Atingido critério de parada, parando apostas automáticas');
        stopAutoBetting();
      }
    }
  }, [stopAutoBetting, updateAutoBetStats]);

  return {
    isAutoBetting,
    autoBetSettings,
    autoBetStats,
    startAutoBetting,
    stopAutoBetting,
    shouldContinueAutoBetting,
    processAutoBetResult,
    autoBetManager: autoBetManagerRef.current
  };
};