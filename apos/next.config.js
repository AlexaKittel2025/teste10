/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  swcMinify: true,
  
  // Configurações específicas para WebSocket e Socket.IO
  poweredByHeader: false,
  compress: true,
  
  // Configurações de segurança - forçar HTTPS em produção
  async headers() {
    return [
      {
        // Aplicar esses cabeçalhos para todas as rotas
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin'
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()'
          }
        ]
      }
    ];
  },
  
  // Redirecionamentos
  async redirects() {
    // Redirecionamentos básicos para compatibilidade
    const compatibilityRedirects = [
      {
        source: '/imagens/:path*',
        destination: '/images/:path*',
        permanent: true,
      },
      {
        source: '/app/nova-interface/:path*',
        destination: '/app/new-interface/:path*',
        permanent: false,
      },
      {
        source: '/app/novo-jogo/:path*',
        destination: '/app/new-game/:path*',
        permanent: false,
      },
    ];
    
    // Redirecionamento HTTPS em produção
    const httpsRedirects = process.env.NODE_ENV === 'production'
      ? [
          {
            source: '/:path*',
            has: [
              {
                type: 'host',
                value: 'yourdomain.com',
              },
            ],
            destination: 'https://yourdomain.com/:path*',
            permanent: true,
          },
        ]
      : [];
      
    return [...compatibilityRedirects, ...httpsRedirects];
  },
  
  // Aumentar timeout para operações longas
  serverRuntimeConfig: {
    socketTimeout: 120000, // 120 segundos
    bodySizeLimit: '2mb',  // Aumentar limite para payload
  },
  
  // Configuração para evitar problemas com desenvolvimento
  webpack: (config, { isServer, dev }) => {
    if (!isServer) {
      config.externals = [...(config.externals || []), 'bufferutil', 'utf-8-validate'];
    }
    
    // Otimizações para Socket.IO
    config.resolve.fallback = {
      ...config.resolve.fallback,
      dgram: false,
      fs: false,
      net: false,
      tls: false,
    };
    
    // Configuração de cache para desenvolvimento em WSL/Windows
    if (dev) {
      const path = require('path');
      const cacheDir = path.resolve(process.cwd(), '.next/cache/webpack');
      
      // Simplificando a configuração de cache para evitar erros
      config.cache = {
        type: 'filesystem',
        allowCollectingMemory: true,
        buildDependencies: {
          config: [__filename],
        },
        cacheDirectory: cacheDir,
        name: isServer ? 'server' : 'client',
        // Desativar compressão para minimizar erros de IO
        compression: false
      };
    }
    
    return config;
  },
};

module.exports = nextConfig; 