import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import messagesStore from './messages-store';

// Função auxiliar para gerar ID único
const generateId = () => {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

// Função auxiliar para calcular a data de expiração (24h a partir de agora)
const getExpirationDate = () => {
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24);
  return expiresAt;
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

  // Limpar mensagens antigas
  messagesStore.cleanOldMessages();

  // GET para buscar mensagens 
  if (req.method === 'GET') {
    try {
      // Parâmetro userId para filtrar mensagens específicas de um usuário
      const { userId } = req.query;
      let messagesResult = [];
      
      // Para administradores: retornar todas as mensagens relevantes para o usuário selecionado
      if (userId && typeof userId === 'string' && session.user.role === 'ADMIN') {
        messagesResult = messagesStore.chatMessages.filter(msg => 
          // Mensagens enviadas pelo usuário selecionado
          (msg.userId === userId) ||
          // Mensagens do admin para o usuário selecionado
          (msg.sender === 'ADMIN' && msg.recipientId === userId) ||
          // Mensagens do admin para todos
          (msg.sender === 'ADMIN' && msg.recipientId === null) ||
          // Mensagens do sistema para todos ou para o usuário
          (msg.sender === 'SYSTEM' && (msg.recipientId === null || msg.recipientId === userId))
        );
        
        // Marcar mensagens do usuário como lidas quando o admin visualiza
        messagesStore.chatMessages
          .filter(msg => msg.userId === userId && !msg.read)
          .forEach(msg => {
            messagesStore.updateMessage(msg.id, { read: true });
          });
      } else if (session.user.role === 'USER') {
        // Para usuários: retornar apenas suas próprias mensagens e as destinadas a eles
        messagesResult = messagesStore.chatMessages.filter(msg => 
          // Mensagens enviadas pelo próprio usuário
          (msg.userId === session.user.id) ||
          // Mensagens enviadas para o usuário específico
          (msg.recipientId === session.user.id) ||
          // Mensagens do sistema para todos
          (msg.sender === 'SYSTEM' && msg.recipientId === null)
        );
      } else {
        // Para administradores sem userId especificado, mostrar todas as mensagens
        messagesResult = messagesStore.chatMessages;
      }

      // Ordenar por data/hora
      messagesResult.sort((a, b) => {
        const dateA = new Date(a.timestamp).getTime();
        const dateB = new Date(b.timestamp).getTime();
        return dateA - dateB;
      });
      
      return res.status(200).json(messagesResult);
    } catch (error) {
      console.error('Erro ao buscar mensagens:', error);
      return res.status(500).json({ message: 'Erro ao buscar mensagens' });
    }
  }
  
  // POST para enviar nova mensagem
  if (req.method === 'POST') {
    try {
      const { text, recipientId, isImage, fileInfo, newConversation } = req.body;
      
      if (!text) {
        return res.status(400).json({ message: 'Texto da mensagem é obrigatório' });
      }
      
      // Determinar se é admin ou usuário
      const isAdmin = session.user.role === 'ADMIN';
      
      // Se for uma nova conversa, remover apenas a mensagem final anterior
      if (newConversation && !isAdmin) {
        const userId = session.user.id;
        
        // Filtrar para remover apenas as mensagens finais, preservando o resto do histórico
        const finalMessages = messagesStore.chatMessages.filter(msg => 
          msg.isFinal && (msg.userId === userId || msg.recipientId === userId)
        );
        
        // Para cada mensagem final, removê-la do array de mensagens
        finalMessages.forEach(finalMsg => {
          const index = messagesStore.chatMessages.findIndex(msg => msg.id === finalMsg.id);
          if (index !== -1) {
            messagesStore.chatMessages.splice(index, 1);
          }
        });
        
        // Salvar alterações
        messagesStore.saveMessages();
      }
      
      // Criar mensagem
      const newMessage = {
        id: generateId(),
        text,
        sender: isAdmin ? 'ADMIN' : 'USER',
        userId: session.user.id,
        userName: session.user.name || (isAdmin ? 'Administrador' : 'Usuário'),
        userEmail: session.user.email || 'email@exemplo.com',
        recipientId: isAdmin ? recipientId : null,
        timestamp: new Date(),
        read: false,
        isImage: isImage || false,
        fileInfo: fileInfo || null,
        expiresAt: getExpirationDate()
      };
      
      // Salvar mensagem no armazenamento persistente
      messagesStore.addMessage(newMessage);
      
      return res.status(200).json(newMessage);
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      return res.status(500).json({ message: 'Erro ao enviar mensagem' });
    }
  }
  
  // PUT para marcar mensagens como lidas
  if (req.method === 'PUT') {
    try {
      const { userId } = req.body;
      
      if (!userId) {
        return res.status(400).json({ message: 'ID do usuário é obrigatório' });
      }
      
      // Apenas admins podem marcar mensagens de outros usuários como lidas
      if (session.user.role !== 'ADMIN' && userId !== session.user.id) {
        return res.status(403).json({ message: 'Acesso negado' });
      }
      
      // Filtrar mensagens não lidas do usuário
      const unreadMessages = messagesStore.chatMessages.filter(msg => 
        msg.userId === userId && !msg.read
      );
      
      // Marcar como lidas
      unreadMessages.forEach(msg => {
        messagesStore.updateMessage(msg.id, { read: true });
      });
      
      // Salvar alterações
      messagesStore.saveMessages();
      
      return res.status(200).json({ success: true, readCount: unreadMessages.length });
    } catch (error) {
      console.error('Erro ao marcar mensagens como lidas:', error);
      return res.status(500).json({ message: 'Erro ao marcar mensagens como lidas' });
    }
  }
  
  return res.status(405).json({ message: 'Método não permitido' });
} 