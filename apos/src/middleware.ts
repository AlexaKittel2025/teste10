import { NextResponse, NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const url = request.nextUrl.pathname;
  const isProduction = process.env.NODE_ENV === 'production';
  
  // Verificar se o site está em modo de manutenção (através de cookie)
  // Esta abordagem é compatível com o Edge Runtime
  const maintenanceEnabled = request.cookies.get('maintenance-mode')?.value === 'true';
  
  // Se estiver em modo de manutenção, redirecionar para a página de manutenção
  // exceto se já estiver na página de manutenção ou for um administrador
  if (maintenanceEnabled && 
      !url.startsWith('/maintenance') && 
      !url.startsWith('/api/') && 
      !isAdminUser(request)) {
    const maintenanceUrl = new URL('/maintenance', request.url);
    return NextResponse.redirect(maintenanceUrl);
  }

  // Verificar e forçar HTTPS em produção
  if (isProduction && !request.nextUrl.protocol.includes('https')) {
    // Criar URL HTTPS com mesmo caminho e parâmetros
    const httpsUrl = request.nextUrl.clone();
    httpsUrl.protocol = 'https:';
    return NextResponse.redirect(httpsUrl);
  }

  // Adicionar cabeçalhos de segurança básicos para todas as rotas
  // Estes complementam os cabeçalhos definidos em next.config.js
  response.headers.set('X-Frame-Options', 'SAMEORIGIN');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'origin-when-cross-origin');
  
  // Prevenir o vazamento de informações sensíveis
  response.headers.set('Server', '');
  response.headers.delete('X-Powered-By');

  // Configurações específicas para WebSockets
  if (url.startsWith('/api/socket') || url.includes('/socket.io/')) {
    // Aumentar tempos de expiração para WebSockets
    response.headers.set('Connection', 'keep-alive');
    response.headers.set('Keep-Alive', 'timeout=120');
    
    // Desativar cache para evitar problemas
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    response.headers.set('Pragma', 'no-cache');
    
    // Permitir CORS para WebSockets
    const allowedOrigin = process.env.CORS_ALLOWED_ORIGIN || 
                         (isProduction ? 'https://yourdomain.com' : '*');
    response.headers.set('Access-Control-Allow-Origin', allowedOrigin);
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    
    // Se for uma requisição OPTIONS (preflight), retornar 200 OK
    if (request.method === 'OPTIONS') {
      return new NextResponse(null, { status: 200, headers: response.headers });
    }
  }

  return response;
}

// Função para verificar se o usuário atual é um administrador (bypass de manutenção)
function isAdminUser(request: NextRequest): boolean {
  // Verificar através de um cookie especial ou token de administrador
  const adminBypassToken = request.cookies.get('admin-bypass-token')?.value || '';
  const adminToken = process.env.ADMIN_BYPASS_TOKEN || '';
  
  // Importante: Usar comparação de tempo constante para evitar timing attacks
  if (adminBypassToken.length === 0 || adminToken.length === 0) {
    return false;
  }
  
  // Comparação segura (protege contra timing attacks)
  let equal = adminBypassToken.length === adminToken.length;
  let result = 0;
  
  // Implementação manual de comparação de tempo constante
  // Ideal seria usar crypto.timingSafeEqual, mas não está disponível no Edge Runtime
  for (let i = 0; i < adminBypassToken.length && i < adminToken.length; i++) {
    result |= adminBypassToken.charCodeAt(i) ^ adminToken.charCodeAt(i);
  }
  
  return equal && result === 0;
}

// Configurar quais rotas passam pelo middleware
export const config = {
  matcher: [
    // Aplicar a todas as rotas exceto assets estáticos, favicon e robots.txt
    '/((?!_next/static|_next/image|favicon.ico|robots.txt).*)',
  ],
}; 