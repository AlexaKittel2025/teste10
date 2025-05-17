'use client';

import React, { useState, useRef, useEffect } from 'react';

interface TooltipProps {
  children: React.ReactNode;
  content: React.ReactNode;
  position?: 'top' | 'right' | 'bottom' | 'left';
  delay?: number;
  className?: string;
}

const Tooltip: React.FC<TooltipProps> = ({
  children,
  content,
  position = 'top',
  delay = 300,
  className = ''
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [coordinates, setCoordinates] = useState({ x: 0, y: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showTooltip = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
      calculatePosition();
    }, delay);
  };

  const hideTooltip = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setIsVisible(false);
    }, 100);
  };

  const calculatePosition = () => {
    if (!triggerRef.current || !tooltipRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    
    let x = 0;
    let y = 0;

    // Calcular o ponto central do botão gatilho
    const triggerCenterX = triggerRect.left + (triggerRect.width / 2);
    
    // Para posição "bottom", colocamos centralizado abaixo do botão
    // Esta é a posição que estamos usando na página do perfil
    x = triggerCenterX; 
    y = triggerRect.bottom + 12; // Espaçamento razoável, não muito distante
    
    // Altura da janela do navegador
    const windowHeight = window.innerHeight;
    const windowWidth = window.innerWidth;
    
    // Verificar e ajustar se o tooltip ficar fora da tela
    const tooltipBottom = y + tooltipRect.height;
    
    // Se o tooltip ultrapassar a parte inferior da tela, mudamos para cima do botão
    if (tooltipBottom > windowHeight - 20) {
      y = triggerRect.top - tooltipRect.height - 12;
    }
    
    // Ajuste horizontal - garantir que o tooltip não fique fora da tela nas laterais
    // Considerando que estamos usando transform: translateX(-50%)
    const effectiveLeft = x - (tooltipRect.width / 2);
    const effectiveRight = x + (tooltipRect.width / 2);
    
    // Se o tooltip ultrapassar a borda esquerda
    if (effectiveLeft < 20) {
      // Ajustar para manter pelo menos 20px de distância da borda esquerda
      x = tooltipRect.width / 2 + 20;
    }
    
    // Se o tooltip ultrapassar a borda direita
    if (effectiveRight > windowWidth - 20) {
      // Ajustar para manter pelo menos 20px de distância da borda direita
      x = windowWidth - tooltipRect.width / 2 - 20;
    }
    
    // Atualizar as coordenadas calculadas
    setCoordinates({ x, y });
  };

  // Add resize handler for responsive tooltips
  useEffect(() => {
    const handleResize = () => {
      if (isVisible) {
        calculatePosition();
      }
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleResize);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [isVisible]);

  return (
    <div 
      className={`inline-block relative ${className}`}
      ref={triggerRef}
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onClick={showTooltip}
      onFocus={showTooltip}
      onBlur={hideTooltip}
    >
      {children}
      
      {isVisible && (
        <div
          ref={tooltipRef}
          className={`fixed z-[1000] bg-gradient-to-b from-[#1a1a1a] to-[#0a0a0a] text-white text-sm py-4 px-5 rounded-md shadow-xl backdrop-blur border border-[#3bc37a]/30 animate-fadeIn`}
          style={{
            left: `${coordinates.x}px`,
            top: `${coordinates.y}px`,
            transform: 'translateX(-50%)', // Centralizar horizontalmente
            width: 'max-content', // Ajustar à largura do conteúdo
            maxWidth: '320px',
          }}
        >
          {/* Arrow do tooltip - detectamos se estamos acima ou abaixo do botão pela posição vertical */}
          <div 
            className={`absolute w-0 h-0 border-[8px] border-transparent ${
              coordinates.y <= triggerRef.current?.getBoundingClientRect().top
                ? 'border-t-[#1a1a1a] bottom-[-16px]'  // Seta para baixo (tooltip acima do botão)
                : 'border-b-[#0a0a0a] top-[-16px]'     // Seta para cima (tooltip abaixo do botão)
            } left-1/2 transform -translate-x-1/2`}
          />
          <div className="leading-6 text-gray-100 font-light whitespace-pre-line">{content}</div>
        </div>
      )}
    </div>
  );
};

export default Tooltip;