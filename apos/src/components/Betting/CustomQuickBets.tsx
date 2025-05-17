'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/Card';

// Para facilitar debug
console.log("CustomQuickBets component loaded");

interface CustomQuickBetsProps {
  defaultBets: number[];
  userBalance: number;
  onBetsChange: (bets: number[]) => void;
  onSelectBet: (bet: number) => void;
  selectedBet: number | null;
  className?: string;
}

const CustomQuickBets: React.FC<CustomQuickBetsProps> = ({
  defaultBets,
  userBalance,
  onBetsChange,
  onSelectBet,
  selectedBet,
  className = '',
}) => {
  const [showConfig, setShowConfig] = useState(false);
  const [customBets, setCustomBets] = useState<number[]>(defaultBets || [5, 10, 20, 50, 100]);
  const [newBet, setNewBet] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  // Garantir que sempre temos um array válido
  useEffect(() => {
    if (!customBets || !Array.isArray(customBets) || customBets.length === 0) {
      const fallbackBets = defaultBets || [5, 10, 20, 50, 100];
      setCustomBets(fallbackBets);
    }
  }, [customBets, defaultBets]);

  // Carregar configurações salvas quando o componente montar
  useEffect(() => {
    try {
      const savedBets = localStorage.getItem('customQuickBets');
      if (savedBets) {
        const parsedBets = JSON.parse(savedBets);
        if (Array.isArray(parsedBets) && parsedBets.length > 0) {
          setCustomBets(parsedBets);
          onBetsChange(parsedBets);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar apostas rápidas personalizadas:', error);
    }
  }, [onBetsChange]);

  // Salvar configurações quando customBets mudar
  const saveBets = (bets: number[]) => {
    try {
      localStorage.setItem('customQuickBets', JSON.stringify(bets));
      setCustomBets(bets);
      onBetsChange(bets);
      setError(null);
    } catch (error) {
      console.error('Erro ao salvar apostas rápidas personalizadas:', error);
      setError('Erro ao salvar configurações');
    }
  };

  // Adicionar novo valor personalizado
  const addBet = () => {
    if (newBet <= 0) {
      setError('O valor deve ser maior que zero');
      return;
    }

    if (customBets.length >= 5) {
      setError('Você já tem 5 valores configurados. Remova um para adicionar outro.');
      return;
    }

    if (customBets.includes(newBet)) {
      setError('Este valor já está na lista');
      return;
    }

    const newBets = [...customBets, newBet].sort((a, b) => a - b);
    saveBets(newBets);
    setNewBet(0);
  };

  // Remover valor da lista
  const removeBet = (bet: number) => {
    const newBets = customBets.filter(b => b !== bet);
    saveBets(newBets);
  };

  // Restaurar valores padrão
  const restoreDefaults = () => {
    saveBets(defaultBets);
  };

  // Log para debug
  console.log("Renderizando CustomQuickBets:", { showConfig, customBets, selectedBet, userBalance });

  // Garantir segurança antes de renderizar
  const safeBets = Array.isArray(customBets) ? customBets : defaultBets || [5, 10, 20, 50, 100];

  return (
    <div className={className}>
      {!showConfig ? (
        <div className="grid grid-cols-5 gap-2 quick-bet-buttons">
          {safeBets.map((bet, index) => (
            <Button
              key={bet}
              onClick={() => onSelectBet(bet)}
              disabled={bet > userBalance}
              className={`px-4 py-2 rounded-md transition-all duration-200 animate-fadeIn ${
                `delay-${index * 100}` /* Staggered animation */
              } ${
                selectedBet === bet 
                  ? 'bg-gradient-to-r from-[#3bc37a] to-[#2bb167] text-white shadow-md shadow-[#3bc37a]/20' 
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
            className="px-4 py-2 rounded-md transition-all duration-200 animate-fadeIn bg-gray-800 hover:bg-gray-700"
            onClick={() => {
              console.log("Botão de configuração clicado");
              setShowConfig(true);
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
          </Button>
        </div>
      ) : (
        <Card className="bg-gray-900 border-gray-700 animate-fadeIn">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Personalizar Valores de Apostas</CardTitle>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="mb-4 p-2 bg-red-500/10 border border-red-500/30 rounded-md text-red-400 text-sm">
                {error}
              </div>
            )}
            
            <div className="mb-4">
              <p className="text-sm text-gray-400 mb-2">Valores atuais:</p>
              <div className="flex flex-wrap gap-2">
                {customBets.map(bet => (
                  <div key={bet} className="flex items-center bg-gray-800 rounded-md px-2 py-1">
                    <span className="text-sm">R$ {bet.toFixed(2)}</span>
                    <button 
                      className="ml-2 text-gray-400 hover:text-red-400"
                      onClick={() => removeBet(bet)}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
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
                Adicionar
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
              className="text-gray-400 hover:text-white border-gray-700 hover:border-gray-600"
              onClick={restoreDefaults}
            >
              Restaurar Padrões
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
};

export default CustomQuickBets;