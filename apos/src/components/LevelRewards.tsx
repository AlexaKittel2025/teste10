'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import LevelUpNotification from './LevelUpNotification';
import LevelRewardsPopup from './LevelRewardsPopup';

interface LevelRewardsProps {
  levelData?: {
    addedXP: number;
    addedPoints: number;
    levelUp: boolean;
    newLevel?: number;
  };
  onClose?: () => void;
}

const LevelRewards: React.FC<LevelRewardsProps> = ({ levelData, onClose }) => {
  const { data: session } = useSession();
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [showRewards, setShowRewards] = useState(false);
  const [levelInfo, setLevelInfo] = useState<any>(null);

  useEffect(() => {
    if (!levelData) return;

    // Se houver dados de nível, mostrar recompensas
    if (levelData.addedXP > 0 || levelData.addedPoints > 0) {
      setShowRewards(true);
    }

    // Se houver subida de nível, buscar informações do nível e mostrar notificação
    if (levelData.levelUp && levelData.newLevel) {
      fetchLevelInfo(levelData.newLevel);
    }
  }, [levelData]);

  const fetchLevelInfo = async (level: number) => {
    try {
      const response = await fetch('/api/user/level');
      if (response.ok) {
        const data = await response.json();
        setLevelInfo({
          level: data.currentLevel.level,
          name: data.currentLevel.name,
          description: data.currentLevel.description
        });
        setShowLevelUp(true);
      }
    } catch (error) {
      console.error('Erro ao buscar informações de nível:', error);
    }
  };

  const handleLevelUpClose = () => {
    setShowLevelUp(false);
    
    // Após fechar o level up, garantir que as recompensas serão exibidas
    if (levelData && (levelData.addedXP > 0 || levelData.addedPoints > 0)) {
      setShowRewards(true);
    }
  };

  const handleRewardsClose = () => {
    setShowRewards(false);
    if (onClose) onClose();
  };

  return (
    <>
      {showLevelUp && levelInfo && (
        <LevelUpNotification
          newLevel={levelInfo.level}
          levelName={levelInfo.name}
          onClose={handleLevelUpClose}
        />
      )}
      
      {showRewards && levelData && (
        <LevelRewardsPopup
          addedXP={levelData.addedXP}
          addedPoints={levelData.addedPoints}
          onClose={handleRewardsClose}
        />
      )}
    </>
  );
};

export default LevelRewards;