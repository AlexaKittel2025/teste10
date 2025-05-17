'use client';

import React from 'react';
import { useRouter } from 'next/navigation';

interface DailyLimitInfoProps {
  currentLimit: number;
  defaultLimit: number;
  dailyTotal: number;
  minBet: number;
  maxBet: number;
  multiplier: number;
}

const DailyLimitInfo: React.FC<DailyLimitInfoProps> = ({
  currentLimit,
  defaultLimit,
  dailyTotal,
  minBet,
  maxBet,
  multiplier
}) => {
  const router = useRouter();
  
  const isCustomLimit = currentLimit !== defaultLimit;
  
  return (
    <div className="text-center text-xs text-gray-400 mb-2">
      <p>
        Limites: Min R$ {minBet} • Max R$ {maxBet} • 
        <span 
          className={`${isCustomLimit ? 'text-[#3bc37a] font-medium' : ''}`}
          title={isCustomLimit ? 'Limite personalizado definido no perfil' : ''}
        >
          Diário R$ {currentLimit.toFixed(2)}
          {isCustomLimit && ' ✓'}
        </span>
      </p>
      <p>
        Total apostado hoje: R$ {dailyTotal.toFixed(2)} • Multiplicador: {multiplier}x •
        <span 
          onClick={() => router.push('/profile')} 
          className="text-[#1a86c7] cursor-pointer hover:underline ml-1"
        >
          Ajustar Limite
        </span>
      </p>
    </div>
  );
};

export default DailyLimitInfo; 