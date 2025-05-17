'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/Button';
import UserInfoCard from './UserInfoCard';

// Interface para mensagens
interface ChatMessage {
  id?: string;
  text: string;
  sender: 'USER' | 'ADMIN' | 'SYSTEM';
  userId?: string;
  userName?: string;
  userEmail?: string;
  recipientId?: string | null;
  timestamp: Date | string;
  read?: boolean;
  isFinal?: boolean;
  isImage?: boolean;
  fileInfo?: {
    originalName: string;
    url: string;
  };
}

// Interface para as props do componente
interface ChatSupportProps {
  id?: string;
  isAdmin?: boolean;
  selectedUserId?: string;
  onUserChange?: (userId: string) => void;
  title?: string;
  height?: string;
  autoFocus?: boolean;
  onNewMessage?: () => void;
  onMessagesRead?: () => void;
}

export default function ChatSupport({
  id,
  isAdmin = false,
  selectedUserId,
  onUserChange,
  title = 'Chat de Suporte',
  height = '400px',
  autoFocus = false,
  onNewMessage,
  onMessagesRead
}: ChatSupportProps) {
  // Estados para mensagens e entrada de texto
  const [message, setMessage] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatUsers, setChatUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Estado para controlar requisições simultâneas
  const [isUpdating, setIsUpdating] = useState(false);
  
  // Sessão do usuário
  const { data: session } = useSession();
  
  // Buscar mensagens
  const fetchMessages = async () => {
    if (!session?.user?.id) return;
    
    try {
      setIsUpdating(true);
      
      // Se for admin, buscar mensagens do usuário selecionado
      const url = isAdmin && selectedUserId
        ? `/api/chat/messages?userId=${selectedUserId}`
        : '/api/chat/messages';
      
      const response = await fetch(url);
      
      if (response.ok) {
        const messages = await response.json();
        
        // Verificar se alguma das mensagens atuais é temporária (enviada pelo usuário mas não salva no servidor)
        const temporaryMessages = chatMessages.filter(msg => 
          // Considerar como temporária se o ID parece gerado pelo cliente (não está nos mensagens do servidor)
          msg.sender === 'USER' && 
          !messages.some(serverMsg => serverMsg.id === msg.id) &&
          // E se foi enviada nos últimos 30 segundos (para evitar manter mensagens antigas)
          new Date(msg.timestamp).getTime() > Date.now() - 30000
        );
        
        // Combinar mensagens do servidor com mensagens temporárias
        const combinedMessages = [...messages, ...temporaryMessages];
        
        // Ordenar por timestamp para manter a ordem cronológica
        combinedMessages.sort((a, b) => 
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );
        
        // Definir as mensagens combinadas
        setChatMessages(combinedMessages);
        
        // Rolar para o final apenas se houver mensagens
        if (combinedMessages.length > 0) {
          setTimeout(() => {
            const container = document.getElementById('chat-messages-container');
            if (container) {
              container.scrollTop = container.scrollHeight;
            }
          }, 100);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar mensagens:', error);
    } finally {
      setIsUpdating(false);
    }
  };
  
  // Buscar usuários (apenas para admin)
  const fetchUsers = async () => {
    if (!isAdmin || !session?.user?.id) return;
    
    try {
      const response = await fetch('/api/chat/users');
      if (response.ok) {
        const users = await response.json();
        setChatUsers(users);
        
        // Selecionar automaticamente o primeiro usuário se não houver nenhum selecionado
        if (users.length > 0 && !selectedUserId && onUserChange) {
          onUserChange(users[0].id);
        }
      }
    } catch (error) {
      console.error('Erro ao buscar usuários:', error);
    }
  };
  
  // Efeito para inicialização
  useEffect(() => {
    if (session?.user?.id) {
      // Buscar mensagens inicialmente
      fetchMessages();
      
      // Se for admin, buscar usuários
      if (isAdmin) {
        fetchUsers();
      }
    }
  }, [session?.user?.id, isAdmin, selectedUserId]);
  
  // Efeito para polling de mensagens
  useEffect(() => {
    if (!session?.user?.id) return;
    
    const intervalId = setInterval(() => {
      if (document.visibilityState === 'visible' && !isUpdating) {
        fetchMessages();
      }
    }, 15000);
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !isUpdating) {
        fetchMessages();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [session?.user?.id, isAdmin, selectedUserId, isUpdating]);
  
  // Efeito para verificar mensagens não lidas e notificar o componente pai
  useEffect(() => {
    // Verificar se existem mensagens não lidas (só para usuários, não para admin)
    if (!isAdmin && chatMessages.length > 0 && onNewMessage && onMessagesRead) {
      const hasUnreadMessages = chatMessages.some(msg => 
        msg.sender !== 'USER' && msg.read === false
      );
      
      if (hasUnreadMessages) {
        // Notificar o componente pai sobre mensagens não lidas
        onNewMessage();
      } else {
        // Garantir que não haja notificação se não houver mensagens não lidas
        onMessagesRead();
      }
    }
  }, [chatMessages, isAdmin, onNewMessage, onMessagesRead]);
  
  // Efeito para marcar mensagens como lidas quando o chat é aberto
  useEffect(() => {
    // Apenas executar se o componente estiver visível 
    if (document.getElementById('chat-messages-container') && onMessagesRead) {
      // Marcar mensagens como lidas no servidor
      const markMessagesAsRead = async () => {
        try {
          const response = await fetch('/api/chat/messages/read', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            }
          });
          
          if (response.ok) {
            // Notificar o componente pai que as mensagens foram lidas
            onMessagesRead();
          }
        } catch (error) {
          console.error('Erro ao marcar mensagens como lidas:', error);
        }
      };
      
      markMessagesAsRead();
    }
  }, [onMessagesRead]);
  
  // Função para enviar mensagem
  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const messageText = message.trim();
    if (!messageText || !session?.user?.id) return;
    
    try {
      setLoading(true);
      
      // Gerar ID único para a mensagem temporária
      const tempId = Math.random().toString(36).substring(2, 15);
      
      // Adicionar a mensagem localmente para feedback imediato
      const tempMessage: ChatMessage = {
        id: tempId,
        text: messageText,
        sender: isAdmin ? 'ADMIN' : 'USER',
        userId: session.user.id,
        userName: session.user.name || 'Você',
        recipientId: isAdmin && selectedUserId ? selectedUserId : null,
        timestamp: new Date(),
        read: true
      };
      
      // Limpar a mensagem no input antes de qualquer operação
      setMessage('');
      
      // Adicionar temporariamente à lista local para UI responsiva
      setChatMessages(prev => [...prev, tempMessage]);
      
      // Rolar para o final imediatamente
      setTimeout(() => {
        const container = document.getElementById('chat-messages-container');
        if (container) {
          container.scrollTop = container.scrollHeight;
        }
      }, 10);
      
      // Enviar para o servidor
      const response = await fetch('/api/chat/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: messageText,
          // Se for admin, enviar para o usuário selecionado
          ...(isAdmin && selectedUserId && { recipientId: selectedUserId }),
        }),
      });
      
      let apiSucceeded = false;
      
      if (response.ok) {
        // Aguardar breve período para garantir que a mensagem seja processada no servidor
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Buscar mensagens atualizadas após envio
        const messagesResponse = await fetch(isAdmin && selectedUserId
          ? `/api/chat/messages?userId=${selectedUserId}`
          : '/api/chat/messages');
          
        if (messagesResponse.ok) {
          const messages = await messagesResponse.json();
          setChatMessages(messages);
          apiSucceeded = true;
          
          // Rolar para o final novamente após atualizar mensagens
          setTimeout(() => {
            const container = document.getElementById('chat-messages-container');
            if (container) {
              container.scrollTop = container.scrollHeight;
            }
          }, 100);
        }
      }
      
      // Se a API falhar, mantemos a mensagem temporária para garantir uma UI responsiva
      if (!apiSucceeded) {
        console.warn('Falha na sincronização com o servidor, mantendo mensagem temporária local');
      }
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
    } finally {
      setLoading(false);
    }
  };
  
  // Função para iniciar uma nova conversa
  const startNewConversation = async () => {
    try {
      setLoading(true);
      
      // Verificar se é o usuário final (não admin)
      if (!isAdmin) {
        // Enviar uma mensagem de sistema para reabrir o chat
        const response = await fetch('/api/chat/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: "Iniciou uma nova conversa.",
            newConversation: true // Adicionar flag para o backend saber que é uma nova conversa
          }),
        });
        
        if (response.ok) {
          // Recarregar as mensagens
          fetchMessages();
        }
      } else if (selectedUserId) {
        // Para admin, apenas recarregar as mensagens do usuário selecionado
        fetchMessages();
      }
    } catch (error) {
      console.error('Erro ao iniciar nova conversa:', error);
    } finally {
      setLoading(false);
    }
  };
  
  // Função para encerrar o chat de suporte
  const finalizeChat = async () => {
    if (!isAdmin || !selectedUserId || !session?.user?.id) return;
    
    if (!window.confirm('Tem certeza que deseja encerrar este chat? Uma mensagem de encerramento será enviada ao usuário.')) {
      return;
    }
    
    try {
      setLoading(true);
      
      const response = await fetch('/api/chat/finalize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: selectedUserId,
        }),
      });
      
      if (response.ok) {
        // Atualizar mensagens
        fetchMessages();
        // Mostrar mensagem de sucesso
        alert('Chat encerrado com sucesso!');
      } else {
        alert('Erro ao encerrar chat. Tente novamente.');
      }
    } catch (error) {
      console.error('Erro ao encerrar chat:', error);
      alert('Erro ao encerrar chat. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };
  
  // Função para limpar o histórico de chat
  const clearChatHistory = async () => {
    if (!session?.user?.id) return;
    
    if (!window.confirm('Tem certeza que deseja limpar todo o histórico de conversa?')) {
      return;
    }
    
    try {
      setLoading(true);
      
      // Primeiro, limpar o estado local para feedback imediato
      setChatMessages([]);
      
      // Armazenar uma mensagem temporária de sistema
      const tempSystemMessage: ChatMessage = {
        id: 'temp-system-msg-' + Date.now(),
        text: "O histórico de mensagens foi limpo.",
        sender: 'SYSTEM',
        userId: session.user.id,
        userName: 'Sistema',
        timestamp: new Date(),
        read: true
      };
      
      // Exibir mensagem temporária mesmo antes da resposta da API
      setTimeout(() => {
        setChatMessages([tempSystemMessage]);
      }, 300);
      
      try {
        const response = await fetch('/api/chat/clear', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            // Se for admin, enviar o userId do usuário selecionado
            ...(isAdmin && selectedUserId && { userId: selectedUserId }),
          }),
        });
        
        if (response.ok) {
          console.log("Histórico limpo com sucesso");
          
          // Buscar mensagens após um pequeno delay para garantir que a API processou a limpeza
          setTimeout(() => {
            fetchMessages();
          }, 1000);
        } else {
          console.error('Erro na resposta da API ao limpar histórico:', response.status);
          
          // Mesmo com erro, manter a mensagem local de sistema
          // e tentar buscar mensagens novamente
          setTimeout(() => {
            fetchMessages();
          }, 1000);
        }
      } catch (networkError) {
        console.error('Erro de rede ao limpar histórico:', networkError);
        
        // Mesmo com erro de rede, manter a mensagem local de sistema
        // para que o usuário veja um feedback
      }
    } catch (error) {
      console.error('Erro ao limpar histórico de chat:', error);
      
      // Recarregar mensagens em caso de erro
      fetchMessages();
    } finally {
      setLoading(false);
    }
  };
  
  // Expor a função clearChatHistory globalmente para acesso externo
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Expõe a função no objeto global window para acesso externo
      (window as any).clearChatHistory = clearChatHistory;
    }
    
    return () => {
      // Limpar quando o componente for desmontado
      if (typeof window !== 'undefined') {
        delete (window as any).clearChatHistory;
      }
    };
  }, [session?.user?.id, isAdmin, selectedUserId]);
  
  // Função para upload de imagem
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !session?.user?.id) return;
    
    try {
      setLoading(true);
      
      const formData = new FormData();
      formData.append('file', files[0]);
      
      const response = await fetch('/api/chat/upload', {
        method: 'POST',
        body: formData,
      });
      
      if (response.ok) {
        const fileInfo = await response.json();
        
        // Enviar mensagem com a imagem
        const messageResponse = await fetch('/api/chat/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: `[IMAGEM: ${fileInfo.originalName}](${fileInfo.url})`,
            isImage: true,
            fileInfo: fileInfo,
            // Se for admin, enviar para o usuário selecionado
            ...(isAdmin && selectedUserId && { recipientId: selectedUserId }),
          }),
        });
        
        if (messageResponse.ok) {
          // Buscar mensagens para atualizar com uma flag para não rolar automaticamente
          const currentMessages = [...chatMessages];
          
          const response = await fetch(isAdmin && selectedUserId
            ? `/api/chat/messages?userId=${selectedUserId}`
            : '/api/chat/messages');
            
          if (response.ok) {
            const messages = await response.json();
            setChatMessages(messages);
            
            // Rolar para o final apenas se houver mensagens
            if (messages.length > 0) {
              setTimeout(() => {
                const container = document.getElementById('chat-messages-container');
                if (container) {
                  container.scrollTop = container.scrollHeight;
                }
              }, 100);
            }
          }
        }
      }
    } catch (error) {
      console.error('Erro ao fazer upload da imagem:', error);
    } finally {
      setLoading(false);
      // Limpar o input de arquivo
      if (e.target) {
        e.target.value = '';
      }
    }
  };
  
  // Função para lidar com quebra de linha
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Ctrl+Enter envia a mensagem
    if (e.key === 'Enter' && e.ctrlKey) {
      sendMessage(e as any);
      return;
    }
    
    // Enter sem Ctrl só adiciona quebra de linha se for um textarea
    if (e.key === 'Enter' && !e.ctrlKey) {
      e.preventDefault();
      sendMessage(e as any);
    }
  };
  
  // Estado para acompanhar a imagem ampliada
  const [enlargedImage, setEnlargedImage] = useState<{url: string, name: string} | null>(null);
  
  // Função para renderizar mensagens
  const MessageDisplay = ({ msg }: { msg: ChatMessage }) => {
    if (msg.isImage && msg.fileInfo) {
      return (
        <div>
          <div 
            className="cursor-pointer group relative" 
            onClick={() => setEnlargedImage({
              url: msg.fileInfo!.url,
              name: msg.fileInfo!.originalName || "Imagem compartilhada"
            })}
          >
            <img 
              src={msg.fileInfo.url} 
              alt={msg.fileInfo.originalName || "Imagem compartilhada"} 
              className="max-w-full rounded-md hover:opacity-95 transition-all duration-300 border border-indigo-500/30 shadow-sm object-cover group-hover:scale-[1.02]"
              style={{ maxHeight: '110px', maxWidth: '180px' }}
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-all duration-300 rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white/90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m4-3H7" />
              </svg>
            </div>
          </div>
          <span className="text-xs text-gray-400 mt-1 block font-light">
            {msg.fileInfo.originalName} (toque para ampliar)
          </span>
        </div>
      );
    } else if (msg.isImage) {
      // Tentar extrair a URL da imagem do texto
      const imageUrl = msg.text.match(/\(([^)]+)\)/)?.[1];
      const imageName = msg.text.match(/\[IMAGEM: ([^\]]+)\]/)?.[1] || 'Imagem compartilhada';
      
      if (imageUrl) {
        return (
          <div>
            <div 
              className="cursor-pointer group relative" 
              onClick={() => setEnlargedImage({
                url: imageUrl,
                name: imageName
              })}
            >
              <img 
                src={imageUrl}
                alt={imageName}
                className="max-w-full rounded-md hover:opacity-95 transition-all duration-300 border border-indigo-500/30 shadow-sm object-cover group-hover:scale-[1.02]"
                style={{ maxHeight: '110px', maxWidth: '180px' }}
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-all duration-300 rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white/90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m4-3H7" />
                </svg>
              </div>
            </div>
            <span className="text-xs text-gray-400 mt-1 block font-light">
              {imageName} (toque para ampliar)
            </span>
          </div>
        );
      }
    }
    
    // Caso padrão: renderizar o texto com quebras de linha
    if (msg.isFinal) {
      return (
        <div className="chat-final-message">
          <p className="text-sm whitespace-pre-wrap font-medium">{msg.text}</p>
        </div>
      );
    }
    
    return <p className="text-sm whitespace-pre-wrap">{msg.text}</p>;
  };
  
  // Componente para seleção de usuário (apenas para admin)
  const UserSelector = () => {
    if (!isAdmin) return null;
    
    return (
      <div className="mb-4 bg-[#1a1a1a] rounded-lg p-3 border border-gray-800">
        <h3 className="text-sm font-medium mb-2 text-gray-300">Usuários</h3>
        <div className="space-y-1 max-h-40 overflow-y-auto">
          {chatUsers.map((user) => (
            <button
              key={user.id}
              className={`w-full text-left p-2 rounded-md text-sm transition-colors ${
                selectedUserId === user.id
                  ? 'bg-gradient-to-r from-[#1a86c7] to-[#3bc37a]'
                  : 'bg-[#222222] hover:bg-[#2a2a2a]'
              }`}
              onClick={() => onUserChange && onUserChange(user.id)}
            >
              <div className="flex justify-between items-center">
                <div className="flex flex-col">
                  <span className="font-medium">{user.name || 'Usuário'}</span>
                  <span className="text-xs text-gray-400">{user.email}</span>
                </div>
                {user.hasNewMessages && (
                  <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                    Novo
                  </span>
                )}
              </div>
            </button>
          ))}
          
          {chatUsers.length === 0 && (
            <div className="text-sm text-gray-400 p-2">Nenhum usuário disponível</div>
          )}
        </div>
      </div>
    );
  };
  
  // Verificar se o chat está encerrado
  // Modificado para garantir que o formulário sempre esteja visível a menos que o chat esteja explicitamente finalizado
  const isChatClosed = false; // Desabilitamos a lógica de chat fechado para garantir que o formulário sempre apareça

  // Expõe o método clearChatHistory ao componente React
  const chatSupportRef = useRef<HTMLDivElement>(null);
  
  // Expor o método clearChatHistory para acesso via DOM
  useEffect(() => {
    if (chatSupportRef.current) {
      (chatSupportRef.current as any).clearChatHistory = clearChatHistory;
    }
  }, []);

  return (
    <div 
      ref={chatSupportRef} 
      id={id}
      className="bg-gradient-to-b from-[#0c0c14] to-[#101020] rounded-xl p-4 border border-indigo-500/20 flex flex-col shadow-lg">
      <div className="flex flex-col sm:flex-row gap-3 flex-1">
        {/* Área de seleção de usuário (apenas para admin) */}
        {isAdmin && (
          <div className="sm:w-1/3 flex flex-col">
            <UserSelector />
            
            {/* Mostrar informações do usuário selecionado */}
            {selectedUserId && <UserInfoCard userId={selectedUserId} />}
            
            {/* Botão para encerrar o chat */}
            {selectedUserId && !isChatClosed && (
              <button 
                onClick={finalizeChat}
                disabled={loading}
                className="mt-3 w-full py-2 bg-gradient-to-r from-red-600 to-red-700 text-white text-sm rounded-md transition-colors disabled:opacity-50 hover:from-red-700 hover:to-red-800 shadow-md"
              >
                Encerrar Chat
              </button>
            )}
          </div>
        )}
        
        {/* Área de mensagens e input */}
        <div className={`flex-1 flex flex-col ${isAdmin ? 'sm:w-2/3' : 'w-full'}`}>
          {/* Área de mensagens - ajustado para deixar espaço para campo de texto */}
          <div 
            id="chat-messages-container"
            className="bg-[#13131f] rounded-xl p-3 border border-indigo-500/20 mb-3 overflow-y-auto shadow-inner flex-1"
            style={{ 
              minHeight: "100px",
              maxHeight: typeof height === 'string' && height.includes('%') 
                ? 'calc(' + height + ' - 180px)' 
                : 'calc(100% - 180px)' 
            }}
          >
            {chatMessages.length > 0 ? (
              <div className="space-y-3">
                {chatMessages.map((msg, index) => {
                  // Verificar se há uma mensagem final
                  const hasFinalMessage = chatMessages.some(m => m.isFinal);
                  
                  // Se houver uma mensagem final e esta não for a mensagem final, não mostrar
                  // Só aplicamos esta lógica se não for uma nova conversa (sem o marcador 'newConversation')
                  if (hasFinalMessage && !msg.isFinal && !chatMessages.some(m => m.text === "Iniciou uma nova conversa.")) {
                    return null;
                  }
                  
                  return (
                    <div 
                      key={msg.id || index} 
                      className={`flex ${msg.sender === (isAdmin ? 'ADMIN' : 'USER') ? 'justify-end' : 'justify-start'}`}
                    >
                      <div 
                        className={`max-w-[80%] rounded-xl px-4 py-2.5 shadow-md ${
                          msg.sender === (isAdmin ? 'ADMIN' : 'USER')
                            ? 'bg-gradient-to-br from-[#4F46E5] to-[#7C3AED] text-white'
                            : msg.sender === 'SYSTEM'
                              ? msg.isFinal 
                                ? 'bg-gradient-to-r from-red-800 to-red-700 text-white border border-red-600/40' 
                                : 'bg-gradient-to-r from-amber-600 to-amber-700 text-white'
                              : 'bg-[#1e1e2d] text-gray-100 border border-indigo-500/20'
                        }`}
                      >
                        <MessageDisplay msg={msg} />
                        <div className="flex justify-between items-center mt-1">
                          <p className="text-xs opacity-70">
                            {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                          </p>
                          <p className="text-xs opacity-70 ml-2">
                            {msg.userName}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto mb-3 text-indigo-400/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <p className="text-indigo-300 text-sm font-medium mb-1">
                    {isAdmin 
                      ? 'Selecione um usuário para iniciar uma conversa'
                      : 'Bem-vindo ao Chat de Suporte'}
                  </p>
                  <p className="text-gray-400 text-xs">
                    {isAdmin 
                      ? 'Todos os usuários ativos aparecerão na lista acima'
                      : 'Estamos aqui para ajudar! Envie sua mensagem para iniciar.'}
                  </p>
                </div>
              </div>
            )}
          </div>
          
          {/* Área de entrada de mensagem ou botão de nova conversa */}
          {isChatClosed ? (
            <div className="mt-1 mb-2 text-center">
              <button 
                onClick={startNewConversation}
                disabled={loading}
                className="px-5 py-2.5 bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] text-white text-sm rounded-md hover:shadow-lg hover:from-[#4338CA] hover:to-[#6D28D9] shadow-md font-medium disabled:opacity-50 transition-all"
              >
                Iniciar Nova Conversa
              </button>
            </div>
          ) : (
            <form onSubmit={sendMessage} className="flex flex-col space-y-2 p-3 bg-[#090915] rounded-b-xl border-t border-indigo-500/30 shadow-inner min-h-[110px] sticky bottom-0">
              <div className="flex space-x-2">
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Digite sua mensagem... (Enter para enviar)"
                  rows={2}
                  className="flex-1 bg-[#13131f] border border-indigo-500/30 rounded-xl p-3 text-white resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/50 placeholder-gray-500 text-sm"
                  disabled={loading || (isAdmin && !selectedUserId)}
                  autoFocus={autoFocus}
                />
                <div className="flex flex-col space-y-2">
                  <Button 
                    type="submit" 
                    disabled={loading || message.trim() === '' || (isAdmin && !selectedUserId)}
                    className="h-10 w-10 bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] text-white rounded-full hover:shadow-lg hover:from-[#4338CA] hover:to-[#6D28D9] shadow-md font-medium disabled:opacity-50 transition-all flex items-center justify-center"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 transform rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  </Button>
                  
                  <label className="h-10 w-10 bg-gradient-to-r from-[#8B5CF6] to-[#C026D3] text-white rounded-full hover:shadow-lg hover:from-[#7C3AED] hover:to-[#A21CAF] shadow-md flex items-center justify-center cursor-pointer font-medium transition-all">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      disabled={loading || (isAdmin && !selectedUserId)}
                      className="hidden"
                    />
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </label>
                </div>
              </div>
              <p className="text-xs text-gray-400 italic">
                Use Enter para enviar. Envie comprovantes como imagens para confirmar depósitos.
              </p>
            </form>
          )}
        </div>
      </div>
      
      {/* Modal de visualização de imagem ampliada */}
      {enlargedImage && (
        <div 
          className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
          onClick={() => setEnlargedImage(null)}
        >
          <div className="relative max-w-3xl w-full max-h-[90vh] flex flex-col items-center">
            <div className="absolute top-2 right-2 z-10">
              <button 
                onClick={() => setEnlargedImage(null)} 
                className="bg-black/60 text-white p-2 rounded-full hover:bg-black/80 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="bg-black/30 border border-white/10 rounded-xl p-2 mb-2 w-full">
              <p className="text-white text-center font-medium">{enlargedImage.name}</p>
            </div>
            <img 
              src={enlargedImage.url} 
              alt={enlargedImage.name}
              className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-2xl border border-white/10" 
              onClick={(e) => e.stopPropagation()}
            />
            <div className="mt-4 flex space-x-4">
              <a 
                href={enlargedImage.url} 
                download={enlargedImage.name}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors flex items-center"
                onClick={(e) => e.stopPropagation()}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Baixar
              </a>
              <a 
                href={enlargedImage.url} 
                target="_blank"
                rel="noopener noreferrer"
                className="bg-gray-700 text-white px-4 py-2 rounded-md hover:bg-gray-800 transition-colors flex items-center"
                onClick={(e) => e.stopPropagation()}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Abrir
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 