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

  // Verificar se o usuário é administrador
  if (!session || session.user.role !== 'ADMIN') {
    return res.status(401).json({ message: 'Não autorizado. Apenas administradores podem acessar.' });
  }

  if (req.method === 'GET') {
    try {
      const { email } = req.query;

      if (!email || typeof email !== 'string') {
        return res.status(400).json({ message: 'Email é obrigatório' });
      }

      console.log('Buscando usuário pelo email:', email);
      
      // Buscar usuário no banco de dados
      const user = await prisma.user.findUnique({
        where: { email },
        select: {
          id: true,
          email: true,
          name: true,
          balance: true,
          role: true
        }
      });

      if (!user) {
        return res.status(404).json({ message: 'Usuário não encontrado' });
      }

      return res.status(200).json(user);
    } catch (error) {
      console.error('Erro ao buscar usuário:', error);
      return res.status(500).json({ message: 'Erro interno do servidor' });
    }
  }

  return res.status(405).json({ message: 'Método não permitido' });
} 