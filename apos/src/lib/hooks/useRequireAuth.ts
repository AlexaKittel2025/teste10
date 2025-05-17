import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

/**
 * Hook para verificar se o usuário está autenticado
 * e redirecioná-lo para a página de login se não estiver
 */
export function useRequireAuth(redirectUrl: string = '/auth/login') {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading') return;
    
    if (status === 'unauthenticated') {
      router.push(redirectUrl);
    }
  }, [status, router, redirectUrl]);

  return { 
    session, 
    status, 
    isAuthenticated: status === 'authenticated',
    isLoading: status === 'loading',
    user: session?.user
  };
}