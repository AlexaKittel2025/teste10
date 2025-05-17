'use client';

import React, { useEffect, useState } from 'react';

interface BonusMultiplierProps {
  type: 'standard' | 'jackpot' | 'holiday' | 'special'; // Tipos de bônus
  value: number; // Valor do multiplicador bônus
  duration?: number; // Duração em ms
  theme?: 'christmas' | 'halloween' | 'summer' | 'default'; // Tema visual
  onExpire?: () => void; // Callback quando o bônus expirar
}

const BonusMultiplier: React.FC<BonusMultiplierProps> = ({
  type,
  value,
  duration = 8000,
  theme = 'default',
  onExpire
}) => {
  const [visible, setVisible] = useState(true);
  const [animationEnded, setAnimationEnded] = useState(false);

  useEffect(() => {
    // Timer para expirar o bônus
    const timer = setTimeout(() => {
      setVisible(false);
      if (onExpire) onExpire();
    }, duration);

    // Cleanup
    return () => clearTimeout(timer);
  }, [duration, onExpire]);

  // Gerar classes CSS com base no tipo de bônus e tema
  const getContainerClasses = () => {
    let baseClasses = "fixed inset-0 flex items-center justify-center z-[999] pointer-events-none";
    if (!visible) return `${baseClasses} opacity-0`;
    return baseClasses;
  };

  const getMultiplierClasses = () => {
    let baseClasses = "text-8xl font-bold animate-custom-pulse";

    // Classes específicas por tipo
    const typeClasses = {
      standard: "text-blue-400 shadow-lg shadow-blue-500/30",
      jackpot: "text-yellow-400 shadow-lg shadow-yellow-500/50",
      holiday: "text-purple-400 shadow-lg shadow-purple-500/30",
      special: "text-green-400 shadow-lg shadow-green-500/30"
    };

    // Classes específicas por tema
    const themeClasses = {
      christmas: "text-red-500 shadow-green-500/30",
      halloween: "text-orange-500 shadow-purple-500/30",
      summer: "text-yellow-400 shadow-blue-400/30",
      default: ""
    };

    return `${baseClasses} ${typeClasses[type]} ${themeClasses[theme]}`;
  };

  // Gerar animações de partículas com base no tipo
  const renderParticles = () => {
    if (type === 'jackpot') {
      return (
        <div className="absolute inset-0 overflow-hidden">
          {Array.from({ length: 30 }).map((_, i) => (
            <div 
              key={i}
              className="absolute w-3 h-3 rounded-full bg-yellow-400 animate-particle"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 2}s`,
                animationDuration: `${2 + Math.random() * 3}s`
              }}
            />
          ))}
        </div>
      );
    }

    if (type === 'holiday' && theme === 'christmas') {
      return (
        <div className="absolute inset-0 overflow-hidden">
          {Array.from({ length: 20 }).map((_, i) => (
            <div 
              key={i}
              className="absolute w-4 h-4 text-white animate-falling-snow"
              style={{
                left: `${Math.random() * 100}%`,
                top: `-${20 + Math.random() * 10}px`,
                animationDelay: `${Math.random() * 5}s`,
                animationDuration: `${5 + Math.random() * 5}s`
              }}
            >
              ❄️
            </div>
          ))}
        </div>
      );
    }

    return null;
  };

  if (!visible && animationEnded) return null;

  return (
    <div 
      className={getContainerClasses()}
      style={{
        transition: 'opacity 1s ease-out',
      }}
      onTransitionEnd={() => setAnimationEnded(true)}
    >
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      
      {/* Partículas de acordo com o tema/tipo */}
      {renderParticles()}
      
      {/* Conteúdo principal do bônus */}
      <div className="relative z-10 flex flex-col items-center animate-scaleIn">
        <div className="text-white text-2xl mb-2 font-bold">
          {type === 'jackpot' ? 'JACKPOT MULTIPLIER!' : 
           type === 'holiday' ? `${theme.toUpperCase()} BONUS!` : 
           type === 'special' ? 'SPECIAL BONUS!' : 
           'BONUS MULTIPLIER!'}
        </div>
        
        <div className={getMultiplierClasses()}>
          {value.toFixed(2)}x
        </div>
        
        <div className="text-white text-xl mt-4">
          CASH OUT NOW FOR HUGE WINS!
        </div>
      </div>
    </div>
  );
};

export default BonusMultiplier;