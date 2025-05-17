'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import Tooltip from '@/components/Tooltip';

interface CashOutProps {
  placedBet: {amount: number, timestamp: number} | null;
  currentMultiplier: number;
  isLoading: boolean;
  onCashOut: () => Promise<boolean>;
  enableTooltips?: boolean;
  className?: string;
  currentPhase: 'betting' | 'running' | 'ended';
  cashedOut: boolean;
}

/**
 * Componente reutilizável para realizar Cash Out
 */
const CashOut: React.FC<CashOutProps> = ({
  placedBet,
  currentMultiplier,
  isLoading,
  onCashOut,
  enableTooltips = true,
  className = '',
  currentPhase,
  cashedOut
}) => {
  const [error, setError] = useState<string | null>(null);

  // Calcular o valor com base no multiplicador atual
  const calculateAmount = (): number => {
    if (!placedBet || !currentMultiplier) return 0;
    return placedBet.amount * currentMultiplier;
  };

  // Formatar o valor para exibição
  const formattedAmount = (): string => {
    return calculateAmount().toFixed(2);
  };

  // Cor do multiplicador com base no valor
  const getMultiplierColor = (multiplier: number): string => {
    if (multiplier >= 1.8) return 'text-green-400 animate-pulse';
    if (multiplier >= 1.5) return 'text-green-500';
    if (multiplier >= 1.2) return 'text-blue-300';
    if (multiplier >= 1.0) return 'text-blue-400';
    if (multiplier >= 0.7) return 'text-yellow-500';
    if (multiplier >= 0.5) return 'text-orange-500';
    return 'text-red-500';
  };

  // Função que faz o cash out
  const handleCashOut = async () => {
    try {
      setError(null);
      const success = await onCashOut();
      if (!success) {
        setError('Falha ao realizar Cash Out. Tente novamente.');
      }
    } catch (err) {
      console.error('Erro ao realizar Cash Out:', err);
      setError('Erro ao realizar Cash Out. Tente novamente.');
    }
  };

  // Se não houver aposta ou a fase não for a de jogo em andamento, não mostrar
  console.log('CashOut component check:', { 
    hasPlacedBet: !!placedBet, 
    currentPhase, 
    cashedOut,
    shouldRender: !!placedBet && currentPhase === 'running' && !cashedOut,
    multiplier: currentMultiplier,
    potentialAmount: placedBet ? placedBet.amount * currentMultiplier : 0
  });
  
  // Apenas para debug - vamos mostrar o componente para entender o problema
  if (placedBet) {
    console.log('placedBet existe, analisando detalhes:', placedBet);
  }
  
  if (!placedBet) {
    console.log('CashOut: No placedBet, returning null');
    return null;
  }
  
  if (currentPhase !== 'running') {
    console.log('CashOut: Phase is not running, returning null');
    return null;
  }
  
  if (cashedOut) {
    console.log('CashOut: Already cashed out, returning null');
    return null;
  }

  return (
    <div className={`bg-[#121212] rounded-lg p-4 border border-gray-800/80 shadow-lg animate-fadeInUp ${className}`}>
      {/* Mensagem de erro, se houver */}
      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-md text-red-400 text-sm shadow-sm">
          <div className="flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            {error}
          </div>
        </div>
      )}

      {/* Informações da aposta */}
      <div className="flex justify-between items-center mb-4">
        <div className="animate-fadeInLeft delay-100">
          <div className="text-sm text-gray-400">Sua aposta</div>
          <div className="text-white font-medium text-lg">R$ {placedBet.amount.toFixed(2)}</div>
        </div>
        <div className="animate-fadeInRight delay-100 potential-gains">
          <Tooltip
            content="Seu ganho potencial atual (aposta × multiplicador)"
            position="right"
            className={enableTooltips ? '' : 'hidden'}
          >
            <div>
              <div className="text-sm text-gray-400">Potencial ganho</div>
              <div className={`font-medium text-lg ${getMultiplierColor(currentMultiplier)}`}>
                R$ {formattedAmount()}
              </div>
            </div>
          </Tooltip>
        </div>
      </div>
      
      {/* Botão de Cash Out */}
      <Tooltip
        content={`Clique para garantir seus ganhos atuais: R$ ${formattedAmount()}`}
        position="top"
        className={enableTooltips ? '' : 'hidden'}
      >
        <Button 
          variant="primary" 
          className={`cashout-button w-full bg-gradient-to-r from-green-500 to-green-600 py-4 text-xl font-bold animate-fadeIn delay-300 ${
            currentMultiplier > 1.5 ? 'animate-custom-pulse shadow-lg shadow-green-500/30' : 
            currentMultiplier > 1.2 ? 'animate-pulse shadow-lg shadow-green-500/20' : ''
          }`}
          onClick={handleCashOut}
          disabled={isLoading}
        >
          {isLoading ? 'Processando...' : `CASH OUT ${formattedAmount()}`}
        </Button>
      </Tooltip>
    </div>
  );
};

export default CashOut;