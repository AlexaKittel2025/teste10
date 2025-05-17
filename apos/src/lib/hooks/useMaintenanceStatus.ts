"use client";

import { useState, useEffect } from 'react';

// Interface para o status de manutenção
interface MaintenanceStatus {
  enabled: boolean;
  plannedEndTime: string;
  title: string;
  message: string;
}

/**
 * Hook personalizado para verificar o status de manutenção do sistema
 * Apenas para acesso do cliente/usuário - não expõe funcionalidades de admin
 */
export function useMaintenanceStatus() {
  const [status, setStatus] = useState<MaintenanceStatus>({
    enabled: false,
    plannedEndTime: '',
    title: '',
    message: ''
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkMaintenanceStatus = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/maintenance/status');
        
        if (!response.ok) {
          throw new Error('Falha ao obter status de manutenção');
        }
        
        const data = await response.json();
        setStatus(data);
        setError(null);
      } catch (err) {
        console.error('Erro ao verificar status de manutenção:', err);
        setError('Não foi possível verificar o status de manutenção');
      } finally {
        setLoading(false);
      }
    };

    // Verificar status inicial
    checkMaintenanceStatus();
    
    // Configurar verificação periódica a cada 2 minutos
    const intervalId = setInterval(checkMaintenanceStatus, 2 * 60 * 1000);
    
    // Limpar intervalo ao desmontar
    return () => clearInterval(intervalId);
  }, []);

  // Função para calcular o tempo restante de manutenção
  const getTimeRemaining = () => {
    if (!status.plannedEndTime) return null;
    
    const endTime = new Date(status.plannedEndTime).getTime();
    const now = new Date().getTime();
    const timeRemaining = endTime - now;
    
    if (timeRemaining <= 0) return null;
    
    const hours = Math.floor((timeRemaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));
    
    return {
      hours,
      minutes,
      formatted: `${hours}h ${minutes}m`
    };
  };

  return {
    isInMaintenance: status.enabled,
    maintenanceInfo: status,
    timeRemaining: getTimeRemaining(),
    loading,
    error,
  };
} 