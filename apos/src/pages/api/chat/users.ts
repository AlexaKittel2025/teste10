import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import { prisma } from '@/lib/prisma';
import messagesStore from './messages-store';

// Acessar o armazenamento compartilhado de mensagens
const { chatMessages, cleanOldMessages } = messagesStore;

// Cache para usuários para evitar processamento repetido
let userCache: any[] = [];
let lastCacheUpdate = 0;
const CACHE_TTL = 30000; // 30 segundos

// Função para obter usuários ativos no chat com otimização
const getActiveUsers = () => {
  const now = Date.now();
  
  // Verificar se podemos usar o cache
  if (userCache.length > 0 && (now - lastCacheUpdate) < CACHE_TTL) {
    return userCache;
  }
  
  // Limpar mensagens antigas antes de processar
  cleanOldMessages();
  
  // Extrair usuários únicos das mensagens
  const userIds = new Map(); // Usar Map para associar IDs a dados completos do usuário
  
  // Primeiro passo: Coletar informações mais completas possíveis de cada usuário
  chatMessages.forEach(msg => {
    if (msg.sender === 'USER' && msg.userId) {
      // Se este usuário ainda não foi processado ou temos dados mais completos agora
      if (!userIds.has(msg.userId) || 
          (!userIds.get(msg.userId).userEmail && msg.userEmail) || 
          (!userIds.get(msg.userId).userName && msg.userName)) {
        
        userIds.set(msg.userId, {
          id: msg.userId,
          name: msg.userName || 'Usuário',
          email: msg.userEmail || 'email@exemplo.com',
          hasNewMessages: false // Será atualizado no segundo passo
        });
      }
    }
  });
  
  // Segundo passo: Verificar mensagens não lidas para cada usuário - otimizado
  // Apenas processar as mensagens mais recentes para melhorar o desempenho
  const recentMessages = chatMessages.slice(-100); // Considerar apenas as últimas 100 mensagens
  
  userIds.forEach((userData, userId) => {
    const hasUnreadMessages = recentMessages.some(
      message => message.sender === 'USER' && 
                 message.userId === userId && 
                 !message.read
    );
    
    userData.hasNewMessages = hasUnreadMessages;
  });
  
  // Converter o Map para um array
  const activeUsers = Array.from(userIds.values());
  
  // Atualizar o cache
  userCache = activeUsers;
  lastCacheUpdate = now;
  
  return activeUsers;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Verificar autenticação
  const session = await getServerSession(req, res, authOptions);

  if (!session) {
    return res.status(401).json({ message: 'Não autorizado' });
  }

  // GET para listar usuários disponíveis para chat
  if (req.method === 'GET') {
    try {
      // Obter usuários ativos das mensagens
      const activeUsers = getActiveUsers();
      
      // Apenas admins podem ver a lista de usuários
      if (session.user.role === 'ADMIN') {
        return res.status(200).json(activeUsers);
      } else {
        // Se não for admin, retornar lista vazia
        return res.status(200).json([]);
      }
    } catch (error) {
      console.error('Erro ao buscar usuários:', error);
      return res.status(500).json({ message: 'Erro ao buscar usuários' });
    }
  }

  return res.status(405).json({ message: 'Método não permitido' });
} 