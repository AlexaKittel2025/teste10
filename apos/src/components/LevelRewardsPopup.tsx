'use client';

import React, { useEffect, useState } from 'react';

interface LevelRewardsPopupProps {
  addedXP: number;
  addedPoints: number;
  onClose?: () => void;
  duration?: number;
}

const LevelRewardsPopup: React.FC<LevelRewardsPopupProps> = ({
  addedXP,
  addedPoints,
  onClose,
  duration = 3000
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
      className={`fixed bottom-4 right-4 z-50 transition-all duration-500 ${
        visible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
      }`}
      onTransitionEnd={() => setAnimationEnded(true)}
    >
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 p-4 rounded-lg border border-[#3bc37a]/50 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0">
            <div className="w-10 h-10 rounded-full bg-gradient-to-r from-[#1a86c7] to-[#3bc37a] flex items-center justify-center text-white font-bold">
              +
            </div>
          </div>
          
          <div className="flex-1">
            <h3 className="text-white font-medium mb-1">Recompensas recebidas!</h3>
            <div className="flex flex-col text-sm">
              {addedXP > 0 && (
                <span className="text-blue-300">+{addedXP} XP</span>
              )}
              {addedPoints > 0 && (
                <span className="text-green-300">+{addedPoints} Pontos</span>
              )}
            </div>
          </div>
          
          <button
            onClick={() => {
              setVisible(false);
              if (onClose) setTimeout(onClose, 500);
            }}
            className="text-white/60 hover:text-white"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
};

export default LevelRewardsPopup;