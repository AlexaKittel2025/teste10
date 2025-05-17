import { NextApiRequest, NextApiResponse } from 'next';
import { parse } from 'cookie';

// Interface para o status de manutenção
interface MaintenanceStatus {
  enabled: boolean;
  plannedEndTime: string;
  title: string;
  message: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Apenas permitir método GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  try {
    // Verificar o status de manutenção a partir do cookie
    const cookies = req.headers.cookie || '';
    const parsedCookies = parse(cookies);
    const maintenanceMode = parsedCookies['maintenance-mode'] === 'true';
    
    // Usar variáveis de ambiente para informações adicionais
    // Essas são definidas pela API de administração
    const maintenanceInfo: MaintenanceStatus = {
      enabled: maintenanceMode,
      plannedEndTime: process.env.MAINTENANCE_END_TIME || '',
      title: process.env.MAINTENANCE_TITLE || 'Sistema em Manutenção',
      message: process.env.MAINTENANCE_MESSAGE || 'Estamos trabalhando para melhorar o sistema. Voltaremos em breve!'
    };
    
    // Setar cabeçalhos de cache para atualização frequente
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=120');
    
    return res.status(200).json(maintenanceInfo);
  } catch (error) {
    console.error('Erro ao processar requisição:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
} 