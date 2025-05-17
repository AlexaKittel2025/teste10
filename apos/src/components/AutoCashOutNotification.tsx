'use client';

import React, { useEffect, useState } from 'react';

interface AutoCashOutNotificationProps {
  multiplier: number;
  amount: number;
  winAmount: number;
  onClose?: () => void;
  duration?: number;
}

const AutoCashOutNotification: React.FC<AutoCashOutNotificationProps> = ({
  multiplier,
  amount,
  winAmount,
  onClose,
  duration = 5000
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
      className={`fixed bottom-20 left-1/2 transform -translate-x-1/2 z-50 transition-all duration-500 ${
        visible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
      }`}
      onTransitionEnd={() => setAnimationEnded(true)}
    >
      <div className={`p-4 rounded-lg shadow-lg border w-80 ${
        multiplier >= 1.0 
          ? 'bg-gradient-to-r from-green-800 to-green-900 border-green-600' 
          : 'bg-gradient-to-r from-orange-800 to-amber-900 border-orange-600'
      }`}>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-white font-bold">
            Rodada Finalizada
          </h3>
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
        
        <div className="flex flex-col">
          <div className="flex justify-between text-white text-sm mb-1">
            <span>Valor Apostado:</span>
            <span>R$ {amount.toFixed(2)}</span>
          </div>
          
          <div className="flex justify-between text-white text-sm mb-1">
            <span>Multiplicador:</span>
            <span className={`font-bold ${multiplier >= 1.0 ? 'text-green-300' : 'text-orange-300'}`}>
              {multiplier.toFixed(2)}x
            </span>
          </div>
          
          <div className="flex justify-between text-white font-bold mt-2">
            <span>Valor Recebido:</span>
            <span className={`${multiplier >= 1.0 ? 'text-green-300' : 'text-yellow-300'}`}>
              R$ {winAmount.toFixed(2)}
            </span>
          </div>
        </div>
        
        <div className={`w-full mt-3 text-center text-xs ${multiplier >= 1.0 ? 'text-green-300' : 'text-yellow-300'}`}>
          Valor adicionado ao seu saldo!
        </div>
      </div>
    </div>
  );
};

export default AutoCashOutNotification;