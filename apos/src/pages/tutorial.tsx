import { useRouter } from 'next/router';
import React, { ReactNode } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import Image from 'next/image';
import { useRequireAuth } from '@/lib/hooks/useRequireAuth';

export default function TutorialPage() {
  const router = useRouter();
  const { isLoading, isAuthenticated } = useRequireAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
        <div className="text-2xl">Carregando...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  // Componente para cada seção do tutorial
  const TutorialSection = ({ 
    title, 
    description, 
    children,
    icon = "✨"
  }: { 
    title: string; 
    description: string; 
    children: ReactNode;
    icon?: string;
  }) => (
    <Card variant="bordered" className="mb-10 overflow-hidden border-gray-800 hover:border-gray-700 transition-all duration-300 bg-gradient-to-br from-gray-900 to-[#101010]">
      <div className="border-l-4 border-gradient-l h-full">
        <div className="p-8">
          <div className="flex items-center mb-4">
            <div className="w-10 h-10 rounded-full bg-gradient-to-r from-[#1a86c7] to-[#3bc37a] flex items-center justify-center mr-4 shadow-glow">
              <span className="text-white text-lg">{icon}</span>
            </div>
            <div>
              <h3 className="text-xl font-bold bg-gradient-to-r from-[#1a86c7] to-[#3bc37a] bg-clip-text text-transparent">{title}</h3>
              <p className="text-gray-400 text-sm mt-1">{description}</p>
            </div>
          </div>
          <div className="mt-6 pl-2">{children}</div>
        </div>
      </div>
    </Card>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#080808] to-[#101010]">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16 relative">
            <div className="absolute w-40 h-40 bg-[#1a86c7] rounded-full filter blur-[80px] opacity-20 -z-10 top-0 left-1/2 transform -translate-x-1/2"></div>
            <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-[#1a86c7] to-[#3bc37a] bg-clip-text text-transparent">Din-Din</h1>
            <h2 className="text-3xl font-bold mb-6 text-white">A Plataforma de Trading Justo Entre Jogadores</h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">Uma nova experiência de trading gamificado com regras justas e transparentes</p>
          </div>
          
          <TutorialSection 
            title="Introdução à Plataforma" 
            description="A Din-Din é uma plataforma de trading gamificado onde você pode maximizar seus ganhos operando contra outros jogadores."
            icon="🚀"
          >
            <div className="bg-[#111111] p-6 rounded-xl border border-gray-800 shadow-xl backdrop-blur-sm">
              <p className="text-gray-200 mb-5 leading-relaxed">
                A Din-Din é uma plataforma de trading gamificado onde você pode maximizar seus ganhos operando contra outros jogadores — sem uma casa de apostas tentando lucrar com suas perdas.
              </p>
              <p className="text-gray-200 leading-relaxed">
                Ao contrário dos sistemas tradicionais de apostas, a Din-Din não opera contra você. Todo o valor que circula dentro da plataforma é redistribuído entre os próprios jogadores, com a Din-Din atuando apenas como intermediadora da rodada.
              </p>
            </div>
          </TutorialSection>

          <TutorialSection
            title="Modelo Sustentável e Transparente"
            description="A Din-Din não retém os valores das rodadas."
            icon="🔁"
          >
            <div className="bg-[#111111] p-6 rounded-xl border border-gray-800 shadow-xl backdrop-blur-sm">
              <div className="flex flex-col md:flex-row gap-6">
                <div className="bg-[#0d0d0d] p-5 rounded-lg border border-gray-800 md:w-1/2 transform transition-transform hover:scale-[1.02]">
                  <h4 className="font-bold text-[#3bc37a] mb-3 text-lg">Valores na Comunidade</h4>
                  <p className="text-gray-200 leading-relaxed">
                    Todo o montante permanece dentro da comunidade de jogadores, garantindo a sustentabilidade e equilíbrio do sistema.
                  </p>
                </div>
                
                <div className="bg-[#0d0d0d] p-5 rounded-lg border border-gray-800 md:w-1/2 transform transition-transform hover:scale-[1.02]">
                  <h4 className="font-bold text-[#1a86c7] mb-3 text-lg">Transparência Total</h4>
                  <p className="text-gray-200 leading-relaxed">
                    A plataforma recebe apenas 0,03% de comissão sobre entradas vencedoras, valor definido diretamente no código-fonte do sistema — totalmente auditável.
                  </p>
                </div>
              </div>
            </div>
          </TutorialSection>

          <TutorialSection
            title="Sistema de Saldo Dinâmico: Equilíbrio Automático"
            description="A plataforma opera com um sistema de saldo interno fixo de R$ 1.000.000"
          >
            <div className="bg-[#121212] p-5 rounded-lg border border-gray-800">
              <div className="flex items-start mb-4">
                <div className="w-8 h-8 flex items-center justify-center rounded-full bg-gradient-to-r from-[#1a86c7] to-[#3bc37a] mr-3 flex-shrink-0 mt-1">
                  <span className="text-white">📊</span>
                </div>
                <div>
                  <p className="text-gray-300">
                    A plataforma opera com um sistema de saldo interno fixo de R$ 1.000.000, que serve como base para determinar o comportamento dos multiplicadores. O objetivo é manter esse valor constante ao longo do tempo, ajustando o resultado das rodadas de forma natural:
                  </p>
                  
                  <ul className="list-disc pl-6 mt-3 text-gray-300 space-y-2">
                    <li>Quando o saldo estiver acima de R$ 1 milhão, a tendência é que a rodada resulte em multiplicadores acima de 1.00x, devolvendo parte dos valores aos jogadores.</li>
                    <li>Quando o saldo estiver abaixo de R$ 1 milhão, a tendência será um multiplicador abaixo de 1.00x, contribuindo para o reequilíbrio da reserva interna.</li>
                  </ul>
                  
                  <p className="text-gray-300 mt-3">
                    Isso garante um ecossistema justo e autorregulado, onde o valor circula entre os próprios usuários sem favorecimento da plataforma.
                  </p>
                </div>
              </div>
            </div>
          </TutorialSection>

          <TutorialSection
            title="Como Funciona o Jogo?"
            description="Entenda o processo de cada rodada e como são calculados os seus ganhos."
          >
            <div className="bg-[#121212] p-5 rounded-lg border border-gray-800">
              <div className="flex items-start mb-6">
                <div className="w-8 h-8 flex items-center justify-center rounded-full bg-gradient-to-r from-[#1a86c7] to-[#3bc37a] mr-3 flex-shrink-0 mt-1">
                  <span className="text-white">🎮</span>
                </div>
                <div>
                  <ol className="list-decimal pl-6 text-gray-300 space-y-2">
                    <li><strong>Fase de Entrada</strong> – Você tem 5 segundos para entrar na rodada.</li>
                    <li><strong>Início da Rodada</strong> – O multiplicador começa em 1.00x.</li>
                    <li><strong>Variação Dinâmica</strong> – Em até 20 segundos, o multiplicador oscila entre 0.00x e 2.00x, de forma aleatória e regulada pelo sistema de saldo.</li>
                    <li><strong>Resultado da Rodada</strong> – O multiplicador final determina o seu ganho ou perda.</li>
                  </ol>
                  
                  <div className="mt-4">
                    <h4 className="font-medium mb-2">Cálculo dos Ganhos:</h4>
                    <ul className="list-disc pl-6 text-gray-300 space-y-1">
                      <li>Se o multiplicador for maior que 1.00x, você ganha proporcionalmente.</li>
                      <li>Se for menor que 1.00x, você perde uma parte da sua entrada.</li>
                      <li><strong>Ganhos = Valor Apostado × Multiplicador Final</strong></li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </TutorialSection>

          <TutorialSection
            title="Por que escolher a Din-Din?"
            description="Uma plataforma com diferenciais claros e vantagens exclusivas."
          >
            <div className="bg-[#121212] p-5 rounded-lg border border-gray-800">
              <div className="flex items-start">
                <div className="w-8 h-8 flex items-center justify-center rounded-full bg-gradient-to-r from-[#1a86c7] to-[#3bc37a] mr-3 flex-shrink-0 mt-1">
                  <span className="text-white">✅</span>
                </div>
                <div>
                  <ul className="text-gray-300 space-y-3">
                    <li className="flex items-start">
                      <span className="text-[#3bc37a] mr-2 mt-1">⚖️</span>
                      <span><strong>Justiça automatizada:</strong> O sistema não manipula resultados para lucrar com você.</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-[#3bc37a] mr-2 mt-1">🔍</span>
                      <span><strong>Transparência total:</strong> Código-fonte aberto e comissões fixas visíveis.</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-[#3bc37a] mr-2 mt-1">🔄</span>
                      <span><strong>Circularidade financeira:</strong> Os valores são sempre redistribuídos entre os jogadores.</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-[#3bc37a] mr-2 mt-1">💡</span>
                      <span><strong>Sem risco oculto:</strong> Você joga com regras claras e matematicamente equilibradas.</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </TutorialSection>

          <div className="text-center">
            <Button 
              onClick={() => router.push('/')} 
              variant="primary" 
              size="lg"
            >
              Jogar Agora
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}