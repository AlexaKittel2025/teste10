import React from 'react';
import LevelCard from '@/components/LevelCard';
import BonusMultiplier from '@/components/BonusMultiplier';
import PlayerCountCard from '@/components/PlayerCountCard';
import { getMultiplierColor } from '../utils';

interface GameHeaderProps {
  currentMultiplier: number;
  timeLeft: number;
  currentPhase: 'betting' | 'running' | 'ended';
  placedBet: { amount: number; timestamp: number } | null;
  playerCount: number;
  isBonusActive: boolean;
  activeBonus: any;
  tooltipsEnabled: boolean;
}

export const GameHeader: React.FC<GameHeaderProps> = ({
  currentMultiplier,
  timeLeft,
  currentPhase,
  placedBet,
  playerCount,
  isBonusActive,
  activeBonus,
  tooltipsEnabled
}) => {
  return (
    <div className="flex flex-col sm:flex-row items-center justify-between mb-4 sm:mb-6 gap-3 sm:gap-4">
      <LevelCard />
      
      <div className="flex flex-col items-center">
        <h1 className="text-2xl sm:text-3xl font-bold text-center bg-gradient-to-r from-purple-400 to-pink-600 bg-clip-text text-transparent animate-pulse">
          Ao Vivo
        </h1>
        
        {isBonusActive && activeBonus && (
          <BonusMultiplier bonus={activeBonus} />
        )}
        
        {placedBet && currentPhase === 'running' && (
          <div className="mt-2 sm:mt-3 flex items-center gap-1 sm:gap-2">
            <span className="text-lg sm:text-xl font-semibold text-white">
              Multiplicador:
            </span>
            <span className={`text-2xl sm:text-3xl font-bold ${getMultiplierColor(currentMultiplier)}`}>
              {currentMultiplier.toFixed(2)}x
            </span>
          </div>
        )}
        
        <div className="mt-1 text-xs sm:text-sm text-gray-400">
          {currentPhase === 'betting' ? 'Faça sua aposta!' : 'Jogo em andamento'}
        </div>
        
        <div className="mt-2 text-xs sm:text-sm text-gray-300 tabular-nums">
          Tempo restante: {timeLeft}s
        </div>
      </div>
      
      <div className="flex items-center gap-3">
        <PlayerCountCard count={playerCount} tooltipsEnabled={tooltipsEnabled} />
      </div>
    </div>
  );
};