'use client';

import React from 'react';
import Tooltip from '@/components/Tooltip';

interface GamePhaseIndicatorProps {
  currentPhase: 'betting' | 'running' | 'ended';
  timeLeft: number;
  className?: string;
  enableTooltips?: boolean;
}

/**
 * Componente para exibir a fase atual do jogo e o tempo restante
 */
const GamePhaseIndicator: React.FC<GamePhaseIndicatorProps> = ({
  currentPhase,
  timeLeft,
  className = '',
  enableTooltips = true
}) => {
  // Determinar as cores e textos com base na fase atual
  const getPhaseText = (): string => {
    switch (currentPhase) {
      case 'betting':
        return 'Fase de apostas';
      case 'running':
        return 'Fase de jogo';
      case 'ended':
        return 'Jogo finalizado';
      default:
        return 'Aguardando...';
    }
  };

  const getTooltipText = (): string => {
    switch (currentPhase) {
      case 'betting':
        return 'Durante a fase de apostas, você tem 5 segundos para fazer sua aposta';
      case 'running':
        return 'Fase de jogo ativa! Observe o multiplicador e faça Cash Out no momento certo';
      case 'ended':
        return 'Rodada finalizada. Veja o resultado e prepare-se para a próxima rodada';
      default:
        return 'Aguardando início do jogo';
    }
  };

  return (
    <div className={`rounded-lg px-3 py-2 backdrop-blur-sm shadow-md transition-all duration-500 game-phase-indicator ${
      currentPhase === 'betting' 
        ? 'bg-blue-500/10 border border-blue-500/40 animate-fadeInRight' 
        : currentPhase === 'running'
          ? 'bg-green-500/10 border border-green-500/40 animate-fadeInRight'
          : 'bg-yellow-500/10 border border-yellow-500/40 animate-fadeInRight'
    } ${className}`}>
      <Tooltip 
        content={getTooltipText()}
        position="left"
        className={enableTooltips ? '' : 'hidden'}
      >
        <div className="text-xs text-gray-400 uppercase tracking-wider mb-1 text-center animate-fadeIn">
          {getPhaseText()}
        </div>
        <div className={`text-lg font-bold text-center animate-scaleIn ${
          currentPhase === 'betting'
            ? 'bg-gradient-to-r from-[#4287f5] to-[#42c5f5] bg-clip-text text-transparent'
            : currentPhase === 'running'
              ? 'bg-gradient-to-r from-[#1a86c7] to-[#3bc37a] bg-clip-text text-transparent'
              : 'bg-gradient-to-r from-[#f5a742] to-[#f57e42] bg-clip-text text-transparent'
        }`}>
          {timeLeft}s
        </div>
      </Tooltip>
    </div>
  );
};

export default GamePhaseIndicator;