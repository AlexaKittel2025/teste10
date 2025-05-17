// Métodos de ação do jogo extraídos para melhor organização

import { PlacedBet, MIN_BET_AMOUNT, MAX_BET_AMOUNT, DAILY_BET_LIMIT } from './constants';
import { applyBonusToMultiplier } from '@/lib/bonusService';

interface GameActionsProps {
  roundId: string | null;
  placedBet: PlacedBet | null;
  cashedOut: boolean;
  currentMultiplier: number;
  activeBonus: any;
  betAmount: number;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  setErrorMessage: (message: string | null) => void;
  setCashedOut: (cashedOut: boolean) => void;
  setCashOutMultiplier: (multiplier: number | null) => void;
  setWinAmount: (amount: number | null) => void;
  updateBalance: (newBalance: number) => void;
  refreshBalance: () => void;
  socket: any;
  isAutoBetting: boolean;
  shouldContinueAutoBetting: () => boolean;
  stopAutoBetting: () => void;
  processAutoBetResult: (bet: any, result: any) => void;
  autoBetManager: any;
}

export const createGameActions = ({
  roundId,
  placedBet,
  cashedOut,
  currentMultiplier,
  activeBonus,
  betAmount,
  isLoading,
  setIsLoading,
  setErrorMessage,
  setCashedOut,
  setCashOutMultiplier,
  setWinAmount,
  updateBalance,
  refreshBalance,
  socket,
  isAutoBetting,
  shouldContinueAutoBetting,
  stopAutoBetting,
  processAutoBetResult,
  autoBetManager
}: GameActionsProps) => {

  // Função para colocar uma aposta
  const placeBet = async (amount: number, isAuto: boolean = false) => {
    if (isLoading) return;
    
    if (amount < MIN_BET_AMOUNT || amount > MAX_BET_AMOUNT) {
      setErrorMessage(`Valor da aposta deve estar entre R$ ${MIN_BET_AMOUNT} e R$ ${MAX_BET_AMOUNT}`);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/games/place-bet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          amount, 
          gameType: 'multiplicador', 
          roundId, 
          isAutoBet: isAuto
        }),
      });

      const data = await response.json();

      if (response.ok) {
        console.log('Aposta colocada com sucesso:', data);
        
        // Lidar com recompensas de nível
        if (data.level) {
          console.log('Recompensas de nível:', data.level);
          
          if (data.level.levelUp) {
            console.log(`Level up! Novo nível: ${data.level.newLevel}`);
            // TODO: Mostrar notificação de level up
          }
        }
        
        if (socket && socket.connected) {
          socket.emit('placeBet', { 
            amount, 
            roundId, 
            betId: data.bet?.id || data.betId,
            isAutoBet: isAuto
          });
        }

        refreshBalance();
      } else {
        console.error('Erro ao colocar aposta:', data);
        
        if (data.message.includes('Limite diário de apostas atingido')) {
          const match = data.message.match(/Total hoje: R\$ ([\d,]+\.\d{2})/);
          if (match) {
            const totalToday = match[1];
            setErrorMessage(`Limite diário de apostas atingido. Total hoje: R$ ${totalToday}. Limite: R$ ${DAILY_BET_LIMIT.toFixed(2)}`);
          } else {
            setErrorMessage(data.message);
          }
        } else if (data.message.includes('Aposta já realizada')) {
          setErrorMessage('Você já tem uma aposta nesta rodada');
        } else {
          setErrorMessage(data.message || 'Erro ao colocar aposta');
        }
      }
    } catch (error) {
      console.error('Erro na requisição de aposta:', error);
      setErrorMessage('Erro ao processar aposta. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  // Função para fazer cash out
  const cashOut = async (isAuto: boolean = false) => {
    if (!placedBet || cashedOut || isLoading) {
      console.log('Condições de cashout não atendidas:', {
        placedBet: !!placedBet,
        cashedOut,
        isLoading
      });
      return false;
    }

    console.log('Tentando fazer CashOut...', {
      bet: placedBet,
      multiplier: currentMultiplier
    });

    setIsLoading(true);
    setErrorMessage(null);

    try {
      // Aplicar bônus se houver
      const finalMultiplier = activeBonus ? 
        applyBonusToMultiplier(currentMultiplier, activeBonus) : 
        currentMultiplier;

      const response = await fetch('/api/games/cash-out', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          roundId, 
          multiplier: finalMultiplier,
          isAutoCashOut: isAuto
        }),
      });
      
      const responseData = await response.json();
      
      if (response.ok) {
        console.log('CashOut realizado com sucesso:', responseData);
        
        // Usar o multiplicador final do servidor (que já inclui o bônus)
        const serverFinalMultiplier = responseData.finalMultiplier || finalMultiplier;
        const actualWinnings = responseData.winAmount || (placedBet.amount * serverFinalMultiplier);
        
        setCashedOut(true);
        setCashOutMultiplier(serverFinalMultiplier);
        setWinAmount(actualWinnings);
        updateBalance(responseData.newBalance);
        
        // Lidar com recompensas de nível
        if (responseData.level) {
          console.log('Recompensas de nível:', responseData.level);
          
          if (responseData.level.levelUp) {
            console.log(`Level up! Novo nível: ${responseData.level.newLevel}`);
            // TODO: Mostrar notificação de level up
          }
        }
        
        // Mostrar bônus aplicado
        if (responseData.bonusMultiplier > 0) {
          console.log(`Bônus de nível aplicado: +${(responseData.bonusMultiplier * 100).toFixed(1)}%`);
        }
        
        if (socket && socket.connected) {
          socket.emit('cashOut', { 
            roundId, 
            multiplier: serverFinalMultiplier,
            amount: actualWinnings,
            isAutoCashOut: isAuto
          });
        }
        
        // Se for cash out automático, processar o resultado
        if (isAuto && isAutoBetting) {
          try {
            const autoBetResult = {
              bet: placedBet.amount,
              multiplier: finalMultiplier,
              win: winnings,
              profit: winnings - placedBet.amount,
              isWin: true,
              timestamp: Date.now()
            };
            
            processAutoBetResult(placedBet.amount, autoBetResult);
            
            // Verificar se deve continuar apostando
            if (!shouldContinueAutoBetting()) {
              console.log('Atingido critério de parada após cash out, parando apostas automáticas');
              stopAutoBetting();
            }
          } catch (error) {
            console.error('Erro ao processar resultado do cash out automático:', error);
            stopAutoBetting();
          }
        }
        
        return true;
      } else {
        console.error('Erro ao fazer CashOut:', responseData);
        setErrorMessage(`Erro: ${responseData.message || 'Falha ao realizar CashOut'}`);
        return false;
      }
    } catch (error) {
      console.error('Exceção ao fazer CashOut:', error);
      setErrorMessage('Erro ao fazer CashOut. Tente novamente.');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    placeBet,
    cashOut
  };
};