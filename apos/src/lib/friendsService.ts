import { prisma } from '@/lib/prisma';

export interface FriendData {
  id: string;
  name: string;
  email: string;
  level?: number;
  isOnline?: boolean;
  lastSeen?: Date;
  currentActivity?: string;
  friendshipId: string;
  friendshipStatus: string;
}

export interface FriendshipRequest {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  status: string;
  createdAt: Date;
}

// Verifica se o cliente Prisma está disponível
function checkPrismaClient() {
  if (!prisma || !prisma.friendship) {
    throw new Error('Prisma client não inicializado corretamente. Verifique a conexão com o banco de dados.');
  }
}

/**
 * Busca todos os amigos de um usuário
 */
export async function getUserFriends(userId: string): Promise<FriendData[]> {
  try {
    // Verificar se o cliente Prisma está disponível
    checkPrismaClient();
    
    // Buscar amizades onde o usuário é o remetente e o status é ACCEPTED
    const sentFriendships = await prisma.friendship.findMany({
      where: {
        userId: userId,
        status: 'ACCEPTED'
      },
      include: {
        friend: {
          include: {
            userStatus: true
          }
        }
      }
    });
  
    // Buscar amizades onde o usuário é o destinatário e o status é ACCEPTED
    const receivedFriendships = await prisma.friendship.findMany({
      where: {
        friendId: userId,
        status: 'ACCEPTED'
      },
      include: {
        user: {
          include: {
            userStatus: true
          }
        }
      }
    });
    
    // Mapear as amizades enviadas para o formato de resposta
    const sentFriends: FriendData[] = sentFriendships.map(friendship => ({
      id: friendship.friendId,
      name: friendship.friend.name,
      email: friendship.friend.email,
      level: friendship.friend.level,
      isOnline: friendship.friend.userStatus?.isOnline || false,
      lastSeen: friendship.friend.userStatus?.lastSeen,
      currentActivity: friendship.friend.userStatus?.currentActivity || null,
      friendshipId: friendship.id,
      friendshipStatus: friendship.status
    }));
    
    // Mapear as amizades recebidas para o formato de resposta
    const receivedFriends: FriendData[] = receivedFriendships.map(friendship => ({
      id: friendship.userId,
      name: friendship.user.name,
      email: friendship.user.email,
      level: friendship.user.level,
      isOnline: friendship.user.userStatus?.isOnline || false,
      lastSeen: friendship.user.userStatus?.lastSeen,
      currentActivity: friendship.user.userStatus?.currentActivity || null,
      friendshipId: friendship.id,
      friendshipStatus: friendship.status
    }));
    
    // Combinar as duas listas
    return [...sentFriends, ...receivedFriends];
  } catch (error) {
    console.error('Erro ao buscar amigos:', error);
    // Retornar uma lista vazia em caso de erro para não quebrar a aplicação
    return [];
  }
}

/**
 * Busca todos os pedidos de amizade pendentes para um usuário
 */
export async function getPendingFriendRequests(userId: string): Promise<FriendshipRequest[]> {
  try {
    checkPrismaClient();
    const pendingRequests = await prisma.friendship.findMany({
      where: {
        friendId: userId,
        status: 'PENDING'
      },
      include: {
        user: true
      }
    });
    
    return pendingRequests.map(request => ({
      id: request.id,
      userId: request.userId,
      userName: request.user.name,
      userEmail: request.user.email,
      status: request.status,
      createdAt: request.createdAt
    }));
  } catch (error) {
    console.error('Erro ao buscar solicitações de amizade:', error);
    return [];
  }
}

/**
 * Busca usuários para adicionar como amigos (que ainda não são amigos)
 */
