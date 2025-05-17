import React from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import QuickBetButtons from '@/components/Betting/QuickBetButtons';
import CustomQuickBets from '@/components/Betting/CustomQuickBets';
import AutoBetConfig, { AutoBetSettings } from '@/components/AutoBetConfig';
import Tooltip from '@/components/Tooltip';
import BetPlaced from '@/components/BetPlaced';
import { MIN_BET_AMOUNT, MAX_BET_AMOUNT } from '../constants';

interface BettingControlsProps {
  betAmount: number;
  setBetAmount: (amount: number) => void;
  placeBet: (amount: number) => void;
  isLoading: boolean;
  currentPhase: 'betting' | 'running' | 'ended';
  placedBet: { amount: number; timestamp: number } | null;
  userBalance: number;
  errorMessage: string | null;
  customQuickBets: number[];
  onQuickBetsChange: (bets: number[]) => void;
  isAutoBetting: boolean;
  autoBetSettings: AutoBetSettings | null;
  autoBetStats: any;
  startAutoBetting: (settings: AutoBetSettings) => void;
  stopAutoBetting: () => void;
  tooltipsEnabled: boolean;
}

export const BettingControls: React.FC<BettingControlsProps> = ({
  betAmount,
  setBetAmount,
  placeBet,
  isLoading,
  currentPhase,
  placedBet,
  userBalance,
  errorMessage,
  customQuickBets,
  onQuickBetsChange,
  isAutoBetting,
  autoBetSettings,
  autoBetStats,
  startAutoBetting,
  stopAutoBetting,
  tooltipsEnabled
}) => {
  return (
    <div className="w-full">
      {/* Betting Controls - Only show during betting phase or when no bet is placed */}
      {(currentPhase === 'betting' || (currentPhase === 'running' && !placedBet)) && (
        <>
          <div className="mb-4">
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mb-3">
              <div className="flex-1">
                <Input
                  type="number"
                  value={betAmount}
                  onChange={(e) => setBetAmount(Math.max(MIN_BET_AMOUNT, Math.min(MAX_BET_AMOUNT, Number(e.target.value))))}
                  min={MIN_BET_AMOUNT}
                  max={MAX_BET_AMOUNT}
                  step={1}
                  className="w-full text-base sm:text-lg font-bold h-12 sm:h-14"
                  placeholder="Valor da aposta"
                  disabled={isLoading || currentPhase !== 'betting' || isAutoBetting}
                />
              </div>
              
              <Tooltip 
                content="Coloque sua aposta antes da rodada começar!" 
                isVisible={tooltipsEnabled && currentPhase === 'betting'}
              >
                <Button
                  onClick={() => placeBet(betAmount)}
                  disabled={isLoading || currentPhase !== 'betting' || isAutoBetting}
                  className="w-full sm:w-auto min-w-[120px] sm:min-w-[140px] h-12 sm:h-14 text-base sm:text-lg font-bold bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:from-green-600 hover:to-emerald-700 shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Apostando...' : 'Apostar'}
                </Button>
              </Tooltip>
            </div>
            
            {/* Quick bet buttons */}
            <div className="mb-4">
              <QuickBetButtons
                defaultBets={customQuickBets || [5, 10, 20, 50, 100]}
                onSelectBet={(amount) => setBetAmount(amount)}
                userBalance={userBalance}
                selectedBet={betAmount}
              />
            </div>
            
            {/* Custom Quick Bets Component */}
            <div className="mb-4">
              <CustomQuickBets
                defaultBets={customQuickBets || [5, 10, 20, 50, 100]}
                userBalance={userBalance}
                onBetsChange={onQuickBetsChange}
                onSelectBet={(amount) => setBetAmount(amount)}
                selectedBet={betAmount}
              />
            </div>
            
            {/* Auto Bet Configuration */}
            <div className="mb-4">
              <AutoBetConfig
                isEnabled={isAutoBetting}
                onStart={startAutoBetting}
                onStop={stopAutoBetting}
                userBalance={userBalance}
                currentSettings={autoBetSettings}
                stats={autoBetStats}
              />
            </div>
            
            {/* Error Message */}
            {errorMessage && (
              <div className="mt-2 p-3 bg-red-900/50 border border-red-600 rounded-lg text-red-200 text-sm">
                {errorMessage}
              </div>
            )}
          </div>
        </>
      )}
      
      {/* Bet Placed Component */}
      {placedBet && currentPhase !== 'betting' && (
        <BetPlaced amount={placedBet.amount} />
      )}
    </div>
  );
};