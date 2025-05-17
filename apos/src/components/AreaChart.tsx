import React from 'react';

interface AreaChartProps {
  data: number[];
  height?: number;
  color?: string;
  gridColor?: string;
  lineColor?: string;
  className?: string;
  title?: string;
}

const AreaChart: React.FC<AreaChartProps> = ({
  data,
  height = 200,
  color = "#ffd280",
  gridColor = "#e5e5e5",
  lineColor = "#f7a700",
  className = "",
  title = "Gráfico de Área",
}) => {
  // Validação para evitar erros com dados inválidos
  if (!data || data.length === 0) {
    return (
      <div className={`w-full h-${height} flex items-center justify-center ${className}`}>
        <p className="text-gray-400">Sem dados para exibir</p>
      </div>
    );
  }

  // Encontrar valores mínimo e máximo para escalar o gráfico
  const min = Math.min(...data) * 0.9; // 10% abaixo do mínimo
  const max = Math.max(...data) * 1.1; // 10% acima do máximo
  
  // Calcular a altura utilizável (descontando margens)
  const usableHeight = height - 30; // 15px de margem superior e inferior
  
  // Função para converter valor em posição Y no gráfico
  const getY = (value: number): number => {
    const range = max - min;
    const valueOffset = value - min;
    const percentage = 1 - (valueOffset / range);
    return 15 + (usableHeight * percentage);
  };
  
  // Gerar pontos para o path da linha e área
  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * 100;
    const y = getY(value);
    return { x, y };
  });
  
  // Gerar o path para a linha
  const linePath = points.map((point, i) => 
    `${i === 0 ? 'M' : 'L'}${point.x}%,${point.y}`
  ).join(' ');
  
  // Gerar o path para a área (linha + fechamento para formar a área)
  const areaPath = `${linePath} L100%,${getY(min)} L0%,${getY(min)} Z`;
  
  // Gerar as linhas de grade horizontais
  const gridLines = [];
  const gridValues = [0, 20, 40, 60, 80, 100];
  
  for (let i = 0; i < gridValues.length; i++) {
    const value = min + ((max - min) * i / (gridValues.length - 1));
    const y = getY(value);
    
    gridLines.push(
      <React.Fragment key={`grid-${i}`}>
        <line 
          x1="0%" 
          y1={y} 
          x2="100%" 
          y2={y} 
          stroke={gridColor} 
          strokeWidth="1" 
          strokeDasharray="4,4"
        />
        <text 
          x="-5" 
          y={y} 
          fontSize="11" 
          fill="#ffffff" 
          opacity="0.7"
          dominantBaseline="middle" 
          textAnchor="end"
        >
          {Math.round(value)}
        </text>
      </React.Fragment>
    );
  }
  
  // Gerar linhas de grade verticais
  const verticalLines = [];
  for (let i = 0; i <= 5; i++) {
    const x = (i / 5) * 100;
    verticalLines.push(
      <line 
        key={`v-grid-${i}`}
        x1={`${x}%`} 
        y1="0" 
        x2={`${x}%`} 
        y2={height} 
        stroke={gridColor} 
        strokeWidth="1" 
        strokeDasharray="4,4"
      />
    );
  }
  
  return (
    <div className={`w-full relative ${className}`}>
      <svg 
        width="100%" 
        height={height} 
        viewBox={`-30 0 ${100 + 30} ${height}`} 
        preserveAspectRatio="none"
        style={{ overflow: 'visible' }}
      >
        {/* Definições de filtros e gradientes */}
        <defs>
          {/* Gradiente para a área preenchida */}
          <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={color} stopOpacity="0.6" />
            <stop offset="50%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0.1" />
          </linearGradient>
          
          {/* Filtro de sombra para a linha */}
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          
          {/* Gradiente para a linha */}
          <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={lineColor} stopOpacity="0.7" />
            <stop offset="50%" stopColor={lineColor} stopOpacity="1" />
            <stop offset="100%" stopColor={lineColor} stopOpacity="0.7" />
          </linearGradient>
        </defs>
        
        {/* Título do gráfico */}
        <text 
          x="50%" 
          y="15" 
          fontSize="14" 
          fontWeight="500" 
          fill="#ffffff" 
          textAnchor="middle"
        >
          {title}
        </text>
        
        {/* Linhas de grade */}
        {gridLines}
        {verticalLines}
        
        {/* Área preenchida com sombra suave */}
        <path 
          d={areaPath} 
          fill="url(#areaGradient)" 
          fillOpacity="1"
          filter="drop-shadow(0px 4px 6px rgba(0, 0, 0, 0.1))"
        />
        
        {/* Linha principal com brilho */}
        <path 
          d={linePath} 
          fill="none" 
          stroke="url(#lineGradient)" 
          strokeWidth="3" 
          strokeLinecap="round" 
          strokeLinejoin="round"
          filter="url(#glow)" 
        />
        
        {/* Pontos destacados em cada valor com efeito de pulsação para valores chave */}
        {points.map((point, index) => {
          // Destacar pontos a cada 5 pontos e o primeiro/último
          const isKeyPoint = index === 0 || index === points.length - 1 || index % 5 === 0;
          
          return (
            <g key={`point-${index}`}>
              {isKeyPoint && (
                <circle 
                  cx={`${point.x}%`} 
                  cy={point.y} 
                  r="4" 
                  fill="rgba(255,215,0,0.4)" 
                  className={index === points.length - 1 ? "animate-ping" : ""}
                  style={{ animationDuration: '3s' }}
                />
              )}
              <circle 
                cx={`${point.x}%`} 
                cy={point.y} 
                r={isKeyPoint ? "3.5" : "2"} 
                fill={lineColor} 
                stroke="#fff" 
                strokeWidth="1.5"
                filter={isKeyPoint ? "url(#glow)" : ""}
              />
            </g>
          );
        })}
        
        {/* Valor atual (último ponto) destacado */}
        <g transform={`translate(${points[points.length - 1].x}%, ${points[points.length - 1].y - 15})`}>
          <rect 
            x="-25" 
            y="-15" 
            width="50" 
            height="22" 
            rx="6" 
            fill="rgba(0,0,0,0.8)" 
            stroke={lineColor} 
            strokeWidth="1.5"
            filter="drop-shadow(0px 2px 4px rgba(0, 0, 0, 0.3))" 
          />
          <text 
            x="0" 
            y="-2" 
            fontSize="13" 
            fontWeight="bold" 
            fill="#fff" 
            textAnchor="middle"
          >
            {data[data.length - 1].toFixed(1)}x
          </text>
        </g>
      </svg>
    </div>
  );
};

export default AreaChart; 