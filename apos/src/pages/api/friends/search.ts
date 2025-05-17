import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import { searchUsersToAddAsFriends } from '@/lib/friendsService';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const session = await getServerSession(req, res, authOptions);

  if (!session) {
    return res.status(401).json({ message: 'Não autorizado. Faça login primeiro.' });
  }

  const userId = session.user.id;

  // GET - Pesquisar usuários para adicionar como amigos
  if (req.method === 'GET') {
    try {
      // Extrair parâmetros da requisição
      const { q = '', page = '1', limit = '10' } = req.query;
      
      // Validar parâmetros
      const searchTerm = String(q);
      const pageNumber = parseInt(String(page), 10) || 1;
      const limitNumber = parseInt(String(limit), 10) || 10;
      
      // Limitar o tamanho da página para evitar sobrecarga
      const validatedLimit = Math.min(limitNumber, 50);
      
      // Executar a busca
      const { users, total } = await searchUsersToAddAsFriends(
        userId,
        searchTerm,
        pageNumber,
        validatedLimit
      );
      
      // Calcular informações de paginação
      const totalPages = Math.ceil(total / validatedLimit);
      
      return res.status(200).json({
        users,
        pagination: {
          total,
          page: pageNumber,
          limit: validatedLimit,
          totalPages
        }
      });
    } catch (error) {
      console.error('Erro ao pesquisar usuários:', error);
      return res.status(500).json({ message: 'Erro ao pesquisar usuários.' });
    }
  }

  return res.status(405).json({ message: 'Método não permitido.' });
}