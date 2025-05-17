'use client';

import React from 'react';
import { formatRelativeTime } from '@/lib/dateUtils';
import { cn } from '@/lib/utils';

interface OnlineStatusBadgeProps {
  isOnline: boolean;
  lastSeen?: string | Date;
  showDot?: boolean;
  showText?: boolean;
  className?: string;
}

export default function OnlineStatusBadge({
  isOnline,
  lastSeen,
  showDot = true,
  showText = true,
  className = ''
}: OnlineStatusBadgeProps) {
  // Formatação do tempo desde a última atividade
  const getLastSeenText = () => {
    if (!lastSeen) return 'Desconhecido';
    return formatRelativeTime(lastSeen);
  };
  
  return (
    <div className={cn("flex items-center", className)}>
      {showDot && (
        <div 
          className={cn(
            "w-2.5 h-2.5 rounded-full mr-2",
            isOnline ? "bg-green-500" : "bg-gray-400"
          )}
        />
      )}
      
      {showText && (
        <span className="text-xs">
          {isOnline ? 'Online' : `Offline • ${getLastSeenText()}`}
        </span>
      )}
    </div>
  );
}