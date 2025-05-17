'use client';

import React, { useRef, useEffect, useState } from 'react';

interface MultiplierChartProps {
  multiplierHistory: number[];
  currentPhase: 'betting' | 'running' | 'ended';
  barWidth?: number;
  maxBars?: number;
}

const MultiplierChart = ({ 
  multiplierHistory, 
  currentPhase,
  barWidth = 12,
  maxBars = 60
}: MultiplierChartProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [historyToShow, setHistoryToShow] = useState<number[]>([]);
  
  // Process multiplier history for display
  useEffect(() => {
    // Verificar se multiplierHistory existe e é um array
    if (!multiplierHistory || !Array.isArray(multiplierHistory) || multiplierHistory.length === 0) return;
    
    // Take only the last maxBars elements
    const lastN = multiplierHistory.slice(-maxBars);
    setHistoryToShow(lastN);
  }, [multiplierHistory, maxBars]);
  
  // Auto-scroll to the latest bars
  useEffect(() => {
    if (containerRef.current && currentPhase === 'running') {
      containerRef.current.scrollLeft = containerRef.current.scrollWidth;
    }
  }, [historyToShow, currentPhase]);
  
  // Calculate the visual height for a multiplier value
  const getBarHeight = (multiplier: number): number => {
    // Escala o multiplicador para uma altura visual (0-1)
    const height = Math.min(multiplier * 0.5, 1); // Max height at multiplier 2.0
    return height;
  };
  
  // Get gradient color based on multiplier value
  const getBarGradient = (multiplier: number): string => {
    if (multiplier >= 1.8) return 'bg-gradient-to-t from-green-600 to-green-400';
    if (multiplier >= 1.5) return 'bg-gradient-to-t from-green-700 to-green-500';
    if (multiplier >= 1.2) return 'bg-gradient-to-t from-blue-600 to-blue-400';
    if (multiplier >= 1.0) return 'bg-gradient-to-t from-blue-700 to-blue-500';
    if (multiplier >= 0.7) return 'bg-gradient-to-t from-yellow-700 to-yellow-500';
    if (multiplier >= 0.5) return 'bg-gradient-to-t from-orange-700 to-orange-500';
    return 'bg-gradient-to-t from-red-700 to-red-500';
  };
  
  // Get opacity for bars based on how recent they are
  const getBarOpacity = (index: number, total: number): number => {
    // More recent bars are more opaque
    return 0.4 + (index / total) * 0.6;
  };
  
  // Get text color for the multiplier label
  const getLabelColor = (multiplier: number): string => {
    if (multiplier >= 1.5) return 'text-green-400';
    if (multiplier >= 1.0) return 'text-blue-400';
    if (multiplier >= 0.5) return 'text-yellow-500';
    return 'text-red-500';
  };
  
  // Determine whether to show label for a specific bar
  const shouldShowLabel = (multiplier: number, index: number, total: number): boolean => {
    // Show label only for the most recent multiplier to avoid clutter in the smaller space
    return index === total - 1;
  };
  
  // Get size for the multiplier label
  const getLabelSize = (multiplier: number): string => {
    if (multiplier >= 1.8) return 'text-xs font-bold';
    return 'text-xs';
  };
  
  // Helper to add visual reference lines
  const ReferenceLines = () => (
    <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
      {/* Linha de referência para 1.5x (75% da altura) */}
      <div className="relative h-[25%]">
        <div className="absolute bottom-0 w-full h-[1px] bg-green-500/20">
          <div className="absolute -top-4 -left-1 px-1 text-[8px] text-green-500/70 bg-black/40 rounded">1.5x</div>
        </div>
      </div>
      
      {/* Linha de referência para 1.0x (50% da altura) */}
      <div className="relative h-[50%]">
        <div className="absolute bottom-0 w-full h-[1px] bg-blue-500/20">
          <div className="absolute -top-4 -left-1 px-1 text-[8px] text-blue-500/70 bg-black/40 rounded">1.0x</div>
        </div>
      </div>
      
      {/* Linha de referência para 0.5x (25% da altura) */}
      <div className="relative h-[75%]">
        <div className="absolute bottom-0 w-full h-[1px] bg-yellow-500/20">
          <div className="absolute -top-4 -left-1 px-1 text-[8px] text-yellow-500/70 bg-black/40 rounded">0.5x</div>
        </div>
      </div>
    </div>
  );
  
  return (
    <div className="absolute inset-0 flex items-end justify-center p-0 overflow-hidden">
      {/* Container principal com máscara de gradiente */}
      <div className="relative w-full h-full flex items-end">
        {/* Máscara de gradiente para dar profundidade */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0a] via-transparent to-transparent opacity-70 z-10"></div>
        
        {/* Linhas de referência */}
        {currentPhase === 'running' && <ReferenceLines />}
        
        {/* Container das barras com rolagem horizontal */}
        <div 
          ref={containerRef}
          className="w-full h-full flex items-end overflow-x-auto scrollbar-hide pb-2 px-2"
          style={{ 
            maskImage: 'linear-gradient(to right, transparent, black 5%, black 95%, transparent)',
            WebkitMaskImage: 'linear-gradient(to right, transparent, black 5%, black 95%, transparent)'
          }}
        >
          {/* Barras do multiplicador */}
          {currentPhase === 'running' && historyToShow.map((multiplier, index) => (
            <div 
              key={index}
              className="h-full flex flex-col justify-end items-center mx-[1px]"
              style={{
                minWidth: `${barWidth}px`,
                transition: 'all 0.3s ease-out',
              }}
            >
              {/* Barra do multiplicador */}
              <div 
                className={`w-full rounded-t ${getBarGradient(multiplier)}`}
                style={{
                  height: `${getBarHeight(multiplier) * 100}%`,
                  opacity: getBarOpacity(index, historyToShow.length),
                  transition: 'height 0.3s ease-out, opacity 0.3s ease-out',
                }}
              >
                {/* Label do multiplicador */}
                {shouldShowLabel(multiplier, index, historyToShow.length) && (
                  <div className="relative w-full -top-4 flex justify-center">
                    <div className={`${getLabelColor(multiplier)} ${getLabelSize(multiplier)} bg-black/60 px-1 rounded-sm backdrop-blur-sm`}>
                      {multiplier.toFixed(2)}x
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
          
          {/* Espaço extra para garantir que as barras estejam visíveis na direita */}
          {currentPhase === 'running' && <div style={{ minWidth: '60px' }}></div>}
        </div>
      </div>
      
      {/* Gradiente inferior para suavizar a transição */}
      <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-[#0a0a0a] to-transparent pointer-events-none"></div>
    </div>
  );
};

export default MultiplierChart;