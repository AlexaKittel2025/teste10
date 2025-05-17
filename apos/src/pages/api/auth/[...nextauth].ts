import { NextApiRequest, NextApiResponse } from 'next';
import NextAuth, { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { User } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { rateLimitMiddleware, registerSuccessfulAttempt } from '@/lib/rateLimit';

interface ExtendedUser extends User {
  id: string;
  role: string;
  phone?: string | null;
  address?: string | null;
}

// Estender a sessão do NextAuth para incluir nossas propriedades personalizadas
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role: string;
      phone?: string | null;
      address?: string | null;
    }
  }
}

const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Senha', type: 'password' },
      },
      async authorize(credentials, req) {
        try {
          // Obter o IP real do cliente considerando proxy
          const clientIp = 
            req?.headers?.['x-real-ip'] as string || 
            req?.headers?.['x-forwarded-for'] as string || 
            '127.0.0.1';
          
          // Aplicar rate limiting para tentativas de login
          const rateLimit = rateLimitMiddleware(clientIp, {
            windowMs: 60 * 1000, // 1 minuto
            maxRequests: 5, // 5 tentativas por minuto
            blockDurationMs: 15 * 60 * 1000, // 15 minutos de bloqueio
            skipSuccessfulRequests: true
          });
          
          // Se estiver limitado, rejeitar a tentativa
          if (!rateLimit.success) {
            console.error(`Rate limit excedido para IP ${clientIp}: ${rateLimit.message}`);
            throw new Error('Muitas tentativas de login. Tente novamente mais tarde.');
          }
          
          if (!credentials?.email || !credentials?.password) {
            console.error('Email ou senha não fornecidos');
            return null;
          }

          console.log('Buscando usuário no banco de dados');
          const user = await prisma.user.findUnique({
            where: { email: credentials.email },
          });

          console.log('Usuário encontrado?', !!user);
          if (!user) {
            console.error('Usuário não encontrado');
            return null;
          }

          console.log('Informações do usuário:', { 
            id: user.id, 
            email: user.email, 
            role: user.role, 
            passwordLength: user.password?.length || 0 
          });
          
          console.log('Verificando senha');
          const isPasswordValid = await bcrypt.compare(
            credentials.password,
            user.password
          );

          console.log('Senha válida?', isPasswordValid);
          if (!isPasswordValid) {
            console.error('Senha inválida');
            return null;
          }

          // Registrar tentativa bem-sucedida para limpar o rate limit
          registerSuccessfulAttempt(clientIp);
          
          console.log('Login bem-sucedido:', user.id);
          console.log('Retornando usuário para o NextAuth:', { 
            id: user.id, 
            email: user.email, 
            name: user.name, 
            role: user.role 
          });
          
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            phone: user.phone,
            address: user.address
          } as ExtendedUser;
        } catch (error) {
          console.error('ERRO DURANTE AUTENTICAÇÃO:', error);
          return null;
        }
      },
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET || 'green-game-secret-key',
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 dias
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'jwt-secret-key-for-green-game',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        console.log('Criando JWT para usuário:', user.email);
        token.id = (user as ExtendedUser).id;
        token.role = (user as ExtendedUser).role;
        token.phone = (user as ExtendedUser).phone;
        token.address = (user as ExtendedUser).address;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        console.log('Criando sessão para token:', token);
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.phone = token.phone as string | null;
        session.user.address = token.address as string | null;
      }
      return session;
    },
  },
  pages: {
    signIn: '/auth/login',
    error: '/auth/login',
  },
  debug: process.env.NODE_ENV === 'development',
};

// Exportar função para importação em outros arquivos
export { authOptions };

// NextAuth handler com rate limiting adicional
export default async function auth(req: NextApiRequest, res: NextApiResponse) {
  // Verificar se é uma requisição de login
  if (req.method === 'POST' && req.url?.includes('/api/auth/callback/credentials')) {
    // Obter o IP real do cliente considerando proxy
    const clientIp = 
      req.headers['x-real-ip'] as string || 
      req.headers['x-forwarded-for'] as string || 
      '127.0.0.1';
    
    // Aplicar rate limiting para tentativas de login
    const rateLimit = rateLimitMiddleware(clientIp, {
      windowMs: 60 * 1000, // 1 minuto
      maxRequests: 5, // 5 tentativas por minuto
      blockDurationMs: 15 * 60 * 1000, // 15 minutos de bloqueio
    });
    
    // Adicionar headers de rate limiting
    Object.entries(rateLimit.headers).forEach(([key, value]) => {
      res.setHeader(key, value);
    });
    
    // Se estiver limitado, rejeitar a tentativa
    if (!rateLimit.success) {
      return res.status(429).json({ 
        error: 'TooManyRequests',
        message: rateLimit.message 
      });
    }
  }
  
  // Continuar com o fluxo normal do NextAuth
  return await NextAuth(req, res, authOptions);
} 