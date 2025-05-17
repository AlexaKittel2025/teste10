"use client";

import React, { useEffect, useState } from 'react';
import { useMaintenanceStatus } from '../lib/hooks/useMaintenanceStatus';

interface MaintenanceBannerProps {
  onlyShowUpcoming?: boolean;
}

export default function MaintenanceBanner({ onlyShowUpcoming = false }: MaintenanceBannerProps) {
  const { 
    isInMaintenance, 
    maintenanceInfo, 
    timeRemaining, 
    loading, 
    error 
  } = useMaintenanceStatus();
  
  const [showBanner, setShowBanner] = useState(false);
  const [timeLeft, setTimeLeft] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number>(0);
  
  // Calcular o tempo restante até a manutenção programada
  useEffect(() => {
    if (!maintenanceInfo.plannedEndTime) return;
    
    const endTime = new Date(maintenanceInfo.plannedEndTime).getTime();
    const now = new Date().getTime();
    
    // Se a manutenção está ativa ou programada
    if (isInMaintenance || (endTime > now && !onlyShowUpcoming)) {
      setShowBanner(true);
      
      // Iniciar contador regressivo
      const interval = setInterval(() => {
        const currentTime = new Date().getTime();
        const remaining = endTime - currentTime;
        
        if (remaining <= 0) {
          clearInterval(interval);
          setTimeLeft(null);
          // Manutenção iniciada, verificar com servidor
          setTimeout(() => window.location.reload(), 5000);
          return;
        }
        
        const hours = Math.floor((remaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((remaining % (1000 * 60)) / 1000);
        
        setTimeLeft(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
        setCountdown(remaining);
      }, 1000);
      
      return () => clearInterval(interval);
    } else {
      setShowBanner(false);
    }
  }, [isInMaintenance, maintenanceInfo.plannedEndTime, onlyShowUpcoming]);
  
  // Se estiver carregando ou ocorrer um erro, não mostrar banner
  if (loading || error || !showBanner) {
    return null;
  }
  
  // Manutenção ativa
  if (isInMaintenance && !onlyShowUpcoming) {
    return (
      <div className="bg-red-600 text-white px-4 py-3">
        <div className="container mx-auto flex flex-col md:flex-row items-center justify-between">
          <div className="flex items-center space-x-2">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className="font-medium">
              {maintenanceInfo.title}
            </span>
          </div>
          <div className="mt-2 md:mt-0">
            <span>{maintenanceInfo.message}</span>
            {timeLeft && (
              <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-800 text-white">
                Retorno em: {timeLeft}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }
  
  // Manutenção programada
  if (timeLeft && countdown > 0) {
    // Determinar cor do banner com base no tempo restante
    const bannerColor = 
      countdown < 15 * 60 * 1000 ? "bg-red-500" :  // Menos de 15 minutos
      countdown < 60 * 60 * 1000 ? "bg-orange-500" : // Menos de 1 hora
      "bg-blue-500"; // Mais de 1 hora
    
    return (
      <div className={`${bannerColor} text-white px-4 py-2`}>
        <div className="container mx-auto flex flex-col md:flex-row items-center justify-between">
          <div className="flex items-center space-x-2">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="font-medium">
              Manutenção Programada
            </span>
          </div>
          <div className="mt-2 md:mt-0 text-sm">
            <span>O sistema ficará indisponível em</span>
            <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-white text-gray-800">
              {timeLeft}
            </span>
          </div>
        </div>
      </div>
    );
  }
  
  return null;
} 