'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';

interface TutorialStep {
  title: string;
  description: string;
  targetSelector: string;
  position: 'top' | 'right' | 'bottom' | 'left' | 'center';
  action?: () => void;
}

interface GameTutorialProps {
  onComplete: () => void;
  onSkip: () => void;
  isVisible: boolean;
}

const GameTutorial: React.FC<GameTutorialProps> = ({ onComplete, onSkip, isVisible }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [targetElement, setTargetElement] = useState<DOMRect | null>(null);
  
  // Tutorial steps configuration
  const tutorialSteps: TutorialStep[] = [
    {
      title: 'Bem-vindo ao Multiplicador!',
      description: 'Este tutorial rápido vai te ensinar como jogar. Vamos começar!',
      targetSelector: 'body',
      position: 'center'
    },
    {
      title: 'Multiplicador',
      description: 'Aqui você verá o multiplicador atual. Ele varia de 0.0x a 2.0x durante a rodada.',
      targetSelector: '.multiplier-value',
      position: 'top'
    },
    {
      title: 'Fase do Jogo',
      description: 'Este indicador mostra a fase atual do jogo: apostas, jogo em andamento ou finalizado.',
      targetSelector: '.game-phase-indicator',
      position: 'left'
    },
    {
      title: 'Apostas Rápidas',
      description: 'Use estes botões para selecionar rapidamente um valor de aposta.',
      targetSelector: '.quick-bet-buttons',
      position: 'bottom'
    },
    {
      title: 'Botão Cash Out',
      description: 'Quando a rodada começar, clique aqui para garantir seus ganhos. Quanto maior o multiplicador, maior seu ganho!',
      targetSelector: '.cashout-button',
      position: 'top'
    },
    {
      title: 'Seus Ganhos',
      description: 'Seus ganhos potenciais são calculados multiplicando sua aposta pelo multiplicador atual.',
      targetSelector: '.potential-gains',
      position: 'right'
    },
    {
      title: 'Últimos Resultados',
      description: 'Aqui você vê os resultados das rodadas anteriores.',
      targetSelector: '.last-results',
      position: 'top'
    },
    {
      title: 'Pronto para jogar!',
      description: 'Agora você conhece o básico! Faça sua aposta durante a fase de apostas e decida o melhor momento para fazer Cash Out.',
      targetSelector: 'body',
      position: 'center'
    }
  ];

  // Update target element position on step change
  useEffect(() => {
    if (!isVisible) return;
    
    const step = tutorialSteps[currentStep];
    if (step.targetSelector === 'body') {
      setTargetElement(null);
      return;
    }
    
    const element = document.querySelector(step.targetSelector);
    if (element) {
      const rect = element.getBoundingClientRect();
      setTargetElement(rect);
      
      // Highlight the element
      const overlay = document.createElement('div');
      overlay.className = 'tutorial-highlight';
      overlay.style.position = 'absolute';
      overlay.style.top = `${rect.top}px`;
      overlay.style.left = `${rect.left}px`;
      overlay.style.width = `${rect.width}px`;
      overlay.style.height = `${rect.height}px`;
      overlay.style.border = '2px solid #3bc37a';
      overlay.style.borderRadius = '6px';
      overlay.style.boxShadow = '0 0 0 4000px rgba(0, 0, 0, 0.75)';
      overlay.style.zIndex = '9999';
      overlay.style.pointerEvents = 'none';
      
      document.body.appendChild(overlay);
      
      return () => {
        document.body.removeChild(overlay);
      };
    }
  }, [currentStep, isVisible, tutorialSteps]);

  // Handle next/prev navigation
  const handleNext = () => {
    if (currentStep < tutorialSteps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      onComplete();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  // Get tooltip position based on target element and preference
  const getTooltipStyle = () => {
    if (!targetElement || tutorialSteps[currentStep].position === 'center') {
      return {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 10000
      } as React.CSSProperties;
    }

    const { position } = tutorialSteps[currentStep];
    const padding = 20;

    let style: React.CSSProperties = {
      position: 'absolute',
      zIndex: 10000
    };

    switch (position) {
      case 'top':
        style.bottom = `${window.innerHeight - targetElement.top + padding}px`;
        style.left = `${targetElement.left + targetElement.width / 2}px`;
        style.transform = 'translateX(-50%)';
        break;
      case 'right':
        style.left = `${targetElement.right + padding}px`;
        style.top = `${targetElement.top + targetElement.height / 2}px`;
        style.transform = 'translateY(-50%)';
        break;
      case 'bottom':
        style.top = `${targetElement.bottom + padding}px`;
        style.left = `${targetElement.left + targetElement.width / 2}px`;
        style.transform = 'translateX(-50%)';
        break;
      case 'left':
        style.right = `${window.innerWidth - targetElement.left + padding}px`;
        style.top = `${targetElement.top + targetElement.height / 2}px`;
        style.transform = 'translateY(-50%)';
        break;
    }

    return style;
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-[1000] pointer-events-none">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      
      <div 
        className="pointer-events-auto bg-[#121212] rounded-xl p-5 max-w-md border border-green-500/30 shadow-xl animate-fadeIn" 
        style={getTooltipStyle()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xl font-bold text-white">{tutorialSteps[currentStep].title}</h3>
          <span className="text-sm text-gray-400">
            {currentStep + 1} / {tutorialSteps.length}
          </span>
        </div>
        
        <p className="text-gray-300 mb-6">
          {tutorialSteps[currentStep].description}
        </p>
        
        <div className="flex justify-between">
          <div>
            {currentStep > 0 && (
              <Button 
                variant="secondary" 
                className="mr-2"
                onClick={handlePrev}
              >
                Anterior
              </Button>
            )}
            
            <Button 
              variant="primary"
              onClick={handleNext}
            >
              {currentStep < tutorialSteps.length - 1 ? 'Próximo' : 'Concluir'}
            </Button>
          </div>
          
          <Button 
            variant="secondary"
            className="opacity-70 hover:opacity-100"
            onClick={onSkip}
          >
            Pular tutorial
          </Button>
        </div>
      </div>
    </div>
  );
};

export default GameTutorial;