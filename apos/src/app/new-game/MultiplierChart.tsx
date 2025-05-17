import React, { useEffect, useRef } from 'react';

interface MultiplierChartProps {
  multiplierHistory: number[];
  currentPhase: 'betting' | 'running' | 'ended';
}

const MultiplierChart: React.FC<MultiplierChartProps> = ({ multiplierHistory, currentPhase }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Ajusta a rolagem horizontal para sempre mostrar as barras mais recentes
  useEffect(() => {
    if (containerRef.current && currentPhase === 'running') {
      containerRef.current.scrollLeft = containerRef.current.scrollWidth;
    }
  }, [multiplierHistory, currentPhase]);

  // Não renderiza nada quando não está em fase de jogo ou não há dados
  if (currentPhase !== 'running' || !multiplierHistory || !Array.isArray(multiplierHistory) || multiplierHistory.length === 0) {
    return null;
  }

  // Obtém o valor máximo do multiplicador para escala
  const maxMultiplier = Math.max(...multiplierHistory, 2.0);

  return (
    <div className="absolute inset-0 flex items-end justify-center p-0 overflow-hidden">
      {/* Container principal com máscara de gradiente */}
      <div className="relative w-full h-full flex items-end">
        {/* Máscara de gradiente para dar profundidade */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0a] via-transparent to-transparent opacity-70 z-10"></div>
        
        {/* Container das barras com rolagem horizontal */}
        <div 
          ref={containerRef}
          className="w-full h-full flex items-end overflow-x-auto scrollbar-hide pb-4 px-2"
          style={{ 
            maskImage: 'linear-gradient(to right, transparent, black 5%, black 95%, transparent)',
            WebkitMaskImage: 'linear-gradient(to right, transparent, black 5%, black 95%, transparent)'
          }}
        >
          <div className="flex h-full items-end justify-end w-full">
            {/* Renderiza os últimos 100 pontos do histórico */}
            {multiplierHistory.slice(-100).map((mult, index, arr) => {
              // Calcula o fator de escala para altura baseado no valor máximo
              const heightScale = Math.min((mult / maxMultiplier) * 0.85, 0.85);
              
              // Determina a cor baseada no valor do multiplicador
              const getBarColor = () => {
                if (mult >= 1.8) return 'bg-gradient-to-t from-green-500 to-green-300';
                if (mult >= 1.5) return 'bg-gradient-to-t from-green-500 to-green-400';
                if (mult >= 1.2) return 'bg-gradient-to-t from-blue-500 to-teal-400';
                if (mult >= 1.0) return 'bg-gradient-to-t from-blue-500 to-blue-400';
                if (mult >= 0.7) return 'bg-gradient-to-t from-orange-500 to-yellow-400'; 
                if (mult >= 0.4) return 'bg-gradient-to-t from-orange-600 to-orange-400';
                return 'bg-gradient-to-t from-red-600 to-red-400';
              };
              
              // Calcula opacidade para criar efeito de "desvanecimento" para valores mais antigos
              const opacityFactor = (index / arr.length) * 0.7 + 0.3;
              
              // Determina a largura com base na quantidade de barras (mais barras = mais fino)
              const barWidth = Math.max(3, Math.min(8, 800 / arr.length));
              
              return (
                <div
                  key={index}
                  className={`h-full flex items-end mx-[0.5px] rounded-t ${getBarColor()}`}
                  style={{
                    width: `${barWidth}px`,
                    height: `${Math.max(10, heightScale * 100)}%`,
                    opacity: opacityFactor,
                    boxShadow: mult >= 1.5 ? '0 0 8px rgba(34, 197, 94, 0.5)' : 'none',
                    transition: 'height 0.2s ease-out, opacity 0.2s ease-out',
                  }}
                >
                  {/* Valor do multiplicador no topo da barra para valores altos */}
                  {(index === arr.length - 1 || mult >= 1.5) && (
                    <div 
                      className={`absolute -top-5 left-1/2 transform -translate-x-1/2 text-[10px] font-bold
                        ${mult >= 1.5 ? 'text-green-400' : mult >= 1.0 ? 'text-blue-400' : 'text-orange-400'}`}
                    >
                      {mult.toFixed(2)}x
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        
        {/* Linha de referência em 1.0x */}
        <div className="absolute bottom-[40%] left-0 right-0 h-[1px] bg-white/20 z-5">
          <div className="absolute -top-3 -left-0 bg-black/40 text-[10px] text-white/60 px-1 rounded">
            1.0x
          </div>
        </div>
        
        {/* Linha de referência em 1.5x */}
        <div className="absolute bottom-[60%] left-0 right-0 h-[1px] bg-white/20 z-5">
          <div className="absolute -top-3 -left-0 bg-black/40 text-[10px] text-white/60 px-1 rounded">
            1.5x
          </div>
        </div>
      </div>
    </div>
  );
};

export default MultiplierChart;