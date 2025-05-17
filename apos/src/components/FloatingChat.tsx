'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/Button';

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

interface FloatingChatProps {
  isOpen: boolean;
  onClose: () => void;
  onNewMessage: (hasNew: boolean) => void;
}

export default function FloatingChat({ isOpen, onClose, onNewMessage }: FloatingChatProps) {
  // Estado para mensagens e entrada de texto
  const [message, setMessage] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [enlargedImage, setEnlargedImage] = useState<{url: string, name: string} | null>(null);

  // Refs para auto-scroll
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Sessão do usuário
  const { data: session } = useSession();

  // Efeito para rolar para o final quando novas mensagens são adicionadas
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages]);

  // Efeito para inicialização - carregar mensagens quando o componente montar
  useEffect(() => {
    if (session?.user?.id && isOpen) {
      fetchMessages();
    }
  }, [session?.user?.id, isOpen]);

  // Polling para atualizações de mensagens enquanto o chat estiver aberto
  useEffect(() => {
    if (!session?.user?.id || !isOpen) return;
    
    const intervalId = setInterval(() => {
      if (document.visibilityState === 'visible' && !isUpdating) {
        fetchMessages();
      }
    }, 10000); // Atualiza a cada 10 segundos
    
    // Atualizar também quando a página voltar a ficar visível
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
  }, [session?.user?.id, isOpen, isUpdating]);
  
  // Efeito para marcar mensagens como lidas quando o chat for aberto
  useEffect(() => {
    if (session?.user?.id && isOpen) {
      markMessagesAsRead();
    }
  }, [session?.user?.id, isOpen]);

  // Buscar mensagens do servidor
  const fetchMessages = async () => {
    if (!session?.user?.id) return;
    
    try {
      setIsUpdating(true);
      
      // Armazenar mensagens locais/temporárias
      const localMessages = chatMessages.filter(msg => 
        msg.sender === 'USER' && 
        typeof msg.id === 'string' && 
        msg.id.startsWith('temp-')
      );
      
      const response = await fetch('/api/chat/messages');
      
      if (response.ok) {
        const serverMessages = await response.json();
        
        // Filtrar mensagens locais para manter apenas as que não existem no servidor
        // (considerando que uma mensagem existe no servidor se o texto for igual e o timestamp próximo)
        const filteredLocalMessages = localMessages.filter(localMsg => {
          return !serverMessages.some((serverMsg: ChatMessage) => 
            serverMsg.text === localMsg.text && 
            Math.abs(new Date(serverMsg.timestamp).getTime() - new Date(localMsg.timestamp).getTime()) < 10000
          );
        });
        
        // Combinar mensagens do servidor com mensagens locais ainda não sincronizadas
        const allMessages = [...serverMessages, ...filteredLocalMessages];
        
        // Ordenar por timestamp
        allMessages.sort((a, b) => 
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );
        
        setChatMessages(allMessages);
        
        // Verificar se há mensagens não lidas
        const hasUnreadMessages = allMessages.some(msg => 
          msg.sender !== 'USER' && msg.read === false
        );
        
        onNewMessage(hasUnreadMessages);
      }
    } catch (error) {
      console.error('Erro ao carregar mensagens:', error);
    } finally {
      setIsUpdating(false);
    }
  };
  
  // Marcar mensagens como lidas
  const markMessagesAsRead = async () => {
    if (!session?.user?.id) return;
    
    try {
      const response = await fetch('/api/chat/messages/read', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      if (response.ok) {
        // Notificar que não há mais mensagens não lidas
        onNewMessage(false);
        
        // Atualizar estado local para marcar mensagens como lidas
        setChatMessages(prev => 
          prev.map(msg => 
            msg.sender !== 'USER' && !msg.read 
              ? { ...msg, read: true } 
              : msg
          )
        );
      }
    } catch (error) {
      console.error('Erro ao marcar mensagens como lidas:', error);
    }
  };
  
  // Enviar mensagem
  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const messageText = message.trim();
    if (!messageText || !session?.user?.id) return;
    
    try {
      setLoading(true);
      
      // Limpar input imediatamente para melhor UX
      setMessage('');
      
      // Criar mensagem temporária local com ID temporário
      const tempId = 'temp-' + Date.now();
      const tempMessage: ChatMessage = {
        id: tempId,
        text: messageText,
        sender: 'USER',
        userId: session.user.id,
        userName: session.user.name || 'Você',
        timestamp: new Date(),
        read: true
      };
      
      // Adicionar à lista local imediatamente
      setChatMessages(prev => [...prev, tempMessage]);
      
      // Enviar para o servidor
      const response = await fetch('/api/chat/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: messageText
        }),
      });
      
      if (response.ok) {
        // Aguardar um momento e então atualizar as mensagens do servidor
        setTimeout(() => {
          fetchMessages();
        }, 500);
      } else {
        console.error('Erro ao enviar mensagem:', await response.text());
        // Mantemos a mensagem local mesmo se a API falhar
      }
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      // Mantemos a mensagem local mesmo se ocorrer um erro
    } finally {
      setLoading(false);
    }
  };
  
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
            fileInfo: fileInfo
          }),
        });
        
        if (messageResponse.ok) {
          // Atualizar mensagens
          fetchMessages();
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
  
  // Limpar histórico de chat
  const clearChatHistory = async () => {
    if (!session?.user?.id) return;
    
    if (!window.confirm('Tem certeza que deseja limpar todo o histórico de conversa?')) {
      return;
    }
    
    try {
      setLoading(true);
      
      // Limpar mensagens localmente primeiro
      setChatMessages([]);
      
      // Adicionar mensagem temporária do sistema indicando limpeza
      const systemMessage: ChatMessage = {
        id: 'temp-system-' + Date.now(),
        text: 'O histórico de mensagens foi limpo.',
        sender: 'SYSTEM',
        userName: 'Sistema',
        timestamp: new Date(),
        read: true
      };
      
      setTimeout(() => {
        setChatMessages([systemMessage]);
      }, 300);
      
      // Enviar solicitação para o servidor
      const response = await fetch('/api/chat/clear', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      if (response.ok) {
        // Esperar um pouco e carregar mensagens atualizadas
        setTimeout(() => {
          fetchMessages();
        }, 1000);
      } else {
        console.error('Erro ao limpar chat:', await response.text());
      }
    } catch (error) {
      console.error('Erro ao limpar histórico:', error);
    } finally {
      setLoading(false);
    }
  };
  
  // Cancelar/fechar o chat
  const handleCloseChat = () => {
    onClose();
  };
  
  // Teclas de atalho para enviar mensagem
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(e as any);
    }
  };
  
  // Renderização de mensagens individuais
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
  
  return (
    <>
      {/* Janela de chat flutuante */}
      <div className="w-full h-full flex flex-col bg-gradient-to-b from-[#0c0c14] to-[#111122] rounded-xl border border-indigo-500/30 shadow-2xl shadow-indigo-500/10 backdrop-blur-sm overflow-hidden">
        {/* Cabeçalho do chat */}
        <div className="px-4 py-3 bg-gradient-to-r from-[#1a1a46] to-[#16213e] border-b border-indigo-500/30 flex justify-between items-center">
          <div className="flex items-center">
            <div className="flex h-5 w-5 relative mr-2.5">
              <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500 m-auto"></span>
            </div>
            <h3 className="text-white font-semibold tracking-wide text-base">Chat de Suporte</h3>
          </div>
          <div className="flex space-x-3">
            <button 
              onClick={handleCloseChat}
              className="p-1 bg-gray-700/30 hover:bg-gray-600/40 rounded-full transition-colors border border-gray-600/30"
              title="Minimizar"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        </div>
        
        {/* Corpo do chat com opção para limpar */}
        <div className="flex-1 flex flex-col relative overflow-hidden">
          {/* Barra de ferramentas */}
          <div className="p-1 bg-[#13131f]/50 border-b border-indigo-500/20 flex justify-between items-center">
            <div className="text-xs text-indigo-400 font-medium pl-2">
              <span>Suporte Ao Vivo</span>
            </div>
            <div className="flex space-x-2">
              <button 
                onClick={clearChatHistory}
                className="p-1.5 bg-[#1a1a2e]/80 hover:bg-[#1a1a2e] rounded-md transition-colors border border-indigo-500/20 shadow-sm text-xs text-gray-300 flex items-center"
                title="Limpar Conversa"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Limpar
              </button>
            </div>
          </div>
          
          {/* Área de mensagens */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#0d0d15]/60">
            {chatMessages.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto mb-3 text-indigo-400/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <p className="text-indigo-300 text-sm font-medium mb-1">
                    Bem-vindo ao Chat de Suporte
                  </p>
                  <p className="text-gray-400 text-xs">
                    Estamos aqui para ajudar! Envie sua mensagem para iniciar.
                  </p>
                </div>
              </div>
            ) : (
              chatMessages.map((msg, index) => (
                <div 
                  key={msg.id || index} 
                  className={`flex ${msg.sender === 'USER' ? 'justify-end' : 'justify-start'}`}
                >
                  <div 
                    className={`max-w-[80%] rounded-xl px-4 py-2.5 shadow-md ${
                      msg.sender === 'USER'
                        ? 'bg-gradient-to-br from-[#4F46E5] to-[#7C3AED] text-white'
                        : msg.sender === 'SYSTEM'
                          ? 'bg-gradient-to-r from-amber-600 to-amber-700 text-white'
                          : 'bg-[#1e1e2d] text-gray-100 border border-indigo-500/20'
                    }`}
                  >
                    <MessageDisplay msg={msg} />
                    <div className="flex justify-between items-center mt-1">
                      <p className="text-xs opacity-70">
                        {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </p>
                      <p className="text-xs opacity-70 ml-2">
                        {msg.userName || (msg.sender === 'SYSTEM' ? 'Sistema' : 'Desconhecido')}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} /> {/* Elemento para rolar até o final */}
          </div>
          
          {/* Formulário de entrada de mensagens */}
          <form onSubmit={sendMessage} className="p-3 bg-[#090915] rounded-b-xl border-t border-indigo-500/30 shadow-inner">
            <div className="flex space-x-2">
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Digite sua mensagem... (Enter para enviar)"
                rows={2}
                className="flex-1 bg-[#13131f] border border-indigo-500/30 rounded-xl p-3 text-white resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500/50 placeholder-gray-500 text-sm"
                disabled={loading}
                autoFocus={true}
              />
              <div className="flex flex-col space-y-2">
                <Button 
                  type="submit" 
                  disabled={loading || message.trim() === ''}
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
                    disabled={loading}
                    className="hidden"
                  />
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </label>
              </div>
            </div>
          </form>
        </div>
      </div>
      
      {/* Modal para visualizar imagem ampliada */}
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
    </>
  );
}