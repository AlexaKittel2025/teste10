'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useBalance } from '@/lib/BalanceContext';
import LastResults from '@/components/LastResults';
import LevelCard from '@/components/LevelCard';
import LevelRewards from '@/components/LevelRewards';
import GameTutorial from '@/components/GameTutorial';
import AutoCashOutNotification from '@/components/AutoCashOutNotification';
import ChatSupport from '@/components/ChatSupport';
import PlayerCountCard from '@/components/PlayerCountCard';
import MultiplicadorGame from '@/components/MultiplicadorGame';

export default function NovoJogo() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { userBalance, refreshBalance } = useBalance();
  
  // Estado para recompensas de nível
  const [levelRewards, setLevelRewards] = useState<{
    addedXP: number;
    addedPoints: number;
    levelUp: boolean;
    newLevel?: number;
  } | null>(null);
  const [showLevelRewards, setShowLevelRewards] = useState(false);
  
  // Estado para notificação de cash-out automático
  const [showAutoCashOutNotification, setShowAutoCashOutNotification] = useState(false);
  const [autoCashOutData, setAutoCashOutData] = useState<{
    multiplier: number;
    amount: number;
    winAmount: number;
  } | null>(null);
  
  // Estado para controlar a visibilidade do chat de suporte
  const [showChat, setShowChat] = useState(false);
  const [hasNewMessages, setHasNewMessages] = useState(false);
  
  // Tutorial and tooltips state
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialCompleted, setTutorialCompleted] = useState(false);
  const [tooltipsEnabled, setTooltipsEnabled] = useState(true);
  
  // Tutorial handlers
  const handleTutorialComplete = () => {
    try {
      localStorage.setItem('gameMultiplierTutorialSeen', 'true');
      setShowTutorial(false);
      setTutorialCompleted(true);
    } catch (error) {
      console.error('Error saving tutorial state:', error);
    }
  };
  
  const handleTutorialSkip = () => {
    try {
      localStorage.setItem('gameMultiplierTutorialSeen', 'true');
      setShowTutorial(false);
      setTutorialCompleted(true);
    } catch (error) {
      console.error('Error saving tutorial state:', error);
    }
  };
  
  // Toggle tooltips
  const toggleTooltips = () => {
    setTooltipsEnabled(prev => !prev);
    try {
      localStorage.setItem('gameMultiplierTooltipsEnabled', String(!tooltipsEnabled));
    } catch (error) {
      console.error('Error saving tooltips preference:', error);
    }
  };

  // Manipulação de ganhos no jogo
  const handleWin = (amount: number) => {
    // Exibir notificação de ganho
    setShowAutoCashOutNotification(true);
    setAutoCashOutData({
      multiplier: 1.5, // Exemplo
      amount: amount / 1.5, // Calculando o valor da aposta original
      winAmount: amount
    });
  };

  if (status === 'loading') {
    return (
      <div className="container mx-auto px-4 py-12 flex justify-center">
        <div className="animate-pulse">Carregando...</div>
      </div>
    );
  }
  
  if (status === 'unauthenticated' || !session) {
    return null;
  }
  
  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Tutorial Component */}
      <GameTutorial 
        isVisible={showTutorial}
        onComplete={handleTutorialComplete}
        onSkip={handleTutorialSkip}
      />
      
      {/* Help & Tooltips Buttons */}
      <div className="fixed bottom-4 right-4 z-50 flex space-x-3">
        <Button
          variant="secondary"
          className={`rounded-full w-12 h-12 flex items-center justify-center ${
            tooltipsEnabled ? 'bg-blue-500 hover:bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'
          } shadow-lg transition-all duration-300`}
          onClick={toggleTooltips}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </Button>
        
        <Button
          variant="secondary"
          className="rounded-full w-12 h-12 flex items-center justify-center bg-[#3bc37a] hover:bg-[#2bb167] shadow-lg"
          onClick={() => setShowTutorial(true)}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </Button>
      </div>
      
      <div className="mb-6">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-[#ffcc4a] to-[#ff4b4b] bg-clip-text text-transparent">
          Ao Vivo
        </h1>
        <p className="text-gray-400">
          Acompanhe o multiplicador e faça Cash Out no momento certo!
        </p>
      </div>
      
      {/* Mostrar recompensas de nível se disponíveis */}
      {showLevelRewards && levelRewards && (
        <LevelRewards
          xpGained={levelRewards.addedXP}
          pointsGained={levelRewards.addedPoints}
          levelUp={levelRewards.levelUp}
          newLevel={levelRewards.newLevel}
          onClose={() => setShowLevelRewards(false)}
        />
      )}
      
      {/* Mostrar notificação de cash-out automático */}
      {showAutoCashOutNotification && autoCashOutData && (
        <AutoCashOutNotification 
          multiplier={autoCashOutData.multiplier}
          amount={autoCashOutData.amount}
          winAmount={autoCashOutData.winAmount}
          onClose={() => setShowAutoCashOutNotification(false)}
        />
      )}
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Área principal do jogo */}
        <MultiplicadorGame 
          onWin={handleWin}
          tooltipsEnabled={tooltipsEnabled}
        />
        
        {/* Área lateral - cards informativos */}
        <div className="space-y-6">
          {/* Card do Perfil e Saldo */}
          <Card variant="bordered" className="border border-gray-800 bg-[#0f0f0f] shadow-lg">
            <CardHeader className="p-4 border-b border-gray-800/40">
              <CardTitle>Seu Saldo</CardTitle>
              <CardDescription>Informações da sua conta</CardDescription>
            </CardHeader>
            <CardContent className="p-4">
              <div className="mb-6">
                <p className="text-sm text-gray-400 mb-1">Saldo Disponível</p>
                <p className="text-3xl font-bold bg-gradient-to-r from-[#1a86c7] to-[#3bc37a] bg-clip-text text-transparent">
                  R$ {userBalance.toFixed(2)}
                </p>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between gap-2 p-4 border-t border-gray-800/40">
              <Button variant="primary" onClick={() => router.push('/profile')} className="flex-1">
                Ver Perfil
              </Button>
              <Button variant="secondary" onClick={() => router.push('/nova-interface')} className="flex-1">
                Voltar
              </Button>
            </CardFooter>
          </Card>
          
          {/* Card removido - Jogadores Online */}
          
          {/* Níveis e Recompensas */}
          <LevelCard />
          
          {/* Chat de Suporte */}
          <Card variant="bordered" className="border border-gray-800 bg-[#0f0f0f] shadow-lg overflow-hidden">
            <CardHeader className="p-4 border-b border-gray-800/40 cursor-pointer" onClick={() => setShowChat(!showChat)}>
              <div className="flex justify-between items-center">
                <CardTitle className="flex items-center">
                  <span className={`inline-block w-2 h-2 rounded-full mr-2 ${hasNewMessages ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`}></span>
                  Chat de Suporte
                </CardTitle>
                <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 transition-transform ${showChat ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
              <CardDescription>Precisa de ajuda? Fale com nosso suporte!</CardDescription>
            </CardHeader>
            {showChat && (
              <CardContent className="p-0 h-[400px]">
                <ChatSupport 
                  onNewMessage={() => setHasNewMessages(true)}
                  onMessagesRead={() => setHasNewMessages(false)}
                />
              </CardContent>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}