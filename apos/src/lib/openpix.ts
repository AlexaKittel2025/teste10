// Implementação da integração com OpenPix para pagamentos PIX
import axios from 'axios';
import { randomUUID } from 'crypto';

const OPENPIX_API_URL = process.env.OPENPIX_API_URL || 'https://api.openpix.com.br/api/v1';
const OPENPIX_APP_ID = process.env.OPENPIX_APP_ID;
const OPENPIX_API_KEY = process.env.OPENPIX_API_KEY;

if (!OPENPIX_API_KEY) {
  console.warn('OPENPIX_API_KEY não configurada no .env.local');
}

interface PixChargeRequest {
  correlationID: string;
  value: number;
  comment: string;
  expiresIn: number; // segundos
  customer?: {
    name: string;
    email?: string;
    phone?: string;
    taxID?: string; // CPF/CNPJ
  };
}

interface PixChargeResponse {
  charge: {
    correlationID: string;
    status: string;
    value: number;
    comment: string;
    qrCodeImage: string;
    brCode: string;
    paymentLinkID: string;
    paymentLinkUrl: string;
    globalID: string;
    expiresAt: string;
  }
}

/**
 * Cria uma cobrança PIX usando a API OpenPix
 */
export async function createPixCharge(
  value: number,
  userId: string,
  userEmail: string,
  userName: string
): Promise<PixChargeResponse | null> {
  if (!OPENPIX_API_KEY) {
    console.error('Chave API OpenPix não configurada');
    return null;
  }

  try {
    const correlationID = `deposit_${userId}_${Date.now()}`;
    
    const payload: PixChargeRequest = {
      correlationID,
      value: Math.round(value * 100), // Converter para centavos
      comment: `Depósito na plataforma - ${userName}`,
      expiresIn: 24 * 60 * 60, // 24 horas em segundos
      customer: {
        name: userName,
        email: userEmail
      }
    };

    const response = await axios.post<PixChargeResponse>(
      `${OPENPIX_API_URL}/charge`,
      payload,
      {
        headers: {
          'Authorization': OPENPIX_API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );

    return response.data;
  } catch (error) {
    console.error('Erro ao criar cobrança PIX:', error);
    return null;
  }
}

/**
 * Verifica o status de uma cobrança PIX
 */
export async function checkPixChargeStatus(correlationID: string): Promise<string> {
  if (!OPENPIX_API_KEY) {
    console.error('Chave API OpenPix não configurada');
    return 'ERROR';
  }

  try {
    const response = await axios.get(
      `${OPENPIX_API_URL}/charge/${correlationID}`,
      {
        headers: {
          'Authorization': OPENPIX_API_KEY
        }
      }
    );

    return response.data.charge.status;
  } catch (error) {
    console.error('Erro ao verificar status da cobrança PIX:', error);
    return 'ERROR';
  }
}

/**
 * Processa payload de webhook de notificação de pagamento
 */
export function processWebhookPayload(payload: any): {
  correlationID: string;
  status: string;
  value: number;
  paidAt?: string;
} {
  // Extrair dados da notificação do payload
  const { charge } = payload;
  
  return {
    correlationID: charge.correlationID,
    status: charge.status,
    value: charge.value / 100, // Converter de centavos para reais
    paidAt: charge.paidAt
  };
}