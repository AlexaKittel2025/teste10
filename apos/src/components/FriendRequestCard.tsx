'use client';

import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { formatDate } from '@/lib/dateUtils';

interface FriendRequestCardProps {
  id: string;
  userName: string;
  userEmail: string;
  createdAt: string;
  onAccept: (id: string) => Promise<void>;
  onReject: (id: string) => Promise<void>;
}

export default function FriendRequestCard({
  id,
  userName,
  userEmail,
  createdAt,
  onAccept,
  onReject
}: FriendRequestCardProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Data formatada da solicitação
  const formattedDate = formatDate(createdAt);
  
  // Lidar com aceitação da solicitação
  const handleAccept = async () => {
    if (isProcessing) return;
    
    setIsProcessing(true);
    try {
      await onAccept(id);
    } finally {
      setIsProcessing(false);
    }
  };
  
  // Lidar com rejeição da solicitação
  const handleReject = async () => {
    if (isProcessing) return;
    
    setIsProcessing(true);
    try {
      await onReject(id);
    } finally {
      setIsProcessing(false);
    }
  };
  
  return (
    <Card className="bg-gray-900 border-gray-800">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-gray-800 rounded-full flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            
            <div>
              <h3 className="font-medium text-white">{userName}</h3>
              <p className="text-xs text-gray-400">{userEmail}</p>
              <p className="text-xs text-gray-500 mt-1">
                Solicitação enviada em {formattedDate}
              </p>
            </div>
          </div>
          
          <div className="flex space-x-2">
            <Button
              onClick={handleAccept}
              disabled={isProcessing}
              className="bg-[#3bc37a] hover:bg-[#2aa15a] h-8 px-3 py-1"
            >
              Aceitar
            </Button>
            
            <Button
              onClick={handleReject}
              disabled={isProcessing}
              variant="secondary"
              className="h-8 px-3 py-1"
            >
              Recusar
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}