import { PrismaClient } from '@prisma/client';

// Usar instância global para evitar múltiplas conexões em ambiente de desenvolvimento
// https://www.prisma.io/docs/guides/performance-and-optimization/connection-management

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

// Verificar se a variável de ambiente DATABASE_URL está definida
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL não está definido no ambiente');
}

// Configuração do Prisma com verificação de ambiente
export const prisma = global.prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
});

// Não armazenar em global em produção para evitar vazamento de memória
if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}

export default prisma;

// Função auxiliar para transações
export const prismaTransaction = async <T>(
  fn: (prisma: PrismaClient) => Promise<T>
): Promise<T> => {
  try {
    // Executar operações no mesmo cliente para simular transações
    return await fn(prisma);
  } catch (error) {
    console.error('Erro na transação:', error);
    throw error;
  }
}; 