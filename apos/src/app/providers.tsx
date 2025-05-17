'use client';

import { SessionProvider } from 'next-auth/react';
import { BalanceProvider } from '@/lib/BalanceContext';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <BalanceProvider>
        {children}
      </BalanceProvider>
    </SessionProvider>
  );
} 