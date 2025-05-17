/**
 * Sistema de rate limiting para proteger endpoints contra ataques de força bruta
 */

// Interface para armazenar tentativas por IP
interface RateLimitStore {
  // Mapa de IP para tentativas
  [ip: string]: {
    count: number;
    resetAt: number;
    blockedUntil: number;
  };
}

// Armazenamento das tentativas (em memória)
const store: RateLimitStore = {};

// Configurações padrão
const DEFAULT_WINDOW_MS = 60 * 1000; // 1 minuto
const DEFAULT_MAX_REQUESTS = 5; // 5 tentativas por minuto
const DEFAULT_BLOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutos de bloqueio

// Opções de configuração
export interface RateLimitOptions {
  windowMs?: number; // Duração da janela em ms
  maxRequests?: number; // Máximo de requisições permitidas na janela
  blockDurationMs?: number; // Duração do bloqueio em ms
  skipSuccessfulRequests?: boolean; // Não contar requisições bem-sucedidas
}

/**
 * Limpa registros antigos para evitar vazamento de memória
 */
const cleanupStore = (): void => {
  const now = Date.now();
  
  Object.keys(store).forEach(ip => {
    // Se o bloqueio já expirou e o reset também, remover o IP do store
    if (store[ip].blockedUntil < now && store[ip].resetAt < now) {
      delete store[ip];
    }
  });
};

// Executar limpeza a cada hora
setInterval(cleanupStore, 60 * 60 * 1000);

/**
 * Verifica se um IP está bloqueado
 */
export const isRateLimited = (
  ip: string,
  options: RateLimitOptions = {}
): { limited: boolean; resetAt?: number; remainingRequests?: number } => {
  const {
    windowMs = DEFAULT_WINDOW_MS,
    maxRequests = DEFAULT_MAX_REQUESTS,
    blockDurationMs = DEFAULT_BLOCK_DURATION_MS
  } = options;

  const now = Date.now();
  
  // Inicializar registro para o IP se não existir
  if (!store[ip]) {
    store[ip] = {
      count: 0,
      resetAt: now + windowMs,
      blockedUntil: 0
    };
  }
  
  const record = store[ip];
  
  // Verificar se o IP está bloqueado
  if (record.blockedUntil > now) {
    return { 
      limited: true, 
      resetAt: record.blockedUntil
    };
  }
  
  // Verificar se o período de reset já passou
  if (record.resetAt < now) {
    record.count = 0;
    record.resetAt = now + windowMs;
  }
  
  // Incrementar contador de tentativas
  record.count += 1;
  
  // Verificar se excedeu o limite
  if (record.count > maxRequests) {
    record.blockedUntil = now + blockDurationMs;
    return { 
      limited: true, 
      resetAt: record.blockedUntil
    };
  }
  
  return {
    limited: false,
    remainingRequests: maxRequests - record.count
  };
};

/**
 * Registra uma tentativa bem-sucedida (opcional)
 */
export const registerSuccessfulAttempt = (ip: string): void => {
  // Se o IP estiver no store, remover para não contar contra ele
  if (store[ip]) {
    delete store[ip];
  }
};

/**
 * Middleware de rate limiting para rotas Next.js
 */
export const rateLimitMiddleware = (
  ip: string,
  options: RateLimitOptions = {}
): { success: boolean; message?: string; headers: Record<string, string> } => {
  const result = isRateLimited(ip, options);
  
  const headers: Record<string, string> = {
    'X-RateLimit-Limit': String(options.maxRequests || DEFAULT_MAX_REQUESTS),
    'X-RateLimit-Remaining': String(result.remainingRequests || 0)
  };
  
  if (result.resetAt) {
    headers['X-RateLimit-Reset'] = new Date(result.resetAt).toISOString();
  }
  
  if (result.limited) {
    const retryAfterSeconds = Math.ceil((result.resetAt as number - Date.now()) / 1000);
    headers['Retry-After'] = String(retryAfterSeconds);
    
    return {
      success: false,
      message: `Muitas tentativas. Tente novamente após ${retryAfterSeconds} segundos.`,
      headers
    };
  }
  
  return { success: true, headers };
}; 