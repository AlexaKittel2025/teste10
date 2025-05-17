'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';

/**
 * Hook para integrar o sistema de níveis com componentes de jogo
 */
export function useLevelSystem() {
  const { data: session } = useSession();
  const [isLoading, setIsLoading] = useState(true);
  const [levelData, setLevelData] = useState<any>(null);
  const [bonusMultiplier, setBonusMultiplier] = useState(0);
  const [error, setError] = useState<string | null>(null);
  
  // Carregar dados do nível do usuário
  const fetchLevelData = useCallback(async () => {
    if (!session?.user?.id) return;
    
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await fetch('/api/user/level', {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' }
      });
      
      if (!response.ok) {
        throw new Error('Falha ao carregar dados de nível');
      }
      
      const data = await response.json();
      setLevelData(data);
      
      // Extrair o multiplicador de bônus
      if (data.currentLevel && typeof data.currentLevel.bonusMultiplier === 'number') {
        setBonusMultiplier(data.currentLevel.bonusMultiplier);
      }
    } catch (err) {
      console.error('Erro ao carregar dados de nível:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setIsLoading(false);
    }
  }, [session?.user?.id]);
  
  // Carregar dados quando o usuário estiver autenticado
  useEffect(() => {
    if (session?.user?.id) {
      fetchLevelData();
    }
  }, [session?.user?.id, fetchLevelData]);
  
  // Aplicar o multiplicador de bônus ao valor do jogo
  const applyBonusMultiplier = useCallback((baseValue: number): number => {
    return baseValue * (1 + bonusMultiplier);
  }, [bonusMultiplier]);
  
  // Retornar funções e dados úteis para o sistema de níveis
  return {
    isLoading,
    levelData,
    bonusMultiplier,
    error,
    refreshLevelData: fetchLevelData,
    applyBonusMultiplier,
    hasBonus: bonusMultiplier > 0
  };
}

export default useLevelSystem;