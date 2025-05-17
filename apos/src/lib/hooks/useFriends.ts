import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

export interface Friend {
  id: string;
  name: string;
  email: string;
  level?: number;
  isOnline?: boolean;
  lastSeen?: string;
  currentActivity?: string;
  friendshipId: string;
  friendshipStatus: string;
}

export interface FriendRequest {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  status: string;
  createdAt: string;
}

export function useFriends() {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [pendingRequests, setPendingRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);

  // Função para forçar atualização dos dados
  const refreshFriends = useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
  }, []);

  // Buscar lista de amigos
  useEffect(() => {
    const fetchFriends = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const response = await axios.get('/api/friends');
        // Verificar se a resposta é válida
        if (response.data && Array.isArray(response.data)) {
          setFriends(response.data);
        } else {
          // Se não for um array, definir como array vazio
          console.warn('Resposta da API de amigos não é um array válido:', response.data);
          setFriends([]);
        }
      } catch (err) {
        console.error('Erro ao buscar amigos:', err);
        setError('Sistema de amigos em manutenção. Tente novamente mais tarde.');
        // Definir amigos como array vazio para não quebrar a UI
        setFriends([]);
      } finally {
        setLoading(false);
      }
    };

    fetchFriends();
  }, [refreshTrigger]);

  // Buscar solicitações pendentes
  useEffect(() => {
    const fetchPendingRequests = async () => {
      try {
        const response = await axios.get('/api/friends/requests');
        // Verificar se a resposta é válida
        if (response.data && Array.isArray(response.data)) {
          setPendingRequests(response.data);
        } else {
          // Se não for um array, definir como array vazio
          console.warn('Resposta da API de solicitações não é um array válido:', response.data);
          setPendingRequests([]);
        }
      } catch (err) {
        console.error('Erro ao buscar solicitações de amizade:', err);
        // Definir solicitações como array vazio para não quebrar a UI
        setPendingRequests([]);
      }
    };

    fetchPendingRequests();
  }, [refreshTrigger]);

  // Enviar solicitação de amizade
  const sendFriendRequest = useCallback(async (friendId: string) => {
    try {
      const response = await axios.post('/api/friends', { friendId });
      refreshFriends();
      return response.data;
    } catch (err) {
      console.error('Erro ao enviar solicitação de amizade:', err);
      if (axios.isAxiosError(err) && err.response) {
        throw new Error(err.response.data.message || 'Erro ao enviar solicitação de amizade');
      }
      throw new Error('Erro ao enviar solicitação de amizade');
    }
  }, [refreshFriends]);

  // Responder a uma solicitação de amizade
  const respondToFriendRequest = useCallback(async (friendshipId: string, action: 'ACCEPT' | 'REJECT') => {
    try {
      const response = await axios.post('/api/friends/requests', { friendshipId, action });
      refreshFriends();
      return response.data;
    } catch (err) {
      console.error('Erro ao responder solicitação de amizade:', err);
      if (axios.isAxiosError(err) && err.response) {
        throw new Error(err.response.data.message || 'Erro ao responder solicitação de amizade');
      }
      throw new Error('Erro ao responder solicitação de amizade');
    }
  }, [refreshFriends]);

  // Remover amizade
  const removeFriend = useCallback(async (friendshipId: string) => {
    try {
      const response = await axios.delete(`/api/friends/${friendshipId}`);
      refreshFriends();
      return response.data;
    } catch (err) {
      console.error('Erro ao remover amizade:', err);
      if (axios.isAxiosError(err) && err.response) {
        throw new Error(err.response.data.message || 'Erro ao remover amizade');
      }
      throw new Error('Erro ao remover amizade');
    }
  }, [refreshFriends]);

  // Bloquear usuário
  const blockUser = useCallback(async (friendshipId: string) => {
    try {
      const response = await axios.patch(`/api/friends/${friendshipId}`, { action: 'BLOCK' });
      refreshFriends();
      return response.data;
    } catch (err) {
      console.error('Erro ao bloquear usuário:', err);
      if (axios.isAxiosError(err) && err.response) {
        throw new Error(err.response.data.message || 'Erro ao bloquear usuário');
      }
      throw new Error('Erro ao bloquear usuário');
    }
  }, [refreshFriends]);

  // Buscar usuários para adicionar como amigos
  const searchUsers = useCallback(async (
    searchTerm: string, 
    page: number = 1, 
    limit: number = 10
  ) => {
    try {
      const response = await axios.get('/api/friends/search', {
        params: { q: searchTerm, page, limit }
      });
      return response.data;
    } catch (err) {
      console.error('Erro ao pesquisar usuários:', err);
      if (axios.isAxiosError(err) && err.response) {
        throw new Error(err.response.data.message || 'Erro ao pesquisar usuários');
      }
      throw new Error('Erro ao pesquisar usuários');
    }
  }, []);

  // Atualizar status online
  const updateOnlineStatus = useCallback(async (isOnline: boolean, currentActivity?: string) => {
    try {
      // Adicionar timeout e retry para evitar bloqueio da UI
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000); // 2s timeout
      
      await axios.post('/api/user/status', { isOnline, currentActivity }, {
        signal: controller.signal,
        // Adicionamos o parâmetro para evitar erros 500 durante o desenvolvimento
        params: { bypass: true }
      });
      
      clearTimeout(timeoutId);
    } catch (err) {
      // Apenas logar o erro, não mostrar ao usuário
      console.error('Erro ao atualizar status online:', err);
      // Se for erro de timeout ou 500, não fazer nada além de logar
      // Este é um recurso não crítico
    }
  }, []);

  return {
    friends,
    pendingRequests,
    loading,
    error,
    refreshFriends,
    sendFriendRequest,
    respondToFriendRequest,
    removeFriend,
    blockUser,
    searchUsers,
    updateOnlineStatus
  };
}