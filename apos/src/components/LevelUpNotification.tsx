'use client';

import React, { useEffect, useState } from 'react';

interface LevelUpNotificationProps {
  newLevel: number;
  levelName: string;
  duration?: number;
  onClose?: () => void;
}

const LevelUpNotification: React.FC<LevelUpNotificationProps> = ({
  newLevel,
  levelName,
  duration = 5000,
  onClose
}) => {
  const [visible, setVisible] = useState(true);
  const [animationEnded, setAnimationEnded] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      if (onClose) onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  if (!visible && animationEnded) return null;

  return (
    <div
      className={`fixed inset-0 flex items-center justify-center z-[1000] pointer-events-none transition-opacity duration-1000 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
      onTransitionEnd={() => setAnimationEnded(true)}
    >
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      
      {/* Particles effect */}
      <div className="absolute inset-0 overflow-hidden">
        {Array.from({ length: 40 }).map((_, i) => (
          <div 
            key={i}
            className="absolute w-3 h-3 rounded-full bg-gradient-to-br from-[#1a86c7] to-[#3bc37a] animate-particle"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 2}s`,
              animationDuration: `${2 + Math.random() * 3}s`
            }}
          />
        ))}
      </div>
      
      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center animate-scaleIn bg-black/80 p-8 rounded-lg border border-[#1a86c7]/50">
        <div className="text-white text-3xl font-bold mb-2">LEVEL UP!</div>
        
        <div className="w-24 h-24 rounded-full bg-gradient-to-r from-[#1a86c7] to-[#3bc37a] flex items-center justify-center text-white text-5xl font-bold mb-4 animate-pulse">
          {newLevel}
        </div>
        
        <div className="text-white text-2xl font-semibold mb-6">
          {levelName}
        </div>
        
        <div className="text-gray-300 text-center max-w-md">
          <p>Parabéns! Você chegou a um novo nível!</p>
          <p className="mt-2">Continue jogando para desbloquear ainda mais recompensas!</p>
        </div>
      </div>
    </div>
  );
};

export default LevelUpNotification;