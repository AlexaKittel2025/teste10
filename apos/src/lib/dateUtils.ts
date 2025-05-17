/**
 * Utilitários para formatação e manipulação de datas no aplicativo
 */

/**
 * Formata uma data para exibição em formato brasileiro (DD/MM/YYYY)
 */
export function formatDate(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  return dateObj.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

/**
 * Formata uma data com hora para exibição (DD/MM/YYYY HH:MM)
 */
export function formatDateTime(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  return dateObj.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Formata o tempo relativo (ex: "há 2 minutos", "há 3 horas")
 */
export function formatRelativeTime(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - dateObj.getTime();
  
  // Converter para segundos
  const diffSec = Math.floor(diffMs / 1000);
  
  // Menos de 1 minuto
  if (diffSec < 60) {
    return 'agora mesmo';
  }
  
  // Minutos (menos de 1 hora)
  if (diffSec < 3600) {
    const minutes = Math.floor(diffSec / 60);
    return `há ${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}`;
  }
  
  // Horas (menos de 1 dia)
  if (diffSec < 86400) {
    const hours = Math.floor(diffSec / 3600);
    return `há ${hours} ${hours === 1 ? 'hora' : 'horas'}`;
  }
  
  // Dias (menos de 1 semana)
  if (diffSec < 604800) {
    const days = Math.floor(diffSec / 86400);
    return `há ${days} ${days === 1 ? 'dia' : 'dias'}`;
  }
  
  // Mais de 1 semana, mostrar data completa
  return formatDate(dateObj);
}