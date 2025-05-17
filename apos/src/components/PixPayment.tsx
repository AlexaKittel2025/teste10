'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import axios from 'axios';
import { useBalance } from '@/lib/BalanceContext';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { formatDateTime } from '@/lib/dateUtils';
import { useRequireAuth } from '@/lib/hooks/useRequireAuth';

interface PixPaymentProps {
  onComplete?: () => void;
  onCancel?: () => void;
}

export default function PixPayment({ onComplete, onCancel }: PixPaymentProps) {
  const { session } = useRequireAuth();
  const { refreshBalance } = useBalance();
  
  const [amount, setAmount] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [qrCodeImage, setQrCodeImage] = useState<string | null>(null);
  const [pixCode, setPixCode] = useState<string | null>(null);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [step, setStep] = useState<'form' | 'payment' | 'processing' | 'complete'>('form');
  const [isStatusChecking, setIsStatusChecking] = useState<boolean>(false);

  // Formatar valor
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9]/g, '');
    if (value === '') {
      setAmount(0);
      return;
    }
    setAmount(parseFloat(value) / 100);
  };

  // Formatar valor para exibição
  const formatAmount = (value: number) => {
    return value.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    });
  };

  // Criar transação PIX
  const createPixPayment = async () => {
    if (amount <= 0) {
      setError('Informe um valor válido para depósito');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const { data } = await axios.post('/api/payments/create-pix', {
        amount: amount
      });

      setTransactionId(data.transactionId);
      setQrCodeImage(data.qrCodeImage);
      setPixCode(data.pixCode);
      setPaymentUrl(data.paymentUrl);
      setExpiresAt(new Date(data.expiresAt));
      setStep('payment');
    } catch (error) {
      console.error('Erro ao criar pagamento PIX:', error);
      if (axios.isAxiosError(error) && error.response) {
        setError(error.response.data.message || 'Erro ao processar pagamento');
      } else {
        setError('Erro ao conectar ao servidor. Tente novamente.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Estado para feedback da cópia
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  
  // Copiar código PIX para área de transferência
  const copyPixCode = () => {
    if (!pixCode) return;
    
    navigator.clipboard.writeText(pixCode)
      .then(() => {
        setCopyFeedback('Código PIX copiado!');
        setTimeout(() => setCopyFeedback(null), 2000);
      })
      .catch(err => {
        console.error('Erro ao copiar código PIX:', err);
        setCopyFeedback('Erro ao copiar. Tente novamente.');
        setTimeout(() => setCopyFeedback(null), 2000);
      });
  };

  // Verificar status do pagamento
  const checkPaymentStatus = useCallback(async () => {
    if (!transactionId || isStatusChecking) return;
    
    setIsStatusChecking(true);
    setError(null);
    
    try {
      const { data } = await axios.get(`/api/payments/check-status?transactionId=${transactionId}`);
      
      if (data.status === 'COMPLETED') {
        setStep('complete');
        refreshBalance();
        onComplete?.();
      } else if (data.status === 'EXPIRED') {
        setError('O pagamento expirou. Por favor, gere um novo QR Code.');
        setStep('form');
      }
    } catch (error) {
      console.error('Erro ao verificar status do pagamento:', error);
      if (axios.isAxiosError(error) && error.response) {
        setError(error.response.data.message || 'Erro ao verificar pagamento. Tente novamente.');
      } else {
        setError('Falha na conexão. Verifique sua internet e tente novamente.');
      }
    } finally {
      setIsStatusChecking(false);
    }
  }, [transactionId, isStatusChecking, refreshBalance, onComplete]);

  // Verificar status periodicamente
  useEffect(() => {
    if (step !== 'payment' || !transactionId) return;
    
    const interval = setInterval(() => {
      checkPaymentStatus();
    }, 5000); // Verificar a cada 5 segundos
    
    return () => clearInterval(interval);
  }, [transactionId, step, checkPaymentStatus]);

  // Voltar para o formulário
  const handleCancel = () => {
    setStep('form');
    setTransactionId(null);
    setQrCodeImage(null);
    setPixCode(null);
    onCancel?.();
  };

  return (
    <Card className="w-full max-w-md mx-auto bg-gray-900 text-white border border-gray-800">
      <CardHeader>
        <CardTitle className="text-center text-xl">
          {step === 'form' && 'Depósito via PIX'}
          {step === 'payment' && 'Escaneie o QR Code PIX'}
          {step === 'processing' && 'Processando pagamento...'}
          {step === 'complete' && 'Depósito realizado!'}
        </CardTitle>
      </CardHeader>
      
      <CardContent>
        {step === 'form' && (
          <div className="space-y-4">
            <div className="text-sm text-center text-gray-400 mb-4">
              Informe o valor que deseja depositar
            </div>
            
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="text-gray-400">R$</span>
              </div>
              <Input
                type="text"
                value={amount > 0 ? formatAmount(amount).replace('R$', '').trim() : ''}
                onChange={handleAmountChange}
                className="pl-10 text-lg"
                placeholder="0,00"
                disabled={isSubmitting}
              />
            </div>
            
            {error && (
              <div className="text-red-500 text-sm mt-2">
                {error}
              </div>
            )}
            
            <div className="pt-2">
              <Button
                onClick={createPixPayment}
                disabled={isSubmitting || amount <= 0}
                className="w-full bg-gradient-to-r from-[#1a86c7] to-[#3bc37a] hover:opacity-90"
              >
                {isSubmitting ? 'Gerando QR Code...' : 'Gerar QR Code PIX'}
              </Button>
            </div>
          </div>
        )}
        
        {step === 'payment' && qrCodeImage && (
          <div className="space-y-4">
            <div className="flex flex-col items-center">
              <div className="relative bg-white p-2 rounded-lg mb-4">
                {/* Arrumar caminho do QR code conforme retorno da API */}
                <img 
                  src={qrCodeImage} 
                  alt="QR Code PIX" 
                  className="w-64 h-64"
                />
              </div>
              
              <div className="text-center text-sm text-gray-400 mb-2">
                Escaneie o QR Code acima com o aplicativo do seu banco ou
              </div>
              
              <div className="w-full mb-4">
                <Button
                  onClick={copyPixCode}
                  className="w-full bg-gray-800 hover:bg-gray-700 border border-gray-700 text-white relative"
                >
                  {copyFeedback ? (
                    <span className="text-green-500">{copyFeedback}</span>
                  ) : (
                    "Copiar código PIX Copia e Cola"
                  )}
                </Button>
              </div>
              
              {expiresAt && (
                <div className="text-yellow-500 text-sm mb-4">
                  Expira em: {formatDateTime(expiresAt)}
                </div>
              )}
              
              {paymentUrl && (
                <div className="w-full mb-2">
                  <a 
                    href={paymentUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="block w-full text-center py-2 px-4 bg-blue-600 hover:bg-blue-700 rounded-md text-white"
                  >
                    Abrir link de pagamento
                  </a>
                </div>
              )}
              
              <div className="text-center text-sm text-gray-400 mt-4">
                Após realizar o pagamento, aguarde alguns instantes para a confirmação.
              </div>
              
              {error && (
                <div className="text-red-500 text-sm mt-4 mb-2 bg-red-900 bg-opacity-20 p-2 rounded-md border border-red-900">
                  {error}
                </div>
              )}
              
              <Button
                onClick={checkPaymentStatus}
                disabled={isStatusChecking}
                className="mt-4 bg-[#3bc37a] hover:bg-[#2aa15a] text-white"
              >
                {isStatusChecking ? 'Verificando...' : 'Verificar pagamento'}
              </Button>
            </div>
          </div>
        )}
        
        {step === 'complete' && (
          <div className="text-center space-y-4">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-10 h-10 text-white">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
            
            <h3 className="text-xl font-semibold text-white">
              Pagamento confirmado!
            </h3>
            
            <p className="text-gray-400">
              Seu depósito de {formatAmount(amount)} foi adicionado ao seu saldo.
            </p>
            
            <Button
              onClick={onComplete}
              className="w-full mt-4 bg-gradient-to-r from-[#1a86c7] to-[#3bc37a] hover:opacity-90"
            >
              Continuar
            </Button>
          </div>
        )}
      </CardContent>
      
      {step === 'payment' && (
        <CardFooter className="flex justify-center">
          <Button
            onClick={handleCancel}
            variant="ghost"
            className="text-gray-400 hover:text-white"
          >
            Cancelar
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}