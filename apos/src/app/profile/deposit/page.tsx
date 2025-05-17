'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Tabs } from '@/components/ui/Tabs';
import PixPayment from '@/components/PixPayment';

export default function DepositPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [activeTab, setActiveTab] = useState<string>('pix');
  
  // Redirecionar para login se não estiver autenticado
  if (status === 'unauthenticated') {
    router.push('/auth/login');
    return null;
  }
  
  // Exibir carregando enquanto verifica a sessão
  if (status === 'loading') {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="text-center text-white">
          <div className="animate-pulse">Carregando...</div>
        </div>
      </div>
    );
  }
  
  const handleComplete = () => {
    router.push('/profile');
  };
  
  const handleCancel = () => {
    router.push('/profile');
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold text-white mb-6">Depósito</h1>
      
      <div className="max-w-2xl mx-auto">
        <Card className="bg-gray-900 border-gray-800 text-white">
          <CardHeader>
            <CardTitle>Escolha o método de pagamento</CardTitle>
          </CardHeader>
          
          <CardContent>
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              items={[
                { value: 'pix', label: 'PIX' },
                { value: 'manual', label: 'Depósito Manual' }
              ]}
              className="mb-6"
            />
            
            {activeTab === 'pix' && (
              <PixPayment 
                onComplete={handleComplete}
                onCancel={handleCancel}
              />
            )}
            
            {activeTab === 'manual' && (
              <div className="text-center py-4">
                <p className="text-gray-400 mb-4">
                  Para realizar um depósito manual, entre em contato com nosso suporte.
                </p>
                
                <Button
                  onClick={() => router.push('/profile')}
                  className="bg-gray-800 hover:bg-gray-700 text-white"
                >
                  Voltar para o perfil
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}