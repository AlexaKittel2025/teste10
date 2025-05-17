'use client';

import React, { useState, useEffect, useRef } from 'react';

// Constantes para os limites de jogadores
const MIN_PLAYERS = 42450;
const MAX_PLAYERS = 364000;

/**
 * Componente independente para exibir o número de jogadores online
 * com valores controlados entre MIN_PLAYERS e MAX_PLAYERS
 */
const PlayerCountCard: React.FC = () => {
  // Estado para armazenar a contagem de jogadores
  const [playerCount, setPlayerCount] = useState<number>(() => {
    // Inicializar com um valor aleatório dentro do intervalo permitido
    return MIN_PLAYERS + Math.floor(Math.random() * (MAX_PLAYERS - MIN_PLAYERS) * 0.2);
  });
  
  // Estado para armazenar a última atualização
  const [lastUpdated, setLastUpdated] = useState<string>(new Date().toISOString());
  
  // Referência para a última vez que o playerCount foi atualizado
  const lastUpdateTime = useRef<number>(Date.now());
  
  // Referência para controlar se o componente está montado
  const isMounted = useRef<boolean>(true);
  
  // Atualiza o número de jogadores com base no horário do dia
  const updatePlayerCount = () => {
    if (!isMounted.current) return;
    
    // Verificar se já passou tempo suficiente desde a última atualização (mínimo 3 minutos)
    const now = Date.now();
    const timeSinceLastUpdate = now - lastUpdateTime.current;
    const MIN_UPDATE_INTERVAL = 180000; // 3 minutos
    
    if (timeSinceLastUpdate < MIN_UPDATE_INTERVAL) {
      console.log(`[PLAYERCARD] Muito cedo para atualizar. Passaram apenas ${Math.round(timeSinceLastUpdate/1000)}s`);
      return;
    }
    
    // Determinar se vamos subir ou descer (60% chance de subir, 40% chance de descer)
    const trend = Math.random() > 0.4 ? 1 : -1;
    
    // Calcular uma variação pequena (0.3% a 1.2%)
    const variationPercent = 0.003 + Math.random() * 0.009;
    const variation = playerCount * variationPercent * trend;
    
    // Aplicar a variação
    let newCount = Math.round(playerCount + variation);
    
    // Favorecer tendências com base na hora do dia
    const hour = new Date().getHours();
    
    // Durante horários de pico (18h-23h), favorecer crescimento
    if (hour >= 18 && hour <= 23) {
      if (trend < 0 && Math.random() < 0.7) {
        // 70% de chance de inverter uma tendência negativa
        newCount = Math.round(playerCount + Math.abs(variation));
      } else if (trend > 0) {
        // Aumentar a variação positiva
        newCount = Math.round(playerCount + Math.abs(variation) * 1.5);
      }
    } 
    // Durante horários de baixa (0h-7h), favorecer queda
    else if (hour >= 0 && hour <= 7) {
      if (trend > 0 && Math.random() < 0.7) {
        // 70% de chance de inverter uma tendência positiva
        newCount = Math.round(playerCount - Math.abs(variation));
      } else if (trend < 0) {
        // Aumentar a variação negativa
        newCount = Math.round(playerCount - Math.abs(variation) * 1.2);
      }
    }
    
    // Aplicar limites rígidos
    newCount = Math.max(MIN_PLAYERS, Math.min(MAX_PLAYERS, newCount));
    
    // Atualizar o estado
    console.log(`[PLAYERCARD] Atualizando contagem: ${playerCount} → ${newCount}`);
    setPlayerCount(newCount);
    setLastUpdated(new Date().toISOString());
    lastUpdateTime.current = now;
  };
  
  // Efeito para configurar o intervalo de atualização
  useEffect(() => {
    // Marcar que o componente está montado
    isMounted.current = true;
    
    // Log inicial
    console.log(`[PLAYERCARD] Inicializado com ${playerCount} jogadores`);
    
    // Configurar intervalo para atualizar a cada 4-5 minutos
    const updateInterval = setInterval(() => {
      console.log('[PLAYERCARD] Verificando atualização periódica...');
      updatePlayerCount();
    }, 240000 + Math.floor(Math.random() * 60000)); // 4-5 minutos
    
    // Limpar intervalo quando o componente for desmontado
    return () => {
      isMounted.current = false;
      clearInterval(updateInterval);
      console.log('[PLAYERCARD] Componente desmontado, intervalo limpo.');
    };
  }, []);
  
  // Atualizar o valor quando os valores de hora mudam (para refletir a hora do dia)
  useEffect(() => {
    // Verificar a hora atual a cada 15 minutos
    const hourCheckInterval = setInterval(() => {
      const currentHour = new Date().getHours();
      const storedHour = new Date(lastUpdated).getHours();
      
      // Se a hora mudou, podemos atualizar o valor
      if (currentHour !== storedHour) {
        console.log(`[PLAYERCARD] Hora mudou de ${storedHour} para ${currentHour}, atualizando...`);
        updatePlayerCount();
      }
    }, 900000); // 15 minutos
    
    return () => clearInterval(hourCheckInterval);
  }, [lastUpdated]);
  
  // Formatar o número com separadores de milhar
  const formattedCount = playerCount.toLocaleString('pt-BR');
  
  // Formatar a hora da última atualização
  const formattedTime = new Date(lastUpdated).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit'
  });
  
  return (
    <div className="bg-gradient-to-b from-[#11111f] to-[#0f0f0f] rounded-lg border border-gray-800 p-4 mt-6 shadow-md">
      <div className="flex flex-col">
        <div className="flex items-center mb-2">
          <span className="w-2 h-2 rounded-full bg-green-500 mr-2 animate-pulse"></span>
          <span className="font-medium text-gray-300">Jogadores Online</span>
        </div>
        <div className="text-center my-1">
          <span className="text-[#3bc37a] font-bold text-2xl tracking-tight">
            {formattedCount}
          </span>
        </div>
      </div>
      <div className="mt-3 pt-2 border-t border-gray-800/30">
        <div className="flex justify-between items-center text-xs text-gray-500">
          <span>
            Atualizado às {formattedTime}
          </span>
          <span className="flex items-center text-green-500">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 19V5M5 12l7-7 7 7"/>
            </svg>
            <span className="ml-1">
              Ao vivo
            </span>
          </span>
        </div>
      </div>
    </div>
  );
};

export default PlayerCountCard;