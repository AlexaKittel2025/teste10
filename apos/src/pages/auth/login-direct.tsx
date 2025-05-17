'use client';

import { useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import axios from 'axios';

export default function LoginDirect() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      console.log('Tentando fazer login direto com:', { email });
      
      const response = await axios.post('/api/debug/test-login', {
        email,
        password
      });

      console.log('Resultado do login direto:', response.data);

      if (response.data.user) {
        // Salvar dados do usuário no localStorage (alternativa simples ao next-auth)
        localStorage.setItem('user', JSON.stringify(response.data.user));
        router.push('/');
      } else {
        setError('Falha na autenticação');
      }
    } catch (error: any) {
      console.error('Erro ao fazer login direto:', error);
      setError(error.response?.data?.message || 'Ocorreu um erro ao fazer login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-white">
            Login Alternativo (Debug)
          </h2>
          <p className="mt-2 text-center text-sm text-gray-400">
            Use esta página para fazer login diretamente, contornando o NextAuth.
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="email" className="sr-only">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-700 placeholder-gray-500 text-white bg-gray-800 rounded-t-md focus:outline-none focus:ring-green-500 focus:border-green-500 focus:z-10 sm:text-sm"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                Senha
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-700 placeholder-gray-500 text-white bg-gray-800 rounded-b-md focus:outline-none focus:ring-green-500 focus:border-green-500 focus:z-10 sm:text-sm"
                placeholder="Senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <div className="text-red-500 text-sm text-center">{error}</div>
          )}

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed"
            >
              {loading ? 'Entrando...' : 'Entrar (Direto)'}
            </button>
          </div>

          <div className="text-center">
            <Link
              href="/auth/login"
              className="font-medium text-green-500 hover:text-green-400"
            >
              Voltar para login normal
            </Link>
          </div>
          
          <div className="bg-gray-800 p-4 rounded text-sm">
            <p className="text-yellow-400 font-medium mb-2">Credenciais recomendadas:</p>
            <p><span className="text-gray-400">Email:</span> financeiro@pedirsanto.com</p>
            <p><span className="text-gray-400">Senha:</span> sosederbelE@1</p>
          </div>
        </form>
      </div>
    </div>
  );
} 