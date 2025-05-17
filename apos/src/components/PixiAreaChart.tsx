'use client';

import React, { useRef, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

// Importação dinâmica do PIXI.js para evitar problemas de SSR
const PIXI = dynamic(() => import('pixi.js'), { ssr: false });

// Verificar se estamos em um ambiente onde PIXI.js pode ser usado (browser)
const isClient = typeof window !== 'undefined';

interface PixiAreaChartProps {
  data: number[];
  height?: number;
  width?: number;
  color?: string;
  lineColor?: string;
  className?: string;
  title?: string;
  backgroundColor?: string;
}

const PixiAreaChart: React.FC<PixiAreaChartProps> = ({
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
  const appRef = useRef<PIXI.Application | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Converter valores de cor hexadecimal para decimais
  const hexToDecimal = (hex: string): number => {
    return parseInt(hex.replace('#', ''), 16);
  };
  
  // Extrair componentes RGB de uma cor hexadecimal
  const getRGBA = (hex: string, alpha: number = 1): string => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  useEffect(() => {
    // Verificar se estamos no browser
    if (!isClient) {
      console.log("Pixi.js só pode ser inicializado no browser, pulando renderização no servidor");
      return;
    }
    
    // Validar dados e referência do canvas
    if (!data || data.length === 0 || !canvasRef.current) {
      setError("Dados inválidos ou referência de canvas não encontrada");
      return;
    }
    
    // Limpar instância anterior de PIXI, se existir
    try {
      if (appRef.current) {
        // Verificar se o método destroy existe e é uma função
        if (appRef.current.destroy && typeof appRef.current.destroy === 'function') {
          appRef.current.destroy(true);
        } else if (appRef.current.renderer && typeof appRef.current.renderer.destroy === 'function') {
          // Alternativa: limpar o renderer diretamente se disponível
          appRef.current.renderer.destroy();
        } else {
          // Fallback: pelo menos remover do stage e limpar ticker
          if (appRef.current.stage) {
            appRef.current.stage.removeChildren();
          }
          if (appRef.current.ticker) {
            appRef.current.ticker.stop();
          }
        }
        appRef.current = null;
      }
    } catch (error) {
      console.error("Erro ao limpar recursos anteriores do Pixi.js:", error);
    }
    
    try {
      // Tentar inicializar Pixi.js
      initializePixiChart();
    } catch (error) {
      console.error("Erro ao inicializar Pixi.js, usando fallback com Canvas 2D:", error);
      // Fallback: renderizar com Canvas 2D padrão
      renderCanvasFallback();
    }
    
    // Limpar recursos quando o componente for desmontado
    return () => {
      try {
        if (appRef.current) {
          // Verificar se o método destroy existe e é uma função
          if (appRef.current.destroy && typeof appRef.current.destroy === 'function') {
            appRef.current.destroy(true);
          } else if (appRef.current.renderer && typeof appRef.current.renderer.destroy === 'function') {
            // Alternativa: limpar o renderer diretamente se disponível
            appRef.current.renderer.destroy();
          } else {
            // Fallback: pelo menos remover do stage e limpar ticker
            if (appRef.current.stage) {
              appRef.current.stage.removeChildren();
            }
            if (appRef.current.ticker) {
              appRef.current.ticker.stop();
            }
            console.warn("Método destroy não encontrado em PIXI.Application, usando limpeza alternativa");
          }
          appRef.current = null;
        }
      } catch (error) {
        console.error("Erro ao limpar recursos do Pixi.js:", error);
      }
    };
  }, [data, width, height, color, lineColor, backgroundColor, title, isClient]);
  
  // Função para renderizar o gráfico usando Pixi.js
  const initializePixiChart = () => {
    if (!canvasRef.current) return;
    
    // Criar aplicação PIXI.js usando o elemento canvas como referência
    const app = new PIXI.Application({
      width,
      height,
      view: canvasRef.current,
      antialias: true,
      backgroundAlpha: 0,
      resolution: window.devicePixelRatio || 1,
    });
    
    // Armazenar referência à instância
    appRef.current = app;
    
    // Criar container principal
    const mainContainer = new PIXI.Container();
    app.stage.addChild(mainContainer);
    
    // Criar background com cantos arredondados
    const background = new PIXI.Graphics();
    background.beginFill(hexToDecimal(backgroundColor));
    background.drawRoundedRect(0, 0, width, height, 8);
    background.endFill();
    mainContainer.addChild(background);
    
    // Criar container para o gráfico com margens
    const chartContainer = new PIXI.Container();
    chartContainer.position.set(40, 20);
    mainContainer.addChild(chartContainer);
    
    // Dimensões utilizáveis do gráfico
    const chartWidth = width - 60;
    const chartHeight = height - 40;
    
    // Encontrar valores mínimo e máximo para escalar o gráfico
    const minValue = Math.min(...data) * 0.9;
    const maxValue = Math.max(...data) * 1.1;
    const valueRange = maxValue - minValue;
    
    // Função para converter valores em coordenadas Y
    const getYCoordinate = (value: number): number => {
      const normalizedValue = (value - minValue) / valueRange;
      return chartHeight - (normalizedValue * chartHeight);
    };
    
    // ===== DESENHAR LINHAS DE GRADE =====
    const gridGraphics = new PIXI.Graphics();
    gridGraphics.alpha = 0.2;
    
    // Linhas horizontais
    for (let i = 0; i <= 5; i++) {
      const y = Math.floor(i * (chartHeight / 5));
      
      // Linha pontilhada
      gridGraphics.lineStyle(1, 0xFFFFFF, 0.3);
      for (let x = 0; x < chartWidth; x += 10) {
        gridGraphics.moveTo(x, y);
        gridGraphics.lineTo(x + 5, y);
      }
      
      // Valores no eixo Y
      const value = maxValue - (i * (valueRange / 5));
      const valueText = new PIXI.Text(value.toFixed(1), {
        fontFamily: 'Arial',
        fontSize: 11,
        fill: 0xFFFFFF,
        align: 'right',
      });
      valueText.alpha = 0.8;
      valueText.anchor.set(1, 0.5);
      valueText.position.set(-10, y);
      chartContainer.addChild(valueText);
    }
    
    // Linhas verticais
    for (let i = 0; i <= 5; i++) {
      const x = Math.floor(i * (chartWidth / 5));
      
      // Linha pontilhada
      gridGraphics.lineStyle(1, 0xFFFFFF, 0.3);
      for (let y = 0; y < chartHeight; y += 10) {
        gridGraphics.moveTo(x, y);
        gridGraphics.lineTo(x, y + 5);
      }
    }
    
    chartContainer.addChild(gridGraphics);
    
    // ===== DESENHAR ÁREA =====
    const areaGraphics = new PIXI.Graphics();
    
    // Criar gradiente com canvas HTML
    const canvas = document.createElement('canvas');
    canvas.width = chartWidth;
    canvas.height = chartHeight;
    const ctx = canvas.getContext('2d');
    
    if (ctx) {
      const gradient = ctx.createLinearGradient(0, 0, 0, chartHeight);
      gradient.addColorStop(0, getRGBA(color, 0.6));
      gradient.addColorStop(1, getRGBA(color, 0));
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, chartWidth, chartHeight);
      
      // Criar textura do gradiente
      const gradientTexture = PIXI.Texture.from(canvas);
      
      // Desenhar a área preenchida
      areaGraphics.beginFill(hexToDecimal(color), 0.6);
      
      // Começar o path no canto inferior esquerdo
      areaGraphics.moveTo(0, chartHeight);
      
      // Preparar pontos para o path
      const points: Array<{x: number, y: number}> = [];
      
      data.forEach((value, index) => {
        const x = (index / (data.length - 1)) * chartWidth;
        const y = getYCoordinate(value);
        points.push({ x, y });
      });
      
      // Adicionar pontos ao path
      points.forEach(point => {
        areaGraphics.lineTo(point.x, point.y);
      });
      
      // Fechar o path no canto inferior direito
      areaGraphics.lineTo(chartWidth, chartHeight);
      areaGraphics.lineTo(0, chartHeight);
      areaGraphics.endFill();
      
      // Adicionar à cena com animação fade-in
      areaGraphics.alpha = 0;
      chartContainer.addChild(areaGraphics);
      
      // Animar fade-in da área
      let alphaArea = 0;
      const areaFadeIn = () => {
        if (alphaArea < 1) {
          alphaArea += 0.05;
          areaGraphics.alpha = alphaArea;
          requestAnimationFrame(areaFadeIn);
        }
      };
      
      requestAnimationFrame(areaFadeIn);
      
      // ===== DESENHAR LINHA =====
      const lineGraphics = new PIXI.Graphics();
      lineGraphics.lineStyle(3, hexToDecimal(lineColor), 1);
      
      // Inicialmente invisível
      lineGraphics.alpha = 0;
      chartContainer.addChild(lineGraphics);
      
      // Animar a linha sendo desenhada
      let progress = 0;
      const animateLine = () => {
        if (progress <= 1) {
          lineGraphics.clear();
          lineGraphics.lineStyle(3, hexToDecimal(lineColor), 1);
          
          // Desenhar somente uma parte da linha
          const pointsToDraw = Math.ceil(points.length * progress);
          if (pointsToDraw <= 0) return;
          
          lineGraphics.moveTo(points[0].x, points[0].y);
          
          for (let i = 1; i < pointsToDraw; i++) {
            lineGraphics.lineTo(points[i].x, points[i].y);
          }
          
          // Incrementar progresso
          progress += 0.02;
          lineGraphics.alpha = Math.min(progress * 1.2, 1);
          
          requestAnimationFrame(animateLine);
        } else {
          // Quando a animação da linha terminar, desenhar os pontos
          drawPoints(points);
        }
      };
      
      // Iniciar a animação da linha após um pequeno delay
      setTimeout(() => {
        requestAnimationFrame(animateLine);
      }, 500);
      
      // ===== DESENHAR PONTOS =====
      const drawPoints = (points: Array<{x: number, y: number}>) => {
        const pointsContainer = new PIXI.Container();
        chartContainer.addChild(pointsContainer);
        
        points.forEach((point, index) => {
          const isKeyPoint = index === 0 || index === points.length - 1 || index % 5 === 0;
          
          if (isKeyPoint) {
            // Ponto maior com efeito de brilho
            const haloGraphics = new PIXI.Graphics();
            haloGraphics.beginFill(hexToDecimal(lineColor), 0.3);
            haloGraphics.drawCircle(point.x, point.y, 8);
            haloGraphics.endFill();
            
            // Animação de pulsação para o último ponto
            if (index === points.length - 1) {
              let scale = 1;
              let growing = false;
              
              const animate = () => {
                if (growing) {
                  scale += 0.01;
                  if (scale >= 1.2) growing = false;
                } else {
                  scale -= 0.01;
                  if (scale <= 0.8) growing = true;
                }
                
                haloGraphics.scale.set(scale);
                requestAnimationFrame(animate);
              };
              
              requestAnimationFrame(animate);
            }
            
            pointsContainer.addChild(haloGraphics);
          }
          
          // Ponto central
          const pointGraphics = new PIXI.Graphics();
          pointGraphics.beginFill(hexToDecimal(lineColor));
          pointGraphics.lineStyle(1.5, 0xFFFFFF);
          pointGraphics.drawCircle(point.x, point.y, isKeyPoint ? 4 : 2);
          pointGraphics.endFill();
          
          // Animação para fazer os pontos aparecerem sequencialmente
          pointGraphics.alpha = 0;
          setTimeout(() => {
            let alpha = 0;
            const fadeIn = () => {
              if (alpha < 1) {
                alpha += 0.05;
                pointGraphics.alpha = alpha;
                requestAnimationFrame(fadeIn);
              }
            };
            requestAnimationFrame(fadeIn);
          }, index * 20);
          
          pointsContainer.addChild(pointGraphics);
          
          // Adicionar valor atual no último ponto
          if (index === points.length - 1) {
            const labelContainer = new PIXI.Container();
            labelContainer.position.set(point.x, point.y - 20);
            
            // Fundo do label
            const labelBackground = new PIXI.Graphics();
            labelBackground.beginFill(0x000000, 0.8);
            labelBackground.lineStyle(1.5, hexToDecimal(lineColor));
            labelBackground.drawRoundedRect(-25, -15, 50, 22, 6);
            labelBackground.endFill();
            
            // Texto do label
            const valueText = new PIXI.Text(`${data[data.length - 1].toFixed(1)}x`, {
              fontFamily: 'Arial',
              fontSize: 13,
              fontWeight: 'bold',
              fill: 0xFFFFFF,
              align: 'center',
            });
            valueText.anchor.set(0.5, 0.5);
            
            labelContainer.addChild(labelBackground);
            labelContainer.addChild(valueText);
            
            // Inicialmente invisível
            labelContainer.alpha = 0;
            
            // Animar entrada com delay
            setTimeout(() => {
              let alpha = 0;
              const fadeIn = () => {
                if (alpha < 1) {
                  alpha += 0.05;
                  labelContainer.alpha = alpha;
                  requestAnimationFrame(fadeIn);
                }
              };
              requestAnimationFrame(fadeIn);
            }, points.length * 20 + 200);
            
            pointsContainer.addChild(labelContainer);
          }
        });
      };
      
      // ===== ADICIONAR TÍTULO =====
      const titleText = new PIXI.Text(title, {
        fontFamily: 'Arial',
        fontSize: 14,
        fontWeight: 'bold',
        fill: 0xFFFFFF,
        align: 'center',
      });
      
      titleText.anchor.set(0.5, 0);
      titleText.position.set(width / 2, 5);
      titleText.alpha = 0;
      
      mainContainer.addChild(titleText);
      
      // Animar fade-in do título
      let alphaTitleText = 0;
      const titleFadeIn = () => {
        if (alphaTitleText < 1) {
          alphaTitleText += 0.05;
          titleText.alpha = alphaTitleText;
          requestAnimationFrame(titleFadeIn);
        }
      };
      
      requestAnimationFrame(titleFadeIn);
    }
    
    // Indicar que o componente está pronto
    setIsReady(true);
  };
  
  // Fallback para renderizar o gráfico usando canvas 2D padrão
  const renderCanvasFallback = () => {
    if (!canvasRef.current) return;
    
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) {
      setError("Não foi possível obter contexto 2D do canvas");
      return;
    }
    
    // Limpar o canvas
    ctx.clearRect(0, 0, width, height);
    
    // Desenhar fundo
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, width, height);
    
    // Desenhar título
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(title, width / 2, 15);
    
    // Configurações para o gráfico
    const margin = { top: 30, right: 20, bottom: 20, left: 40 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;
    
    // Encontrar valores mínimo e máximo
    const minValue = Math.min(...data) * 0.9;
    const maxValue = Math.max(...data) * 1.1;
    
    // Função para converter valor em coordenada Y
    const getYCoordinate = (value: number) => {
      return margin.top + chartHeight - ((value - minValue) / (maxValue - minValue) * chartHeight);
    };
    
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
    
    // Desenhar área
    ctx.beginPath();
    ctx.moveTo(margin.left, margin.top + chartHeight);
    
    // Desenhar linha de caminho
    data.forEach((value, index) => {
      const x = margin.left + (index / (data.length - 1)) * chartWidth;
      const y = getYCoordinate(value);
      
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    
    // Completar o caminho para a área
    ctx.lineTo(margin.left + chartWidth, margin.top + chartHeight);
    ctx.lineTo(margin.left, margin.top + chartHeight);
    
    // Preencher área com gradiente
    const gradient = ctx.createLinearGradient(0, margin.top, 0, margin.top + chartHeight);
    gradient.addColorStop(0, getRGBA(color, 0.6));
    gradient.addColorStop(1, getRGBA(color, 0));
    ctx.fillStyle = gradient;
    ctx.fill();
    
    // Desenhar linha
    ctx.beginPath();
    data.forEach((value, index) => {
      const x = margin.left + (index / (data.length - 1)) * chartWidth;
      const y = getYCoordinate(value);
      
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Desenhar pontos chave
    data.forEach((value, index) => {
      const isKeyPoint = index === 0 || index === data.length - 1 || index % 5 === 0;
      if (isKeyPoint) {
        const x = margin.left + (index / (data.length - 1)) * chartWidth;
        const y = getYCoordinate(value);
        
        // Desenhar círculo
        ctx.beginPath();
        ctx.arc(x, y, index === data.length - 1 ? 4 : 3, 0, Math.PI * 2);
        ctx.fillStyle = lineColor;
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.stroke();
        
        // Desenhar valor final
        if (index === data.length - 1) {
          // Fundo do label
          ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
          ctx.beginPath();
          ctx.roundRect(x - 25, y - 25, 50, 22, 6);
          ctx.fill();
          ctx.strokeStyle = lineColor;
          ctx.lineWidth = 1.5;
          ctx.stroke();
          
          // Texto do valor
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 13px Arial';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(`${value.toFixed(1)}x`, x, y - 15);
        }
      }
    });
    
    // Indicar que o componente está pronto
    setIsReady(true);
  };
  
  return (
    <div className={`relative overflow-hidden ${className}`} style={{ width: '100%', height: height }}>
      {isClient && (
        <canvas 
          ref={canvasRef} 
          width={width} 
          height={height} 
          className="w-full h-full"
        />
      )}
      
      {/* Loader durante carregamento */}
      {!isReady && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-50">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-yellow-400"></div>
        </div>
      )}
      
      {/* Exibir erro, se houver */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-70">
          <div className="text-center p-4">
            <div className="text-red-400 mb-2">Erro ao carregar gráfico</div>
            <div className="text-sm text-gray-300">{error}</div>
          </div>
        </div>
      )}
      
      {/* Fallback para SSR */}
      {!isClient && (
        <div className="w-full h-full bg-gray-900 flex items-center justify-center">
          <div className="text-center">
            <div className="text-white text-sm">Carregando gráfico...</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PixiAreaChart; 