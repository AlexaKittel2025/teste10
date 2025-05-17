'use client';

import { useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Image from 'next/image';

export default function Register() {
  const [name, setName] = useState('');
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
      console.log('Tentando registrar usuário:', { name, email });
      
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          email,
          password,
        }),
      });

      console.log('Status da resposta:', response.status);
      
      if (response.ok) {
        router.push('/auth/login');
      } else {
        const data = await response.json();
        console.error('Erro retornado pela API:', data);
        setError(data.message || `Erro ao criar conta (${response.status})`);
        
        if (data.error) {
          console.error('Detalhes do erro:', data.error);
        }
      }
    } catch (error) {
      console.error('Exceção durante o registro:', error);
      setError('Ocorreu um erro ao criar a conta');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#121212] flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-[#1E1E1E] p-8 rounded-xl shadow-lg border border-gray-800">
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <Image
              src="/images/logo.png"
              alt="Logo Din-Din"
              width={180}
              height={180}
              className="h-auto"
              priority
            />
          </div>
          <h2 className="text-3xl font-extrabold text-white">
            Crie sua conta
          </h2>
          <p className="mt-2 text-sm text-gray-400">
            Registre-se para começar a jogar
          </p>
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-1">
                Nome
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                className="appearance-none relative block w-full px-3 py-3 border border-gray-700 rounded-lg placeholder-gray-500 text-white bg-gray-800 focus:outline-none focus:ring-[#3bc37a] focus:border-[#3bc37a] focus:z-10 sm:text-sm"
                placeholder="Seu nome"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
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
              {isLoading ? 'Registrando...' : 'Criar conta'}
            </button>
          </div>

          <div className="text-center pt-4 border-t border-gray-800">
            <Link
              href="/auth/login"
              className="font-medium text-[#3bc37a] hover:text-[#4dd38b] transition-colors"
            >
              Já tem uma conta? Entre aqui
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
} 