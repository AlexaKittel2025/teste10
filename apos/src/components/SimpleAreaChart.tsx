'use client';

import React, { useRef, useEffect } from 'react';

interface SimpleAreaChartProps {
  data: number[];
  height?: number;
  width?: number;
  color?: string;
  lineColor?: string;
  className?: string;
  title?: string;
  backgroundColor?: string;
}

const SimpleAreaChart: React.FC<SimpleAreaChartProps> = ({
  data,
  height = 250,
  width = 800,
  color = "#ffd280",
  lineColor = "#f7a700",
  className = "",
  title = "Multiplicador Atual",
  backgroundColor = "#121212"
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Converter valores hex para rgba
  const getRGBA = (hex: string, alpha: number = 1): string => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  // Função para renderizar o gráfico
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !data || data.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Ajustar o tamanho real do canvas para corresponder às dimensões passadas
    canvas.width = width;
    canvas.height = height;

    // Limpar o canvas
    ctx.clearRect(0, 0, width, height);

    // Desenhar fundo
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, width, height);

    // Configurações para o gráfico
    const margin = { top: 30, right: 20, bottom: 20, left: 40 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    // Encontrar valores mínimo e máximo
    const minValue = Math.min(...data) * 0.95;
    const maxValue = Math.max(...data) * 1.05;

    // Função para converter valor em coordenada Y
    const getY = (value: number) => {
      return margin.top + chartHeight - ((value - minValue) / (maxValue - minValue) * chartHeight);
    };

    // Desenhar título
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(title, width / 2, 20);

    // Desenhar linhas de grade
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.setLineDash([2, 2]);

    // Linhas horizontais
    for (let i = 0; i <= 5; i++) {
      const y = margin.top + (i / 5) * chartHeight;
      ctx.beginPath();
      ctx.moveTo(margin.left, y);
      ctx.lineTo(width - margin.right, y);
      ctx.stroke();

      // Valores no eixo Y
      const value = maxValue - (i / 5) * (maxValue - minValue);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.font = '11px Arial';
      ctx.textAlign = 'right';
      ctx.fillText(value.toFixed(1), margin.left - 5, y);
    }

    // Linhas verticais
    for (let i = 0; i <= 5; i++) {
      const x = margin.left + (i / 5) * chartWidth;
      ctx.beginPath();
      ctx.moveTo(x, margin.top);
      ctx.lineTo(x, margin.top + chartHeight);
      ctx.stroke();
    }

    // Resetar estilo de linha
    ctx.setLineDash([]);

    // Desenhar área preenchida
    ctx.beginPath();
    ctx.moveTo(margin.left, margin.top + chartHeight);

    // Adicionar pontos ao path
    data.forEach((value, index) => {
      const x = margin.left + (index / (data.length - 1)) * chartWidth;
      const y = getY(value);

      if (index === 0) {
        ctx.lineTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    // Fechar o path para criar a área
    ctx.lineTo(margin.left + chartWidth, margin.top + chartHeight);
    ctx.lineTo(margin.left, margin.top + chartHeight);

    // Preencher com gradiente
    const gradient = ctx.createLinearGradient(0, margin.top, 0, margin.top + chartHeight);
    gradient.addColorStop(0, getRGBA(color, 0.7));
    gradient.addColorStop(1, getRGBA(color, 0.1));
    ctx.fillStyle = gradient;
    ctx.fill();

    // Desenhar a linha
    ctx.beginPath();
    data.forEach((value, index) => {
      const x = margin.left + (index / (data.length - 1)) * chartWidth;
      const y = getY(value);

      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Desenhar pontos destacados
    data.forEach((value, index) => {
      const isSpecialPoint = index === 0 || index === data.length - 1 || index % 5 === 0;
      
      if (isSpecialPoint) {
        const x = margin.left + (index / (data.length - 1)) * chartWidth;
        const y = getY(value);
        
        ctx.beginPath();
        ctx.arc(x, y, index === data.length - 1 ? 5 : 3, 0, Math.PI * 2);
        ctx.fillStyle = lineColor;
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        
        // Adicionar rótulo para o último ponto
        if (index === data.length - 1) {
          // Fundo do rótulo
          ctx.fillStyle = 'rgba(0,0,0,0.8)';
          ctx.beginPath();
          ctx.roundRect(x - 25, y - 30, 50, 24, 5);
          ctx.fill();
          ctx.strokeStyle = lineColor;
          ctx.lineWidth = 1;
          ctx.stroke();
          
          // Texto do rótulo
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 12px Arial';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(`${value.toFixed(1)}x`, x, y - 18);
        }
      }
    });
  }, [data, width, height, color, lineColor, backgroundColor, title]);

  return (
    <div className={`relative overflow-hidden ${className}`} style={{ width: '100%', height }}>
      <canvas
        ref={canvasRef}
        className="w-full h-full"
      />
    </div>
  );
};

export default SimpleAreaChart; 