import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { prisma } from '@/lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Verificar a sessão do usuário (qualquer usuário autenticado pode verificar)
    const session = await getServerSession(req, res, authOptions);
    
    if (!session || !session.user?.id) {
      return res.status(401).json({ error: 'Não autorizado' });
    }
    
    // Verificar se há níveis cadastrados
    const levelCount = await prisma.playerLevel.count();
    const initialized = levelCount > 0;
    
    return res.status(200).json({
      initialized,
      levelCount,
      message: initialized 
        ? `Sistema de níveis inicializado com ${levelCount} níveis` 
        : 'Sistema de níveis não inicializado'
    });
  } catch (error) {
    console.error('Erro ao verificar sistema de níveis:', error);
    return res.status(500).json({ 
      error: 'Erro ao verificar sistema de níveis',
      initialized: false
    });
  }
} 