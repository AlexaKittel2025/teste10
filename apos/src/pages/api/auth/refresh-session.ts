import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import { prisma } from '@/lib/prisma';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Verificar autenticação
  const session = await getServerSession(req, res, authOptions);

  if (!session || !session.user?.id) {
    return res.status(401).json({ message: 'Não autorizado. Faça login primeiro.' });
  }

  try {
    // Buscar dados atualizados do usuário no banco
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        address: true,
        role: true
      }
    });

    if (!user) {
      return res.status(404).json({ message: 'Usuário não encontrado' });
    }

    // Retornar os dados atualizados para o cliente
    return res.status(200).json({
      user,
      message: 'Dados da sessão atualizados com sucesso'
    });
  } catch (error) {
    console.error('Erro ao atualizar sessão:', error);
    return res.status(500).json({ message: 'Erro interno do servidor' });
  }
} 