'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Image from 'next/image';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      console.log('Tentando fazer login com:', { email, passwordLength: password.length });
      
      const result = await signIn('credentials', {
        redirect: false,
        email,
        password,
      });

      console.log('Resultado do login:', result);

      if (result?.error) {
        setError(`Falha na autenticação: ${result.error}`);
        console.error('Erro de autenticação detalhado:', result);
      } else {
        router.push('/');
      }
    } catch (error) {
      console.error('Erro ao fazer login:', error);
      setError('Ocorreu um erro ao fazer login. Verifique o console para mais detalhes.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#121212] flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-[#1E1E1E] p-8 rounded-xl shadow-lg border border-gray-800">
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <div style={{ position: 'relative', width: '180px', height: '180px' }}>
              <Image
                src="/images/logo.png"
                alt="Logo Din-Din"
                fill
                sizes="180px"
                style={{ objectFit: 'contain' }}
                priority
              />
            </div>
          </div>
          <h2 className="text-3xl font-extrabold text-white">
            Bem-vindo ao Din-Din
          </h2>
          <p className="mt-2 text-sm text-gray-400">
            Entre com sua conta para continuar
          </p>
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                className="appearance-none relative block w-full px-3 py-3 border border-gray-700 rounded-lg placeholder-gray-500 text-white bg-gray-800 focus:outline-none focus:ring-[#3bc37a] focus:border-[#3bc37a] focus:z-10 sm:text-sm"
                placeholder="Seu email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1">
                Senha
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="appearance-none relative block w-full px-3 py-3 border border-gray-700 rounded-lg placeholder-gray-500 text-white bg-gray-800 focus:outline-none focus:ring-[#3bc37a] focus:border-[#3bc37a] focus:z-10 sm:text-sm"
                placeholder="Sua senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-900/30 border border-red-800 text-red-400 text-sm">
              {error}
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-gradient-to-r from-[#1a86c7] to-[#3bc37a] hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#3bc37a] disabled:opacity-70 disabled:cursor-not-allowed transition-all duration-200"
            >
              {isLoading ? 'Entrando...' : 'Entrar'}
            </button>
          </div>

          <div className="text-center pt-4 border-t border-gray-800">
            <Link
              href="/auth/register"
              className="font-medium text-[#3bc37a] hover:text-[#4dd38b] transition-colors"
            >
              Não tem uma conta? Registre-se
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
} 