'use client';

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useFriends } from '@/lib/hooks/useFriends';

/**
 * Componente que rastreia o status online do usuário e atualiza automaticamente
 * Deve ser incluído em um componente de layout de alto nível
 */
export default function OnlineStatusTracker() {
  const { data: session } = useSession();
  const { updateOnlineStatus } = useFriends();
  const router = useRouter();
  
  // Rastrear atividade do usuário e atualizar status online
  useEffect(() => {
    if (!session?.user?.id) return;
    
    // Flag para controlar tentativas de status online
    let isOnlineServiceEnabled = true;
    let failureCount = 0;
    const MAX_FAILURES = 3;
    
    // Função para determinar a página atual
    const getCurrentPage = () => {
      try {
        const path = window.location.pathname;
        
        if (path.includes('/novo-jogo') || path.includes('/new-game')) {
          return 'Jogando';
        } else if (path.includes('/profile')) {
          return 'Perfil';
        } else if (path.includes('/friends')) {
          return 'Lista de Amigos';
        } else {
          return 'Navegando';
        }
      } catch (error) {
        return 'Online';
      }
    };
    
    // Função para definir o usuário como online
    const setOnline = () => {
      // Se o serviço estiver desabilitado após várias falhas, não chamar a API
      if (!isOnlineServiceEnabled) return;
      
      try {
        updateOnlineStatus(true, getCurrentPage())
          .catch(error => {
            failureCount++;
            if (failureCount >= MAX_FAILURES) {
              console.warn('Serviço de status online temporariamente desabilitado após múltiplas falhas');
              isOnlineServiceEnabled = false;
            }
          });
      } catch (error) {
        console.error('Erro ao definir status online:', error);
      }
    };
    
    // Função para definir o usuário como offline
    const setOffline = () => {
      // Se o serviço estiver desabilitado após várias falhas, não chamar a API
      if (!isOnlineServiceEnabled) return;
      
      try {
        updateOnlineStatus(false)
          .catch(error => {
            failureCount++;
            if (failureCount >= MAX_FAILURES) {
              console.warn('Serviço de status online temporariamente desabilitado após múltiplas falhas');
              isOnlineServiceEnabled = false;
            }
          });
      } catch (error) {
        console.error('Erro ao definir status offline:', error);
      }
    };
    
    // Rastrear eventos de visibilidade da página
    const handleVisibilityChange = () => {
      try {
        if (document.visibilityState === 'visible') {
          setOnline();
        } else {
          setOffline();
        }
      } catch (error) {
        console.error('Erro ao rastrear visibilidade:', error);
      }
    };
    
    // Rastrear eventos de navegação
    const handleRouteChange = () => {
      setOnline();
    };
    
    // Definir como online quando o componente montar, usando setTimeout
    // para não bloquear a renderização inicial da página
    setTimeout(() => {
      setOnline();
    }, 1000);
    
    // Adicionar event listeners com try/catch
    try {
      document.addEventListener('visibilitychange', handleVisibilityChange);
      window.addEventListener('beforeunload', setOffline);
    } catch (error) {
      console.error('Erro ao adicionar event listeners:', error);
    }
    
    // Limpar event listeners
    return () => {
      try {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        window.removeEventListener('beforeunload', setOffline);
        
        // Definir como offline quando o componente desmontar
        setOffline();
      } catch (error) {
        console.error('Erro ao limpar event listeners:', error);
      }
    };
  }, [session, updateOnlineStatus]);
  
  // Este componente não renderiza nada
  return null;
}