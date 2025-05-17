import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '../auth/[...nextauth]';
import { removeFriend, blockUser } from '@/lib/friendsService';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const session = await getServerSession(req, res, authOptions);

  if (!session) {
    return res.status(401).json({ message: 'Não autorizado. Faça login primeiro.' });
  }

  const userId = session.user.id;
  const { id } = req.query; // ID da amizade
  
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ message: 'ID de amizade inválido.' });
  }

  // GET - Obter detalhes de uma amizade
  if (req.method === 'GET') {
    try {
      // Verificar se a amizade existe e pertence ao usuário
      const friendship = await prisma.friendship.findFirst({
        where: {
          id,
          OR: [
            { userId },
            { friendId: userId }
          ]
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              level: true,
              userStatus: true
            }
          },
          friend: {
            select: {
              id: true,
              name: true,
              email: true,
              level: true,
              userStatus: true
            }
          }
        }
      });

      if (!friendship) {
        return res.status(404).json({ message: 'Amizade não encontrada.' });
      }

      // Determinar qual usuário é o amigo (não o usuário atual)
      const friendInfo = friendship.userId === userId ? friendship.friend : friendship.user;

      return res.status(200).json({
        id: friendship.id,
        status: friendship.status,
        createdAt: friendship.createdAt,
        updatedAt: friendship.updatedAt,
        friend: {
          id: friendInfo.id,
          name: friendInfo.name,
          email: friendInfo.email,
          level: friendInfo.level,
          isOnline: friendInfo.userStatus?.isOnline || false,
          lastSeen: friendInfo.userStatus?.lastSeen,
          currentActivity: friendInfo.userStatus?.currentActivity
        }
      });
    } catch (error) {
      console.error('Erro ao buscar detalhes da amizade:', error);
      return res.status(500).json({ message: 'Erro ao buscar detalhes da amizade.' });
    }
  }

  // DELETE - Remover amizade
  if (req.method === 'DELETE') {
    try {
      // Verificar se a amizade existe e pertence ao usuário
      const friendship = await prisma.friendship.findFirst({
        where: {
          id,
          OR: [
            { userId },
            { friendId: userId }
          ]
        }
      });

      if (!friendship) {
        return res.status(404).json({ message: 'Amizade não encontrada.' });
      }

      // Remover a amizade
      await removeFriend(id);

      return res.status(200).json({ message: 'Amizade removida com sucesso.' });
    } catch (error) {
      console.error('Erro ao remover amizade:', error);
      return res.status(500).json({ message: 'Erro ao remover amizade.' });
    }
  }

  // PATCH - Atualizar amizade (bloquear)
  if (req.method === 'PATCH') {
    try {
      const { action } = req.body;

      if (action !== 'BLOCK') {
        return res.status(400).json({ message: 'Ação inválida. Use BLOCK.' });
      }

      // Verificar se a amizade existe e pertence ao usuário
      const friendship = await prisma.friendship.findFirst({
        where: {
          id,
          OR: [
            { userId },
            { friendId: userId }
          ]
        }
      });

      if (!friendship) {
        return res.status(404).json({ message: 'Amizade não encontrada.' });
      }

      // Determinar qual usuário será bloqueado
      const blockedUserId = friendship.userId === userId ? friendship.friendId : friendship.userId;

      // Bloquear o usuário
      const updatedFriendship = await blockUser(userId, blockedUserId);

      return res.status(200).json({
        message: 'Usuário bloqueado com sucesso.',
        friendship: updatedFriendship
      });
    } catch (error) {
      console.error('Erro ao bloquear usuário:', error);
      return res.status(500).json({ message: 'Erro ao bloquear usuário.' });
    }
  }

  return res.status(405).json({ message: 'Método não permitido.' });
}