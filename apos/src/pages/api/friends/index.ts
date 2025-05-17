import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '../auth/[...nextauth]';
import { getUserFriends, sendFriendRequest } from '@/lib/friendsService';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const session = await getServerSession(req, res, authOptions);

  if (!session) {
    return res.status(401).json({ message: 'Não autorizado. Faça login primeiro.' });
  }

  const userId = session.user.id;

  // GET - Listar amigos
  if (req.method === 'GET') {
    try {
      const friends = await getUserFriends(userId);
      return res.status(200).json(friends);
    } catch (error) {
      console.error('Erro ao buscar amigos:', error);
      return res.status(500).json({ message: 'Erro ao buscar amigos.' });
    }
  }

  // POST - Enviar solicitação de amizade
  if (req.method === 'POST') {
    try {
      const { friendId } = req.body;

      if (!friendId) {
        return res.status(400).json({ message: 'ID do amigo não fornecido.' });
      }

      // Verificar se o usuário está tentando adicionar a si mesmo
      if (friendId === userId) {
        return res.status(400).json({ message: 'Você não pode adicionar a si mesmo como amigo.' });
      }

      // Verificar se o amigo existe
      const friend = await prisma.user.findUnique({
        where: { id: friendId },
        select: { id: true, name: true, email: true }
      });

      if (!friend) {
        return res.status(404).json({ message: 'Usuário não encontrado.' });
      }

      // Enviar solicitação de amizade
      const friendship = await sendFriendRequest(userId, friendId);
      
      return res.status(201).json({
        message: 'Solicitação de amizade enviada com sucesso.',
        friendship
      });
    } catch (error) {
      console.error('Erro ao enviar solicitação de amizade:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro ao enviar solicitação de amizade.';
      return res.status(500).json({ message: errorMessage });
    }
  }

  return res.status(405).json({ message: 'Método não permitido.' });
}