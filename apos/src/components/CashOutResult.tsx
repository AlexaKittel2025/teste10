'use client';

import React from 'react';

interface CashOutResultProps {
  cashedOut: boolean;
  cashOutMultiplier: number | null;
  placedBet: {amount: number, timestamp: number} | null;
  className?: string;
}

/**
 * Componente para exibir o resultado após o Cash Out
 */
const CashOutResult: React.FC<CashOutResultProps> = ({
  cashedOut,
  cashOutMultiplier,
  placedBet,
  className = ''
}) => {
  // Se não fez cash out ou não tem multiplicador, não mostrar
  if (!cashedOut || !cashOutMultiplier || !placedBet) {
    return null;
  }

  // Calcular o valor ganho
  const winAmount = placedBet.amount * cashOutMultiplier;

  return (
    <div className={`bg-[#121212] rounded-lg p-4 border border-green-500/20 text-center shadow-lg shadow-green-500/5 animate-scaleIn ${className}`}>
      <div className="text-green-500 font-bold mb-2 animate-fadeIn">Cash Out Realizado!</div>
      <div className="text-2xl font-bold text-white animate-fadeIn delay-100 animate-shimmer">
        R$ {winAmount.toFixed(2)}
      </div>
      <div className="text-sm text-gray-400 mt-2 animate-fadeIn delay-200">
        Multiplicador: {cashOutMultiplier.toFixed(2)}x
      </div>
    </div>
  );
};

export default CashOutResult;