'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { useBalance } from '@/lib/BalanceContext';

// Estender o tipo da sessão não é suficiente para incluir balance
// Vamos buscar o saldo do usuário diretamente

export default function Header() {
  const { data: session } = useSession();
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { userBalance } = useBalance();
  
  const handleSignOut = async () => {
    await signOut({ redirect: false });
    router.push('/auth/login');
  };
  
  return (
    <header className="text-white border-b border-gray-800" style={{ backgroundColor: '#080808' }}>
      <div className="container mx-auto px-4 py-5">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-6">
            <Link href="/" className="flex items-center">
              <Image
                src="/images/logo.png"
                alt="Logo"
                width={180}
                height={60}
                style={{ height: 'auto' }}
                priority
              />
            </Link>
            
            <Link 
              href="/version/original" 
              className="text-sm px-3 py-1 rounded-md bg-gradient-to-r from-[#1a86c7] to-[#3bc37a] hover:opacity-90 transition-opacity"
            >
              Tutorial
            </Link>
          </div>
          
          {session ? (
            <div className="relative">
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="flex items-center space-x-3 focus:outline-none"
              >
                <span>{session.user.name || session.user.email}</span>
                <span className="bg-gradient-to-r from-[#1a86c7] to-[#3bc37a] bg-clip-text text-transparent font-bold">
                  R$ {userBalance.toFixed(2)}
                </span>
                <svg className="w-4 h-4 text-[#3bc37a]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                </svg>
              </button>
              
              {isMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-[#121212] rounded-md shadow-lg py-1 z-10 border border-gray-800">
                  <Link href="/profile" className="block px-4 py-2 text-sm hover:bg-[#1e1e1e]">
                    Meu Perfil
                  </Link>
                  
                  <Link href="/friends" className="block px-4 py-2 text-sm hover:bg-[#1e1e1e]">
                    Amigos
                  </Link>
                  
                  <Link href="/transactions" className="block px-4 py-2 text-sm hover:bg-[#1e1e1e]">
                    Transações
                  </Link>
                  
                  {session.user.role === 'ADMIN' && (
                    <Link href="/admin" className="block px-4 py-2 text-sm text-[#3bc37a] hover:bg-[#1e1e1e]">
                      Painel Administrativo
                    </Link>
                  )}
                  
                  <button
                    onClick={handleSignOut}
                    className="block w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-[#1e1e1e]"
                  >
                    Sair
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex space-x-4">
              <Link href="/auth/login" className="btn-primary">
                Entrar
              </Link>
              <Link href="/auth/register" className="btn-secondary">
                Cadastrar
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
} 