// Armazenamento temporário de mensagens (até implementar o banco de dados)
// Este módulo exporta o array de mensagens para ser compartilhado entre endpoints

import fs from 'fs';
import path from 'path';

// Caminho para o arquivo de armazenamento de mensagens
const MESSAGES_FILE = path.join(process.cwd(), 'data', 'chat-messages.json');

// Garantir que o diretório data existe
try {
  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
} catch (error) {
  console.error('Erro ao criar diretório de dados:', error);
}

// Array para armazenar mensagens em memória
const chatMessages: any[] = [];

// Carregar mensagens do arquivo
const loadMessages = () => {
  try {
    if (fs.existsSync(MESSAGES_FILE)) {
      const data = fs.readFileSync(MESSAGES_FILE, 'utf8');
      const messages = JSON.parse(data);
      
      // Limpar o array atual e adicionar as mensagens carregadas
      chatMessages.length = 0;
      chatMessages.push(...messages);
      
      console.log(`Carregadas ${messages.length} mensagens do arquivo`);
    }
  } catch (error) {
    console.error('Erro ao carregar mensagens do arquivo:', error);
  }
};

// Salvar mensagens no arquivo
const saveMessages = () => {
  try {
    fs.writeFileSync(MESSAGES_FILE, JSON.stringify(chatMessages, null, 2), 'utf8');
  } catch (error) {
    console.error('Erro ao salvar mensagens no arquivo:', error);
  }
};

// Função para adicionar uma nova mensagem
const addMessage = (message: any) => {
  chatMessages.push(message);
  saveMessages();
  return message;
};

// Função para atualizar uma mensagem
const updateMessage = (id: string, update: any) => {
  const index = chatMessages.findIndex(msg => msg.id === id);
  if (index !== -1) {
    chatMessages[index] = { ...chatMessages[index], ...update };
    saveMessages();
    return chatMessages[index];
  }
  return null;
};

// Função para limpar mensagens antigas (mais de 24 horas)
const cleanOldMessages = () => {
  const oneDayAgo = new Date();
  oneDayAgo.setHours(oneDayAgo.getHours() - 24);
  
  const initialLength = chatMessages.length;
  const remainingMessages = chatMessages.filter(msg => {
    // Converter string para Date se necessário
    const msgTime = typeof msg.timestamp === 'string' 
      ? new Date(msg.timestamp) 
      : msg.timestamp;
    
    return msgTime > oneDayAgo;
  });

  // Limpar o array mantendo a mesma referência
  chatMessages.length = 0;
  chatMessages.push(...remainingMessages);
  
  if (initialLength !== chatMessages.length) {
    console.log(`Mensagens antigas removidas: ${initialLength - chatMessages.length}`);
    saveMessages();
  }
};

// Carregar mensagens na inicialização
loadMessages();

// Limpar mensagens antigas a cada hora
setInterval(cleanOldMessages, 60 * 60 * 1000);

const messagesStore = {
  chatMessages,
  addMessage,
  updateMessage,
  cleanOldMessages,
  saveMessages
};

export default messagesStore; 