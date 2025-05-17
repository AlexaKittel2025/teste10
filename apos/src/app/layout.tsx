import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import '@/styles/globals.css'
import { Providers } from './providers'
import Header from '@/components/Header'
import dynamic from 'next/dynamic'

// Importar componentes que só podem ser renderizados no cliente
const MaintenanceBanner = dynamic(() => import('@/components/MaintenanceBanner'), {
  ssr: false,
});

const OnlineStatusTracker = dynamic(() => import('@/components/OnlineStatusTracker'), {
  ssr: false,
});

const inter = Inter({ subsets: ['latin'], display: 'swap' })

export const metadata: Metadata = {
  title: 'din-din',
  description: 'Plataforma financeira digital',
  icons: {
    icon: '/images/favi.png',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <head>
        <meta name="theme-color" content="#080808" />
      </head>
      <body className={inter.className}>
        <Providers>
          {/* Banner de manutenção - mostrado somente quando necessário */}
          <MaintenanceBanner />
          
          {/* Rastreador de status online - invisível */}
          <OnlineStatusTracker />
          
          <Header />
          <main>
            {children}
          </main>
        </Providers>
      </body>
    </html>
  )
} 