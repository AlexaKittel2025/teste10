import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import messagesStore from './messages-store';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Verificar autenticação
  const session = await getServerSession(req, res, authOptions);

  if (!session || session.user.role !== 'ADMIN') {
    return res.status(401).json({ message: 'Não autorizado' });
  }

  // Verificar método HTTP
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  try {
    // Obter ID do usuário da requisição
    const { userId } = req.body;
    
    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ message: 'ID do usuário não fornecido' });
    }
    
    // Remover todas as mensagens existentes relacionadas a este usuário
    // Filtrar mensagens que não estão relacionadas a este usuário
    const filteredMessages = messagesStore.chatMessages.filter(msg => {
      // Manter mensagens que não envolvem este usuário
      return (msg.userId !== userId && msg.recipientId !== userId);
    });
    
    // Atualizar o array de mensagens
    messagesStore.chatMessages.length = 0;
    messagesStore.chatMessages.push(...filteredMessages);
    
    // Criar mensagem final do sistema
    const finalMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      text: "Este chat foi encerrado. Inicie uma nova conversa se precisar de mais ajuda.",
      sender: 'SYSTEM',
      userId: userId,
      userName: 'Sistema',
      recipientId: userId,
      timestamp: new Date(),
      read: false,
      isFinal: true,
      isImage: false,
      fileInfo: null,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 horas
    };
    
    // Adicionar apenas a mensagem final ao armazenamento
    messagesStore.addMessage(finalMessage);
    
    // Salvar alterações
    messagesStore.saveMessages();
    
    return res.status(200).json({ 
      success: true, 
      message: 'Chat encerrado com sucesso',
      finalMessage
    });
  } catch (error) {
    console.error('Erro ao encerrar chat:', error);
    return res.status(500).json({ message: 'Erro interno do servidor' });
  }
} 