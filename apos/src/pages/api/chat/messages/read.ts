import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';
import messagesStore from '../messages-store';

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
    
    // Buscar mensagens não lidas direcionadas a este usuário
    const unreadMessages = messagesStore.chatMessages.filter(msg => 
      // Mensagens enviadas para o usuário
      ((msg.recipientId === userId || msg.recipientId === null) &&
      // De admin ou sistema (não usuário)
      msg.sender !== 'USER' &&
      // Não enviada pelo próprio usuário
      msg.userId !== userId &&
      // Não lida ainda
      msg.read === false)
    );
    
    // Atualizar as mensagens como lidas
    if (unreadMessages.length > 0) {
      unreadMessages.forEach(msg => {
        messagesStore.updateMessage(msg.id, { read: true });
      });
      
      // Persistir as alterações
      messagesStore.saveMessages();
      
      return res.status(200).json({ 
        success: true, 
        count: unreadMessages.length,
        message: `${unreadMessages.length} mensagens marcadas como lidas` 
      });
    }
    
    return res.status(200).json({ 
      success: true, 
      count: 0,
      message: 'Nenhuma mensagem não lida encontrada' 
    });
    
  } catch (error) {
    console.error('Erro ao marcar mensagens como lidas:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Erro ao marcar mensagens como lidas', 
      error: error instanceof Error ? error.message : 'Erro desconhecido' 
    });
  }
}