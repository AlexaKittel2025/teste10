'use client';

import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import OnlineStatusBadge from '@/components/OnlineStatusBadge';

interface UserSearchCardProps {
  id: string;
  name: string;
  email: string;
  level?: number;
  isOnline?: boolean;
  lastSeen?: string;
  onAdd: (userId: string) => Promise<void>;
}

export default function UserSearchCard({
  id,
  name,
  email,
  level = 1,
  isOnline = false,
  lastSeen,
  onAdd
}: UserSearchCardProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [isAdded, setIsAdded] = useState(false);
  
  // Lidar com adição de amigo
  const handleAdd = async () => {
    if (isAdding || isAdded) return;
    
    setIsAdding(true);
    try {
      await onAdd(id);
      setIsAdded(true);
    } catch (error) {
      console.error('Erro ao adicionar amigo:', error);
    } finally {
      setIsAdding(false);
    }
  };
  
  return (
    <Card className="bg-gray-900 border-gray-800">
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
              <p className="text-xs text-gray-400">{email}</p>
              <OnlineStatusBadge 
                isOnline={isOnline} 
                lastSeen={lastSeen}
                className="mt-1" 
              />
            </div>
          </div>
          
          <Button
            onClick={handleAdd}
            disabled={isAdding || isAdded}
            className={isAdded ? 'bg-gray-800 text-gray-400' : 'bg-[#3bc37a] hover:bg-[#2aa15a]'}
          >
            {isAdding ? (
              <div className="flex items-center">
                <div className="w-4 h-4 border-2 border-t-transparent border-white rounded-full animate-spin mr-2"></div>
                Adicionando...
              </div>
            ) : isAdded ? (
              <div className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Solicitação enviada
              </div>
            ) : (
              <div className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Adicionar amigo
              </div>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}