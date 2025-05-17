'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import Tooltip from '@/components/Tooltip';

interface AutoBetStats {
  totalWon: number;
  totalLost: number;
  netResult: number;
  roundsRemaining: number;
}

interface AutoBetConfigProps {
  userBalance: number;
  isActive: boolean;
  onStart: (config: AutoBetSettings) => void;
  onStop: () => void;
  onAutoModeChange?: (isAuto: boolean) => void;
  minBet: number;
  maxBet: number;
  isGamePhase: boolean;
  disableControls?: boolean;
  stats?: AutoBetStats;
}

export interface AutoBetSettings {
  amount: number;
  rounds: number;
  stopOnWin?: number;
  stopOnLoss?: number;
  autoCashoutAt?: number;
  increaseBetOnLoss?: number;
  increaseBetOnWin?: number;
  resetAfterWin?: boolean;
}

const AutoBetConfig: React.FC<AutoBetConfigProps> = ({
  userBalance,
  isActive,
  onStart,
  onStop,
  onAutoModeChange,
  minBet,
  maxBet,
  isGamePhase,
  disableControls = false,
  stats
}) => {
  // Estados para configuração de apostas automáticas
  const [amount, setAmount] = useState<number>(minBet);
  const [rounds, setRounds] = useState<number>(5);
  const [autoCashoutAt, setAutoCashoutAt] = useState<number | null>(null);
  const [stopOnWin, setStopOnWin] = useState<number | null>(null);
  const [stopOnLoss, setStopOnLoss] = useState<number | null>(null);
  const [increaseBetOnLoss, setIncreaseBetOnLoss] = useState<number | null>(null);
  const [increaseBetOnWin, setIncreaseBetOnWin] = useState<number | null>(null);
  const [resetAfterWin, setResetAfterWin] = useState<boolean>(true);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [autoBetEnabled, setAutoBetEnabled] = useState<boolean>(false);
  
  // Reset auto-bet settings when user stops the auto-betting
  useEffect(() => {
    if (!isActive && autoBetEnabled) {
      setAutoBetEnabled(false);
    }
  }, [isActive, autoBetEnabled]);
  
  // Armazenar o estado anterior para evitar chamadas desnecessárias
  const prevAutoBetEnabledRef = useRef<boolean>(autoBetEnabled);
  
  // Notify parent about auto mode changes
  useEffect(() => {
    // Só notificar se realmente houver uma mudança
    if (onAutoModeChange && prevAutoBetEnabledRef.current !== autoBetEnabled) {
      prevAutoBetEnabledRef.current = autoBetEnabled;
      onAutoModeChange(autoBetEnabled);
    }
  }, [autoBetEnabled, onAutoModeChange]);
  
  // Handle start auto-bet
  const handleStartAutoBet = () => {
    if (amount < minBet || amount > maxBet || rounds < 1) {
      return;
    }
    
    const settings: AutoBetSettings = {
      amount,
      rounds,
      ...(autoCashoutAt ? { autoCashoutAt } : {}),
      ...(stopOnWin ? { stopOnWin } : {}),
      ...(stopOnLoss ? { stopOnLoss } : {}),
      ...(increaseBetOnLoss ? { increaseBetOnLoss } : {}),
      ...(increaseBetOnWin ? { increaseBetOnWin } : {}),
      resetAfterWin
    };
    
    setAutoBetEnabled(true);
    onStart(settings);
  };
  
  // Handle stop auto-bet
  const handleStopAutoBet = () => {
    setAutoBetEnabled(false);
    onStop();
  };
  
  return (
    <Card className="bg-[#0f0f0f] border border-gray-800/60 rounded-xl p-4 overflow-hidden">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-white">Apostas Automáticas</h3>
        <Button 
          variant="secondary"
          className="text-sm"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? 'Esconder Opções' : 'Mostrar Opções'}
        </Button>
      </div>
      
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label htmlFor="auto-bet-amount" className="block text-sm text-gray-400 mb-1">
            Valor da Aposta
          </label>
          <Input
            id="auto-bet-amount"
            type="number"
            min={minBet}
            max={maxBet}
            step="5"
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="w-full bg-[#1e1e1e] border-gray-800"
            disabled={disableControls || isActive}
          />
        </div>
        <div>
          <label htmlFor="auto-bet-rounds" className="block text-sm text-gray-400 mb-1">
            Número de Rodadas
          </label>
          <Input
            id="auto-bet-rounds"
            type="number"
            min={1}
            max={100}
            value={rounds}
            onChange={(e) => setRounds(Number(e.target.value))}
            className="w-full bg-[#1e1e1e] border-gray-800"
            disabled={disableControls || isActive}
          />
        </div>
      </div>
      
      {isExpanded && (
        <div className="space-y-4 border-t border-gray-800/30 pt-4 mb-4 animate-fadeIn">
          <div>
            <label htmlFor="auto-cashout" className="block text-sm text-gray-400 mb-1">
              Cash Out Automático em (multiplicador)
              <Tooltip content="Faz cash out automaticamente quando o multiplicador atingir este valor" position="top">
                <span className="ml-1 text-xs text-gray-500 cursor-help">(?)</span>
              </Tooltip>
            </label>
            <Input
              id="auto-cashout"
              type="number"
              min={1.01}
              max={2.0}
              step="0.05"
              placeholder="Ex: 1.5"
              value={autoCashoutAt !== null ? autoCashoutAt : ''}
              onChange={(e) => {
                const val = e.target.value ? Number(e.target.value) : null;
                setAutoCashoutAt(val);
              }}
              className="w-full bg-[#1e1e1e] border-gray-800"
              disabled={disableControls || isActive}
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="stop-on-win" className="block text-sm text-gray-400 mb-1">
                Parar após ganhar (R$)
              </label>
              <Input
                id="stop-on-win"
                type="number"
                min={1}
                placeholder="Opcional"
                value={stopOnWin !== null ? stopOnWin : ''}
                onChange={(e) => {
                  const val = e.target.value ? Number(e.target.value) : null;
                  setStopOnWin(val);
                }}
                className="w-full bg-[#1e1e1e] border-gray-800"
                disabled={disableControls || isActive}
              />
            </div>
            <div>
              <label htmlFor="stop-on-loss" className="block text-sm text-gray-400 mb-1">
                Parar após perder (R$)
              </label>
              <Input
                id="stop-on-loss"
                type="number"
                min={1}
                placeholder="Opcional"
                value={stopOnLoss !== null ? stopOnLoss : ''}
                onChange={(e) => {
                  const val = e.target.value ? Number(e.target.value) : null;
                  setStopOnLoss(val);
                }}
                className="w-full bg-[#1e1e1e] border-gray-800"
                disabled={disableControls || isActive}
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="increase-on-loss" className="block text-sm text-gray-400 mb-1">
                Aumentar aposta após perda (%)
              </label>
              <Input
                id="increase-on-loss"
                type="number"
                min={0}
                max={200}
                placeholder="Opcional"
                value={increaseBetOnLoss !== null ? increaseBetOnLoss : ''}
                onChange={(e) => {
                  const val = e.target.value ? Number(e.target.value) : null;
                  setIncreaseBetOnLoss(val);
                }}
                className="w-full bg-[#1e1e1e] border-gray-800"
                disabled={disableControls || isActive}
              />
            </div>
            <div>
              <label htmlFor="increase-on-win" className="block text-sm text-gray-400 mb-1">
                Aumentar aposta após ganho (%)
              </label>
              <Input
                id="increase-on-win"
                type="number"
                min={0}
                max={200}
                placeholder="Opcional"
                value={increaseBetOnWin !== null ? increaseBetOnWin : ''}
                onChange={(e) => {
                  const val = e.target.value ? Number(e.target.value) : null;
                  setIncreaseBetOnWin(val);
                }}
                className="w-full bg-[#1e1e1e] border-gray-800"
                disabled={disableControls || isActive}
              />
            </div>
          </div>
          
          <div className="flex items-center">
            <input
              id="reset-after-win"
              type="checkbox"
              className="w-4 h-4 bg-[#1e1e1e] border-gray-800 rounded"
              checked={resetAfterWin}
              onChange={(e) => setResetAfterWin(e.target.checked)}
              disabled={disableControls || isActive}
            />
            <label htmlFor="reset-after-win" className="ml-2 text-sm text-gray-400">
              Resetar valor da aposta após ganho
            </label>
          </div>
        </div>
      )}
      
      <div className="flex justify-between mt-4">
        {!isActive ? (
          <Button
            variant="primary"
            className="w-full bg-gradient-to-r from-[#1a86c7] to-[#3bc37a] py-2 text-white"
            onClick={handleStartAutoBet}
            disabled={disableControls || isGamePhase || amount < minBet || amount > maxBet || rounds < 1}
          >
            Iniciar Apostas Automáticas
          </Button>
        ) : (
          <Button
            variant="secondary"
            className="w-full bg-red-500/20 border-red-500/30 text-red-400 hover:bg-red-500/30"
            onClick={handleStopAutoBet}
            disabled={disableControls}
          >
            Parar Apostas Automáticas
          </Button>
        )}
      </div>
      
      {isActive && (
        <div className="mt-4 p-3 bg-gray-800/30 rounded-md space-y-2 animate-fadeIn">
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-gray-800/30 p-2 rounded">
              <div className="text-gray-400 text-xs">Apostas restantes</div>
              <div className="text-white font-medium">{stats ? stats.roundsRemaining : rounds}</div>
            </div>
            <div className="bg-gray-800/30 p-2 rounded">
              <div className="text-gray-400 text-xs">Próxima aposta</div>
              <div className="text-white font-medium">R$ {stats?.currentBetAmount ? stats.currentBetAmount.toFixed(2) : amount.toFixed(2)}</div>
            </div>
          </div>
          {autoCashoutAt && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Cash out em:</span>
              <span className="text-green-400 font-medium">{autoCashoutAt}x</span>
            </div>
          )}
          {stats && (
            <div className="border-t border-gray-700/50 pt-2 mt-2">
              <div className="text-xs text-gray-500 uppercase mb-1">Estatísticas de aposta automática</div>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div className="bg-gray-800/40 p-2 rounded">
                  <div className="text-gray-400 text-xs">Ganhos</div>
                  <div className="text-green-500">{stats.totalWon.toFixed(2)}</div>
                </div>
                <div className="bg-gray-800/40 p-2 rounded">
                  <div className="text-gray-400 text-xs">Perdas</div>
                  <div className="text-red-500">{stats.totalLost.toFixed(2)}</div>
                </div>
                <div className="bg-gray-800/40 p-2 rounded">
                  <div className="text-gray-400 text-xs">Resultado</div>
                  <div className={stats.netResult >= 0 ? "text-green-500" : "text-red-500"}>
                    {stats.netResult.toFixed(2)}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
};

export default AutoBetConfig;