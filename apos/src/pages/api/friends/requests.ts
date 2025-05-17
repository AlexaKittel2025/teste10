import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '../auth/[...nextauth]';
import { getPendingFriendRequests, respondToFriendRequest } from '@/lib/friendsService';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const session = await getServerSession(req, res, authOptions);

  if (!session) {
    return res.status(401).json({ message: 'Não autorizado. Faça login primeiro.' });
  }

  const userId = session.user.id;

  // GET - Listar solicitações pendentes
  if (req.method === 'GET') {
    try {
      const pendingRequests = await getPendingFriendRequests(userId);
      return res.status(200).json(pendingRequests);
    } catch (error) {
      console.error('Erro ao buscar solicitações de amizade:', error);
      return res.status(500).json({ message: 'Erro ao buscar solicitações de amizade.' });
    }
  }

  // POST - Responder a uma solicitação de amizade (aceitar ou rejeitar)
  if (req.method === 'POST') {
    try {
      const { friendshipId, action } = req.body;

      if (!friendshipId || !action) {
        return res.status(400).json({ message: 'Parâmetros incompletos.' });
      }

      // Verificar se a ação é válida
      if (action !== 'ACCEPT' && action !== 'REJECT') {
        return res.status(400).json({ message: 'Ação inválida. Use ACCEPT ou REJECT.' });
      }

      // Verificar se a solicitação existe e pertence ao usuário
      const friendshipRequest = await prisma.friendship.findFirst({
        where: {
          id: friendshipId,
          friendId: userId,
          status: 'PENDING'
        }
      });

      if (!friendshipRequest) {
        return res.status(404).json({ message: 'Solicitação de amizade não encontrada.' });
      }

      // Responder à solicitação
      const status = action === 'ACCEPT' ? 'ACCEPTED' : 'REJECTED';
      const updatedFriendship = await respondToFriendRequest(friendshipId, status);
      
      // Preparar uma mensagem com base na ação
      const message = action === 'ACCEPT' 
        ? 'Solicitação de amizade aceita com sucesso.'
        : 'Solicitação de amizade rejeitada.';
      
      return res.status(200).json({
        message,
        friendship: updatedFriendship
      });
    } catch (error) {
      console.error('Erro ao responder solicitação de amizade:', error);
      return res.status(500).json({ message: 'Erro ao responder solicitação de amizade.' });
    }
  }

  return res.status(405).json({ message: 'Método não permitido.' });
}