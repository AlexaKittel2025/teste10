import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import { prisma } from '@/lib/prisma';

// Armazenamento temporário para respostas rápidas (até implementar banco de dados)
let quickReplies: {
  id: string;
  title: string;
  text: string;
  createdAt: Date;
}[] = [
  {
    id: 'qr_1',
    title: 'Boas-vindas',
    text: 'Olá! Seja bem-vindo ao suporte da GreenBet. Como posso ajudá-lo hoje?',
    createdAt: new Date()
  },
  {
    id: 'qr_2',
    title: 'Depósito PIX',
    text: 'Para realizar um depósito via PIX, por favor envie o valor desejado para a chave: contato@greenbet.com. Após a confirmação, seu saldo será atualizado em instantes.',
    createdAt: new Date()
  },
  {
    id: 'qr_3',
    title: 'Problema de saque',
    text: 'Lamento pelo inconveniente com seu saque. Vou verificar o status da transação e resolver isso para você o mais rápido possível.',
    createdAt: new Date()
  }
];

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Verificar autenticação e permissão
  const session = await getServerSession(req, res, authOptions);

  if (!session) {
    return res.status(401).json({ message: 'Não autorizado' });
  }

  // Verificar se é um admin
  if (session.user.role !== 'ADMIN') {
    return res.status(403).json({ message: 'Acesso proibido' });
  }

  // GET para listar respostas rápidas
  if (req.method === 'GET') {
    try {
      return res.status(200).json(quickReplies);
    } catch (error) {
      console.error('Erro ao listar respostas rápidas:', error);
      return res.status(500).json({ message: 'Erro interno do servidor' });
    }
  }

  // POST para criar nova resposta rápida
  if (req.method === 'POST') {
    try {
      const { title, text } = req.body;

      if (!title || !text) {
        return res.status(400).json({ message: 'Título e texto são obrigatórios' });
      }

      // Gerar ID único
      const id = `qr_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      
      // Criar nova resposta rápida
      const newReply = {
        id,
        title,
        text,
        createdAt: new Date()
      };

      // Adicionar à lista
      quickReplies.push(newReply);

      return res.status(201).json(newReply);
    } catch (error) {
      console.error('Erro ao criar resposta rápida:', error);
      return res.status(500).json({ message: 'Erro interno do servidor' });
    }
  }

  // DELETE para remover uma resposta rápida
  if (req.method === 'DELETE') {
    try {
      const { id } = req.query;

      if (!id || typeof id !== 'string') {
        return res.status(400).json({ message: 'ID é obrigatório' });
      }

      // Verificar se existe
      const replyIndex = quickReplies.findIndex(reply => reply.id === id);
      
      if (replyIndex === -1) {
        return res.status(404).json({ message: 'Resposta rápida não encontrada' });
      }

      // Remover da lista
      quickReplies = quickReplies.filter(reply => reply.id !== id);

      return res.status(200).json({ message: 'Resposta rápida removida com sucesso' });
    } catch (error) {
      console.error('Erro ao remover resposta rápida:', error);
      return res.status(500).json({ message: 'Erro interno do servidor' });
    }
  }

  return res.status(405).json({ message: 'Método não permitido' });
} 