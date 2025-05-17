import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { initializeLevelSystem } from '@/lib/levelSystem';
import { prisma } from '@/lib/prisma';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Verificar se o usuário está autenticado
    const session = await getServerSession(req, res, authOptions);
    
    if (!session || !session.user?.id) {
      console.log('Erro na inicialização de níveis: Usuário não autenticado');
      return res.status(401).json({ error: 'Não autorizado' });
    }
    
    console.log('Iniciando verificação de níveis para usuário:', session.user.id);
    
    // Verificar se o sistema já está inicializado 
    const levelCount = await prisma.playerLevel.count();
    console.log('Contagem de níveis existentes:', levelCount);
    
    // Se já há níveis cadastrados e o usuário não é admin, não permitir reinicialização
    if (levelCount > 0 && session.user.role !== 'ADMIN') {
      console.log('Sistema já inicializado e usuário não é admin. Níveis encontrados:', levelCount);
      return res.status(200).json({ 
        success: true, 
        message: `Sistema de níveis já inicializado com ${levelCount} níveis.`,
        initialized: true,
        levelCount
      });
    }
    
    console.log('Iniciando inicialização do sistema de níveis...');
    
    // Inicializar o sistema de níveis
    const totalLevels = await initializeLevelSystem();
    
    // Verificar quantos níveis foram criados
    const newLevelCount = await prisma.playerLevel.count();
    
    console.log('Inicialização concluída:', {
      newLevelCount,
      totalLevels,
      success: newLevelCount > 0
    });
    
    return res.status(200).json({ 
      success: true, 
      message: `Sistema de níveis inicializado com sucesso! ${newLevelCount} níveis disponíveis.`,
      initialized: true,
      levelCount: newLevelCount
    });
  } catch (error) {
    console.error('Erro ao inicializar sistema de níveis:', error);
    return res.status(500).json({ 
      error: 'Erro ao inicializar sistema de níveis',
      initialized: false
    });
  }
} 