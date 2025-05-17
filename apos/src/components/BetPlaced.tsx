'use client';

import React from 'react';

interface BetPlacedProps {
  placedBet: {amount: number, timestamp: number} | null;
  className?: string;
}

/**
 * Componente para mostrar quando o usuário já colocou uma aposta e está aguardando o início da rodada
 */
const BetPlaced: React.FC<BetPlacedProps> = ({
  placedBet,
  className = ''
}) => {
  // Se não tem aposta, não mostrar
  if (!placedBet) {
    return null;
  }

  return (
    <div className={`bg-[#121212] rounded-lg p-4 border border-gray-800/80 text-center shadow-lg animate-scaleIn ${className}`}>
      <div className="text-sm text-gray-400 mb-2 animate-fadeIn">Aposta realizada</div>
      <div className="text-white font-medium text-lg animate-fadeIn delay-100">R$ {placedBet.amount.toFixed(2)}</div>
      <div className="text-sm text-gray-400 mt-2 animate-fadeIn delay-200">
        Aguardando início da rodada...
        <span className="inline-flex ml-1">
          <span className="animate-pulse delay-0">.</span>
          <span className="animate-pulse delay-200">.</span>
          <span className="animate-pulse delay-400">.</span>
        </span>
      </div>
    </div>
  );
};

export default BetPlaced;