import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { prisma } from './prisma';
import { compare } from 'bcrypt';
import { User } from 'next-auth';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credenciais',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Senha', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const userFromDB = await prisma.user.findUnique({
          where: {
            email: credentials.email
          }
        });

        if (!userFromDB || !userFromDB.password) {
          return null;
        }

        const passwordValid = await compare(credentials.password, userFromDB.password);

        if (!passwordValid) {
          return null;
        }

        // Converter para o formato de User do NextAuth
        const user: User = {
          id: userFromDB.id,
          email: userFromDB.email,
          name: userFromDB.name,
          role: userFromDB.role || 'user',
          phone: userFromDB.phone,
          address: userFromDB.address
        };

        return user;
      }
    })
  ],
  secret: process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET,
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 dias
  },
  jwt: {
    secret: process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET,
    maxAge: 30 * 24 * 60 * 60, // 30 dias
  },
  pages: {
    signIn: '/auth/login',
    error: '/auth/error'
  },
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
        token.role = user.role || 'user';
        token.phone = user.phone;
        token.address = user.address;
      }
      return token;
    },
    session: async ({ session, token }) => {
      if (token) {
        session.user = {
          id: token.id as string,
          email: token.email as string,
          name: token.name as string,
          role: token.role as string,
          phone: token.phone as string | null,
          address: token.address as string | null
        };
      }
      return session;
    }
  },
  debug: process.env.NODE_ENV === 'development'
}; 