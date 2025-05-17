'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function OriginalVersion() {
  const router = useRouter();
  
  useEffect(() => {
    // Este uso do window.location é intencional para um redirecionamento completo
    window.location.href = '/tutorial';
  }, []);
  
  return (
    <div className="container mx-auto px-4 py-12 flex justify-center">
      <div className="animate-pulse">Carregando o tutorial...</div>
    </div>
  );
} 