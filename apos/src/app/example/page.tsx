import React from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import Image from 'next/image';

export default function ExamplePage() {
  return (
    <div className="container mx-auto px-4 py-12">
      <h1 className="text-4xl font-bold mb-8 bg-gradient-to-r from-[#1a86c7] to-[#3bc37a] bg-clip-text text-transparent">
        Bem-vindo ao din-din
      </h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
        <Card variant="bordered">
          <CardHeader>
            <CardTitle>Transações Rápidas</CardTitle>
            <CardDescription>Envie e receba dinheiro instantaneamente.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center py-6">
              <div className="w-16 h-16 rounded-full bg-gradient-to-r from-[#1a86c7] to-[#3bc37a] flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 3 21 3 21 9"></polyline>
                  <polyline points="9 21 3 21 3 15"></polyline>
                  <line x1="21" y1="3" x2="14" y2="10"></line>
                  <line x1="3" y1="21" x2="10" y2="14"></line>
                </svg>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button fullWidth>Transferir Agora</Button>
          </CardFooter>
        </Card>
        
        <Card variant="bordered">
          <CardHeader>
            <CardTitle>Investimentos</CardTitle>
            <CardDescription>Faça seu dinheiro render mais.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center py-6">
              <div className="w-16 h-16 rounded-full bg-gradient-to-r from-[#1a86c7] to-[#3bc37a] flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                </svg>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button fullWidth variant="secondary">Investir</Button>
          </CardFooter>
        </Card>
        
        <Card variant="bordered">
          <CardHeader>
            <CardTitle>Segurança</CardTitle>
            <CardDescription>Proteção para seu dinheiro.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center py-6">
              <div className="w-16 h-16 rounded-full bg-gradient-to-r from-[#1a86c7] to-[#3bc37a] flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button fullWidth variant="secondary">Configurar</Button>
          </CardFooter>
        </Card>
      </div>
      
      <div className="max-w-lg mx-auto mb-12">
        <Card variant="elevated">
          <CardHeader>
            <CardTitle>Suas Finanças, Simplificadas</CardTitle>
            <CardDescription>Acompanhe seus gastos e planeje seu futuro financeiro.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Input 
                label="Nome Completo" 
                placeholder="Digite seu nome" 
                id="name"
              />
              <Input 
                label="Email" 
                type="email" 
                placeholder="seu@email.com" 
                id="email"
              />
              <Input 
                label="Valor" 
                type="number" 
                placeholder="0,00" 
                id="value"
              />
            </div>
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button variant="outline">Cancelar</Button>
            <Button>Confirmar</Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
} 