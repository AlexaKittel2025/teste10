'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import OnlineStatusBadge from '@/components/OnlineStatusBadge';

interface FriendCardProps {
  id: string;
  name: string;
  level?: number;
  isOnline?: boolean;
  lastSeen?: string;
  currentActivity?: string;
  friendshipId: string;
  onRemove: (friendshipId: string) => void;
  onBlock: (friendshipId: string) => void;
}

export default function FriendCard({
  id,
  name,
  level = 1,
  isOnline = false,
  lastSeen,
  currentActivity,
  friendshipId,
  onRemove,
  onBlock
}: FriendCardProps) {
  const [showActions, setShowActions] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [isBlocking, setIsBlocking] = useState(false);
  
  // Lidar com a remoção de amigo
  const handleRemove = async () => {
    if (isRemoving) return;
    
    setIsRemoving(true);
    try {
      await onRemove(friendshipId);
    } finally {
      setIsRemoving(false);
      setShowActions(false);
    }
  };
  
  // Lidar com o bloqueio de amigo
  const handleBlock = async () => {
    if (isBlocking) return;
    
    setIsBlocking(true);
    try {
      await onBlock(friendshipId);
    } finally {
      setIsBlocking(false);
      setShowActions(false);
    }
  };
  
  return (
    <Card className="bg-gray-900 border-gray-800 hover:border-gray-700 transition-colors">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className="relative">
              {/* Avatar do usuário */}
              <div className="w-12 h-12 bg-gray-800 rounded-full flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              
              {/* Indicador de nível */}
              <div className="absolute -bottom-1 -right-1 bg-gray-800 text-white text-[10px] rounded-full w-5 h-5 flex items-center justify-center border border-gray-700">
                {level}
              </div>
            </div>
            
            <div>
              <h3 className="font-medium text-white">{name}</h3>
              <OnlineStatusBadge 
                isOnline={isOnline} 
                lastSeen={lastSeen} 
                className="mt-1" 
              />
              
              {isOnline && currentActivity && (
                <div className="text-xs text-gray-400 mt-1">
                  {currentActivity}
                </div>
              )}
            </div>
          </div>
          
          <div className="relative">
            <button
              onClick={() => setShowActions(!showActions)}
              className="text-gray-400 hover:text-white focus:outline-none"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
              </svg>
            </button>
            
            {showActions && (
              <div className="absolute right-0 mt-2 w-48 bg-gray-800 rounded-md shadow-lg py-1 z-10 border border-gray-700">
                <button
                  onClick={handleRemove}
                  disabled={isRemoving}
                  className="block w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700"
                >
                  {isRemoving ? 'Removendo...' : 'Remover amigo'}
                </button>
                <button
                  onClick={handleBlock}
                  disabled={isBlocking}
                  className="block w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-gray-700"
                >
                  {isBlocking ? 'Bloqueando...' : 'Bloquear usuário'}
                </button>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}