import React from 'react';
import Head from 'next/head';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { GetServerSideProps } from 'next';
import { parseCookies } from 'nookies';

interface MaintenanceProps {
  plannedEndTime: string;
  title: string;
  message: string;
  showButton: boolean;
}

export default function Maintenance({ plannedEndTime, title, message, showButton }: MaintenanceProps) {
  const router = useRouter();
  
  // Calcular tempo restante se fornecido
  const getTimeRemaining = () => {
    if (!plannedEndTime) return null;
    
    const endTime = new Date(plannedEndTime).getTime();
    const now = new Date().getTime();
    const timeRemaining = endTime - now;
    
    if (timeRemaining <= 0) return null;
    
    const hours = Math.floor((timeRemaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${hours}h ${minutes}m`;
  };
  
  const timeLeft = getTimeRemaining();

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-4 sm:p-6 md:p-8">
      <Head>
        <title>Manutenção Programada | Din-Din</title>
        <meta name="description" content="Estamos em manutenção para melhorar sua experiência" />
        <meta name="robots" content="noindex" />
      </Head>
      
      <div className="w-full max-w-md bg-gray-800 rounded-xl overflow-hidden shadow-xl border border-gray-700">
        <div className="px-6 py-8">
          <div className="flex justify-center mb-6">
            <div className="relative w-36 h-36">
              <Image 
                src="/images/logo.png" 
                alt="Logo Din-Din"
                fill
                sizes="144px"
                style={{ objectFit: 'contain' }}
                priority
              />
            </div>
          </div>
          
          <h1 className="text-2xl font-bold text-white text-center mb-2">
            {title || 'Em Manutenção'}
          </h1>
          
          <div className="flex items-center justify-center mb-6">
            <div className="h-1 w-16 bg-gradient-to-r from-blue-500 to-green-500 rounded"></div>
          </div>
          
          <p className="text-gray-300 text-center mb-6">
            {message || 'Estamos realizando manutenção programada para melhorar sua experiência.'}
          </p>
          
          {timeLeft && (
            <div className="mb-6 p-4 bg-gray-700 rounded-lg">
              <p className="text-sm text-gray-300 text-center">
                Previsão de retorno em:
              </p>
              <p className="text-xl font-bold text-white text-center">
                {timeLeft}
              </p>
            </div>
          )}
          
          {showButton && (
            <div className="mt-8 flex justify-center">
              <button
                onClick={() => router.reload()}
                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-green-600 text-white font-medium rounded-lg shadow hover:opacity-90 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                Tentar Novamente
              </button>
            </div>
          )}
        </div>
        
        <div className="px-6 py-4 bg-gray-900 border-t border-gray-700">
          <p className="text-gray-500 text-center text-sm">
            © {new Date().getFullYear()} Din-Din. Todos os direitos reservados.
          </p>
        </div>
      </div>
      
      {/* Informações de contato */}
      <div className="mt-8 text-center">
        <p className="text-gray-400 text-sm">
          Dúvidas? Entre em contato:
          <a 
            href="mailto:suporte@dindin.com" 
            className="text-blue-400 hover:text-blue-300 ml-1"
          >
            suporte@dindin.com
          </a>
        </p>
      </div>
    </div>
  );
}

// Função do lado do servidor para obter propriedades da página
export const getServerSideProps: GetServerSideProps = async (context) => {
  // Verificar se o site está em manutenção pelo cookie
  const cookies = parseCookies(context);
  const isInMaintenance = cookies['maintenance-mode'] === 'true';
  
  // Se não estiver em manutenção, redirecionar para a home
  if (!isInMaintenance) {
    return {
      redirect: {
        destination: '/',
        permanent: false,
      },
    };
  }
  
  // Obter dados de manutenção da API
  let maintenanceData = {
    plannedEndTime: '',
    title: 'Sistema em Manutenção',
    message: 'Estamos trabalhando para melhorar o sistema. Voltaremos em breve!'
  };
  
  try {
    // Tentar obter informações atualizadas do servidor
    const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http';
    const host = context.req.headers.host || 'localhost:3000';
    const res = await fetch(`${protocol}://${host}/api/maintenance/status`);
    
    if (res.ok) {
      const data = await res.json();
      maintenanceData = {
        plannedEndTime: data.plannedEndTime || '',
        title: data.title || 'Sistema em Manutenção',
        message: data.message || 'Estamos trabalhando para melhorar o sistema. Voltaremos em breve!'
      };
    }
  } catch (error) {
    console.error('Erro ao obter dados de manutenção:', error);
    // Em caso de erro, usar valores padrão
  }
  
  return {
    props: {
      plannedEndTime: maintenanceData.plannedEndTime,
      title: maintenanceData.title,
      message: maintenanceData.message,
      showButton: true,
    },
  };
}; 