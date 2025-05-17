'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Tabs } from '@/components/ui/Tabs';
import FriendCard from '@/components/FriendCard';
import FriendRequestCard from '@/components/FriendRequestCard';
import UserSearchCard from '@/components/UserSearchCard';
import { useFriends } from '@/lib/hooks/useFriends';
import { useRequireAuth } from '@/lib/hooks/useRequireAuth';

export default function FriendsPage() {
  const { isLoading, isAuthenticated } = useRequireAuth();
  
  const {
    friends,
    pendingRequests,
    loading,
    error,
    refreshFriends,
    sendFriendRequest,
    respondToFriendRequest,
    removeFriend,
    blockUser,
    searchUsers
  } = useFriends();
  
  // Estados locais
  const [activeTab, setActiveTab] = useState('friends');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  // Mostrar online/offline
  const [showOfflineFriends, setShowOfflineFriends] = useState(true);
  
  // Filtrar amigos online/offline
  const filteredFriends = showOfflineFriends 
    ? friends 
    : friends.filter(friend => friend.isOnline);
  
  // Lidar com pesquisa de usuários
  const handleSearch = useCallback(async () => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      return;
    }
    
    setIsSearching(true);
    setSearchError(null);
    
    try {
      const { users, pagination } = await searchUsers(searchTerm, currentPage);
      setSearchResults(users);
      setTotalPages(pagination.totalPages);
    } catch (error) {
      console.error('Erro na pesquisa:', error);
      setSearchError('Erro ao pesquisar usuários. Tente novamente.');
    } finally {
      setIsSearching(false);
    }
  }, [searchTerm, currentPage, searchUsers]);
  
  // Executar pesquisa quando o termo mudar
  useEffect(() => {
    const timer = setTimeout(() => {
      if (activeTab === 'add' && searchTerm.trim()) {
        setCurrentPage(1); // Reset da página quando muda a pesquisa
        handleSearch();
      }
    }, 500);
    
    return () => clearTimeout(timer);
  }, [searchTerm, activeTab, handleSearch]);
  
  // Executar pesquisa quando a página mudar
  useEffect(() => {
    if (activeTab === 'add' && searchTerm.trim() && currentPage > 0) {
      handleSearch();
    }
  }, [currentPage, activeTab, searchTerm, handleSearch]);
  
  // Lidar com envio de solicitação de amizade
  const handleAddFriend = async (userId: string) => {
    try {
      await sendFriendRequest(userId);
    } catch (error) {
      console.error('Erro ao adicionar amigo:', error);
      // Erros são tratados no hook
    }
  };
  
  // Lidar com aceitação de solicitação de amizade
  const handleAcceptRequest = async (friendshipId: string) => {
    try {
      await respondToFriendRequest(friendshipId, 'ACCEPT');
      refreshFriends();
    } catch (error) {
      console.error('Erro ao aceitar solicitação:', error);
      // Erros são tratados no hook
    }
  };
  
  // Lidar com rejeição de solicitação de amizade
  const handleRejectRequest = async (friendshipId: string) => {
    try {
      await respondToFriendRequest(friendshipId, 'REJECT');
      refreshFriends();
    } catch (error) {
      console.error('Erro ao rejeitar solicitação:', error);
      // Erros são tratados no hook
    }
  };
  
  // Componente de carregamento
  if (isLoading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500"></div>
        </div>
      </div>
    );
  }
  
  // Se não estiver autenticado, não renderizar nada
  if (!isAuthenticated) {
    return null;
  }
  
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-6">Amigos</h1>
        
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          items={[
            { value: 'friends', label: `Amigos (${friends.length})` },
            { value: 'requests', label: `Solicitações (${pendingRequests.length})` },
            { value: 'add', label: 'Adicionar amigos' }
          ]}
          className="mb-6"
        />
        
        {activeTab === 'friends' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-white">Meus amigos</h2>
              
              <div className="flex items-center">
                <label className="inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showOfflineFriends}
                    onChange={() => setShowOfflineFriends(!showOfflineFriends)}
                    className="sr-only peer"
                  />
                  <div className="relative w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#3bc37a]"></div>
                  <span className="ms-3 text-sm font-medium text-gray-300">Mostrar offline</span>
                </label>
              </div>
            </div>
            
            {loading ? (
              <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-green-500"></div>
              </div>
            ) : error ? (
              <div className="bg-red-900 bg-opacity-20 border border-red-700 rounded-md p-4 text-red-400">
                {error}
              </div>
            ) : filteredFriends.length === 0 ? (
              <div className="bg-gray-800 rounded-md p-8 text-center">
                <p className="text-gray-400 mb-4">
                  {friends.length === 0 
                    ? 'Você ainda não tem nenhum amigo.' 
                    : 'Nenhum amigo online no momento.'}
                </p>
                
                <Button 
                  onClick={() => setActiveTab('add')}
                  className="bg-[#3bc37a] hover:bg-[#2aa15a]"
                >
                  Adicionar amigos
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredFriends.map(friend => (
                  <FriendCard
                    key={friend.id}
                    id={friend.id}
                    name={friend.name}
                    level={friend.level}
                    isOnline={friend.isOnline}
                    lastSeen={friend.lastSeen}
                    currentActivity={friend.currentActivity}
                    friendshipId={friend.friendshipId}
                    onRemove={removeFriend}
                    onBlock={blockUser}
                  />
                ))}
              </div>
            )}
          </div>
        )}
        
        {activeTab === 'requests' && (
          <div>
            <h2 className="text-xl font-semibold text-white mb-4">Solicitações de amizade</h2>
            
            {loading ? (
              <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-green-500"></div>
              </div>
            ) : pendingRequests.length === 0 ? (
              <div className="bg-gray-800 rounded-md p-8 text-center">
                <p className="text-gray-400">Você não tem solicitações de amizade pendentes.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingRequests.map(request => (
                  <FriendRequestCard
                    key={request.id}
                    id={request.id}
                    userName={request.userName}
                    userEmail={request.userEmail}
                    createdAt={request.createdAt}
                    onAccept={handleAcceptRequest}
                    onReject={handleRejectRequest}
                  />
                ))}
              </div>
            )}
          </div>
        )}
        
        {activeTab === 'add' && (
          <div>
            <h2 className="text-xl font-semibold text-white mb-4">Encontrar amigos</h2>
            
            <div className="mb-6">
              <div className="relative">
                <Input
                  type="text"
                  placeholder="Pesquisar por nome ou email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-gray-800 border-gray-700 focus:border-[#3bc37a] focus:ring-[#3bc37a] pl-10"
                />
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </div>
            </div>
            
            {searchError && (
              <div className="bg-red-900 bg-opacity-20 border border-red-700 rounded-md p-4 text-red-400 mb-4">
                {searchError}
              </div>
            )}
            
            {isSearching ? (
              <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-green-500"></div>
              </div>
            ) : searchResults.length === 0 && searchTerm.trim() !== '' ? (
              <div className="bg-gray-800 rounded-md p-8 text-center">
                <p className="text-gray-400">Nenhum usuário encontrado com este termo.</p>
              </div>
            ) : searchTerm.trim() === '' ? (
              <div className="bg-gray-800 rounded-md p-8 text-center">
                <p className="text-gray-400">Digite um nome ou email para pesquisar usuários.</p>
              </div>
            ) : (
              <div>
                <div className="space-y-4 mb-4">
                  {searchResults.map(user => (
                    <UserSearchCard
                      key={user.id}
                      id={user.id}
                      name={user.name}
                      email={user.email}
                      level={user.level}
                      isOnline={user.userStatus?.isOnline}
                      lastSeen={user.userStatus?.lastSeen}
                      onAdd={handleAddFriend}
                    />
                  ))}
                </div>
                
                {totalPages > 1 && (
                  <div className="flex justify-center mt-6">
                    <div className="inline-flex rounded-md shadow-sm">
                      <button
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                        className="px-4 py-2 text-sm font-medium rounded-l-md bg-gray-800 text-white border border-gray-700 hover:bg-gray-700 disabled:bg-gray-900 disabled:text-gray-600"
                      >
                        Anterior
                      </button>
                      <div className="px-4 py-2 text-sm bg-gray-700 text-white border-t border-b border-gray-700">
                        {currentPage} de {totalPages}
                      </div>
                      <button
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages}
                        className="px-4 py-2 text-sm font-medium rounded-r-md bg-gray-800 text-white border border-gray-700 hover:bg-gray-700 disabled:bg-gray-900 disabled:text-gray-600"
                      >
                        Próxima
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}