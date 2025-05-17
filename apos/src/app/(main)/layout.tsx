'use client';

import React from 'react';
import Header from '@/components/Header';

export default function NovaInterfaceMainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <Header />
      <main>
        {children}
      </main>
    </>
  );
} 