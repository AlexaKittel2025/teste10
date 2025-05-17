'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/Card';

// Versão simplificada como alternativa
console.log("QuickBetButtons loaded");

interface QuickBetButtonsProps {
  defaultBets: number[];
  userBalance: number;
  onSelectBet: (bet: number) => void;
  selectedBet: number | null;
  className?: string;
}

const QuickBetButtons: React.FC<QuickBetButtonsProps> = ({
  defaultBets,
  userBalance,
  onSelectBet,
  selectedBet,
  className = '',
}) => {
  const [showConfig, setShowConfig] = useState(false);
  const [customBets, setCustomBets] = useState<number[]>(defaultBets);
  const [newBet, setNewBet] = useState<number>(0);
  
  // Carregar configurações salvas quando o componente montar
  useEffect(() => {
    try {
      const savedBets = localStorage.getItem('customQuickBets');
      if (savedBets) {
        setCustomBets(JSON.parse(savedBets));
      }
    } catch (error) {
      console.error('Erro ao carregar apostas rápidas:', error);
    }
  }, []);

  // Salvar configurações
  const saveBets = (bets: number[]) => {
    try {
      localStorage.setItem('customQuickBets', JSON.stringify(bets));
      setCustomBets(bets);
      setShowConfig(false);
    } catch (error) {
      console.error('Erro ao salvar apostas rápidas:', error);
    }
  };

  // Adicionar novo valor
  const addBet = () => {
    if (newBet <= 0 || customBets.length >= 5 || customBets.includes(newBet)) {
      return;
    }
    
    const newBets = [...customBets, newBet].sort((a, b) => a - b);
    saveBets(newBets);
    setNewBet(0);
  };

  // Remover valor
  const removeBet = (bet: number) => {
    const newBets = customBets.filter(b => b !== bet);
    saveBets(newBets);
  };

  // Restaurar valores padrão
  const restoreDefaults = () => {
    saveBets(defaultBets);
  };

  return (
    <div className={className}>
      {!showConfig ? (
        <div className="grid grid-cols-5 gap-2">
          {customBets.map((bet, index) => (
            <Button
              key={bet}
              onClick={() => onSelectBet(bet)}
              disabled={bet > userBalance}
              className={`px-4 py-2 rounded-md transition-all duration-200 ${
                selectedBet === bet 
                  ? 'bg-gradient-to-r from-[#3bc37a] to-[#2bb167] text-white' 
                  : bet > userBalance
                    ? 'bg-gray-800/50 text-gray-500 cursor-not-allowed'
                    : 'bg-[#1e1e1e] text-white hover:bg-[#1a86c7]/20 border border-gray-800'
              }`}
            >
              R$ {bet.toFixed(2)}
            </Button>
          ))}
          
          <Button
            variant="secondary"
            className="px-4 py-2 rounded-md bg-gray-800 hover:bg-gray-700"
            onClick={() => setShowConfig(true)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
          </Button>
        </div>
      ) : (
        <Card className="bg-gray-900 border-gray-700">
          <CardHeader>
            <CardTitle className="text-lg">Configurar Valores</CardTitle>
          </CardHeader>
          
          <CardContent>
            <div className="mb-4">
              <div className="flex flex-wrap gap-2">
                {customBets.map(bet => (
                  <div key={bet} className="flex items-center bg-gray-800 rounded-md px-2 py-1">
                    <span className="text-sm">R$ {bet.toFixed(2)}</span>
                    <button 
                      className="ml-2 text-gray-400 hover:text-red-400"
                      onClick={() => removeBet(bet)}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="Novo valor"
                min={1}
                step={5}
                className="bg-gray-800 border-gray-700"
                value={newBet || ''}
                onChange={e => setNewBet(Number(e.target.value))}
              />
              <Button 
                variant="primary"
                onClick={addBet}
                disabled={newBet <= 0 || customBets.length >= 5}
              >
                +
              </Button>
            </div>
          </CardContent>
          
          <CardFooter className="flex justify-between">
            <Button 
              variant="secondary"
              className="bg-gray-800 hover:bg-gray-700"
              onClick={() => setShowConfig(false)}
            >
              Voltar
            </Button>
            <Button 
              variant="outline"
              className="text-gray-400 hover:text-white border-gray-700"
              onClick={restoreDefaults}
            >
              Padrões
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
};

export default QuickBetButtons;