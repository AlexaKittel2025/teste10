import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '../auth/[...nextauth]';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Verificar autenticação
  const session = await getServerSession(req, res, authOptions);

  if (!session || !session.user?.id) {
    return res.status(401).json({ message: 'Não autorizado. Faça login primeiro.' });
  }

  if (req.method === 'GET') {
    try {
      // Buscar usuário no banco de dados para obter o saldo atualizado
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { balance: true }
      });

      if (!user) {
        return res.status(404).json({ message: 'Usuário não encontrado' });
      }

      // Adicionar headers para evitar cache
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('Surrogate-Control', 'no-store');
      
      // Retornar o saldo com timestamp para debugar
      return res.status(200).json({ 
        balance: user.balance,
        timestamp: Date.now(),
        force: req.query.force === 'true'
      });
    } catch (error) {
      console.error('Erro ao buscar saldo do usuário:', error);
      return res.status(500).json({ message: 'Erro interno do servidor' });
    }
  }

  return res.status(405).json({ message: 'Método não permitido' });
} 