export async function searchUsersToAddAsFriends(
  userId: string, 
  searchTerm: string, 
  page: number = 1, 
  limit: number = 10
): Promise<{users: any[], total: number}> {
  // Buscar todas as conexões de amizade deste usuário (para excluir)
  const existingFriendships = await prisma.friendship.findMany({
    where: {
      OR: [
        { userId: userId },
        { friendId: userId }
      ]
    },
    select: {
      userId: true,
      friendId: true
    }
  });
  
  // Criar uma lista de IDs de usuários que já são amigos ou têm convites pendentes
  const excludeUserIds = new Set<string>();
  excludeUserIds.add(userId); // Excluir o próprio usuário
  
  existingFriendships.forEach(friendship => {
    excludeUserIds.add(friendship.userId);
    excludeUserIds.add(friendship.friendId);
  });
  
  // Buscar usuários que correspondem ao termo de pesquisa e não são amigos
  const users = await prisma.user.findMany({
    where: {
      AND: [
        {
          OR: [
            { name: { contains: searchTerm, mode: 'insensitive' } },
            { email: { contains: searchTerm, mode: 'insensitive' } }
          ]
        },
        { id: { notIn: Array.from(excludeUserIds) } }
      ]
    },
    select: {
      id: true,
      name: true,
      email: true,
      level: true,
      userStatus: {
        select: {
          isOnline: true,
          lastSeen: true
        }
      }
    },
    skip: (page - 1) * limit,
    take: limit
  });
  
  // Contar o total para paginação
  const total = await prisma.user.count({
    where: {
      AND: [
        {
          OR: [
            { name: { contains: searchTerm, mode: 'insensitive' } },
            { email: { contains: searchTerm, mode: 'insensitive' } }
          ]
        },
        { id: { notIn: Array.from(excludeUserIds) } }
      ]
    }
  });
  
  return {
    users,
    total
  };
}

/**
 * Envia uma solicitação de amizade
 */
export async function sendFriendRequest(userId: string, friendId: string): Promise<any> {
  // Verificar se já existe uma amizade entre os usuários
  const existingFriendship = await prisma.friendship.findFirst({
    where: {
      OR: [
        { userId, friendId },
        { userId: friendId, friendId: userId }
      ]
    }
  });
  
  if (existingFriendship) {
    if (existingFriendship.status === 'BLOCKED') {
      throw new Error('Não é possível enviar solicitação para este usuário');
    }
    return existingFriendship;
  }
  
  // Criar nova solicitação de amizade
  return prisma.friendship.create({
    data: {
      userId,
      friendId,
      status: 'PENDING'
    }
  });
}

/**
 * Responde a uma solicitação de amizade
 */
export async function respondToFriendRequest(
  friendshipId: string, 
  response: 'ACCEPTED' | 'REJECTED'
): Promise<any> {
  return prisma.friendship.update({
    where: { id: friendshipId },
    data: { status: response }
  });
}

/**
 * Remove uma amizade
 */
export async function removeFriend(friendshipId: string): Promise<any> {
  return prisma.friendship.delete({
    where: { id: friendshipId }
  });
}

/**
 * Bloqueia um usuário
 */
export async function blockUser(userId: string, blockedUserId: string): Promise<any> {
  // Verificar se já existe uma amizade entre os usuários
  const existingFriendship = await prisma.friendship.findFirst({
    where: {
      OR: [
        { userId, friendId: blockedUserId },
        { userId: blockedUserId, friendId: userId }
      ]
    }
  });
  
  if (existingFriendship) {
    // Atualizar a amizade existente para BLOCKED
    return prisma.friendship.update({
      where: { id: existingFriendship.id },
      data: { 
        status: 'BLOCKED',
        // Garantir que o usuário que está bloqueando seja o remetente
        userId,
        friendId: blockedUserId
      }
    });
  }
  
  // Criar nova entrada de bloqueio
  return prisma.friendship.create({
    data: {
      userId,
      friendId: blockedUserId,
      status: 'BLOCKED'
    }
  });
}

/**
 * Atualiza o status online de um usuário
 */
export async function updateUserOnlineStatus(
  userId: string, 
  isOnline: boolean, 
  currentActivity?: string
): Promise<any> {
  try {
    checkPrismaClient();
    
    // Verificar se o usuário já tem um registro de status
    const userStatus = await prisma.userStatus.findUnique({
      where: { userId }
    });
    
    if (userStatus) {
      // Atualizar o status existente
      return prisma.userStatus.update({
        where: { id: userStatus.id },
        data: {
          isOnline,
          lastSeen: isOnline ? userStatus.lastSeen : new Date(), // Atualizar lastSeen apenas ao ficar offline
          currentActivity: currentActivity || userStatus.currentActivity,
          updatedAt: new Date()
        }
      });
    }
    
    // Criar novo registro de status
    return prisma.userStatus.create({
      data: {
        userId,
        isOnline,
        currentActivity,
        updatedAt: new Date()
      }
    });
  } catch (error) {
    console.error('Erro ao atualizar status online:', error);
    // Retornar um objeto que indica erro, mas não quebra o fluxo
    return { 
      userId, 
      isOnline, 
      error: true,
      message: "Erro ao atualizar status - função ainda sendo implementada"
    };
  }
}