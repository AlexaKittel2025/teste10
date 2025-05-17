import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import messagesStore from './messages-store';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  try {
    // Verificar autenticação
    const session = await getServerSession(req, res, authOptions);
    if (!session || !session.user?.id) {
      return res.status(401).json({ message: 'Não autenticado' });
    }

    const userId = session.user.id;
    const isAdmin = session.user.role === 'ADMIN';
    
    // Se for administrador e fornecer userId, limpar mensagens daquele usuário
    const targetUserId = isAdmin && req.body.userId ? req.body.userId : userId;
    
    // Filtrar mensagens para manter apenas mensagens não relacionadas ao usuário alvo
    // Isso efetivamente remove todas as mensagens do usuário
    const filteredMessages = messagesStore.chatMessages.filter(msg => {
      // Se for admin limpando as mensagens de um usuário específico
      if (isAdmin && req.body.userId) {
        // Manter mensagens não relacionadas ao usuário alvo
        return msg.userId !== targetUserId && msg.recipientId !== targetUserId;
      } 
      // Se for usuário normal ou admin limpando suas próprias mensagens
      else {
        // Manter apenas mensagens não relacionadas a este usuário
        return msg.userId !== userId && msg.recipientId !== userId;
      }
    });
    
    // Substituir o armazenamento existente com as mensagens filtradas
    messagesStore.chatMessages = filteredMessages;
    
    // Criar uma nova mensagem de sistema indicando que o chat foi limpo
    const newSystemMessage = {
      id: 'system-' + Date.now(),
      text: "O histórico de mensagens foi limpo.",
      sender: 'SYSTEM',
      userId: targetUserId,
      userName: 'Sistema',
      recipientId: targetUserId,
      timestamp: new Date(),
      read: true,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // Expires in 24 hours
    };
    
    messagesStore.chatMessages.push(newSystemMessage);
    
    // Persistir as alterações
    messagesStore.saveMessages();

    return res.status(200).json({ 
      success: true,
      message: 'Chat limpo com sucesso'
    });
    
  } catch (error) {
    console.error('Erro ao limpar o chat:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Erro ao limpar o chat', 
      error: error instanceof Error ? error.message : 'Erro desconhecido' 
    });
  }
}