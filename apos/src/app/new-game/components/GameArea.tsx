import React from 'react';
import MultiplierChart from '../MultiplierChart';
import CashOut from '@/components/CashOut';
import CashOutResult from '@/components/CashOutResult';
import Tooltip from '@/components/Tooltip';

interface GameAreaProps {
  multiplierHistory: number[];
  currentMultiplier: number;
  currentPhase: 'betting' | 'running' | 'ended';
  placedBet: { amount: number; timestamp: number } | null;
  cashedOut: boolean;
  cashOut: () => void;
  isLoading: boolean;
  winAmount: number | null;
  cashOutMultiplier: number | null;
  activeBonus: any;
  activeSeason: any;
  tooltipsEnabled: boolean;
}

export const GameArea: React.FC<GameAreaProps> = ({
  multiplierHistory,
  currentMultiplier,
  currentPhase,
  placedBet,
  cashedOut,
  cashOut,
  isLoading,
  winAmount,
  cashOutMultiplier,
  activeBonus,
  activeSeason,
  tooltipsEnabled
}) => {
  return (
    <div className="h-[280px] sm:h-[400px] mb-4 bg-gray-800 rounded-lg overflow-hidden">
      <MultiplierChart 
        multiplierHistory={multiplierHistory} 
        currentPhase={currentPhase}
      />
      
      {/* Cash Out Button - Show during running phase when bet is placed and not cashed out */}
      {currentPhase === 'running' && placedBet && !cashedOut && (
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-center">
          <Tooltip 
            content="Retire seus ganhos antes que o multiplicador caia!"
            isVisible={tooltipsEnabled && currentMultiplier > 1.0}
          >
            <CashOut
              onCashOut={cashOut}
              disabled={isLoading || cashedOut}
              betAmount={placedBet.amount}
              currentMultiplier={currentMultiplier}
              hasBonus={!!activeBonus}
              bonusValue={activeBonus?.value}
            />
          </Tooltip>
        </div>
      )}
      
      {/* Cash Out Result - Show when cashed out */}
      {cashedOut && cashOutMultiplier !== null && winAmount !== null && (
        <CashOutResult
          multiplier={cashOutMultiplier}
          amount={winAmount}
          originalBet={placedBet?.amount || 0}
          hasBonus={!!activeBonus}
        />
      )}
    </div>
  );
};