import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';
import os from 'os';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Apenas permitir método GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  // Verificar cabeçalho de autorização (segurança básica para dashboard de status)
  const authHeader = req.headers.authorization;
  const statusToken = process.env.STATUS_API_TOKEN;

  if (statusToken && (!authHeader || !authHeader.startsWith('Bearer ') || authHeader.split(' ')[1] !== statusToken)) {
    return res.status(401).json({ error: 'Não autorizado' });
  }

  try {
    // Coletar informações de status do sistema
    const systemStatus = {
      uptime: process.uptime(),
      timestamp: Date.now(),
      serverTime: new Date().toISOString(),
      nodeVersion: process.version,
      memoryUsage: process.memoryUsage(),
      systemResources: {
        totalMemory: os.totalmem(),
        freeMemory: os.freemem(),
        cpus: os.cpus().length,
        loadAverage: os.loadavg(),
      },
      maintenance: getMaintenanceStatus(),
      environment: process.env.NODE_ENV || 'development'
    };

    // Adicionar cabeçalhos de cache para permitir verificações frequentes
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    return res.status(200).json(systemStatus);
  } catch (error) {
    console.error('Erro ao verificar status do sistema:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
}

// Função para verificar o status de manutenção
function getMaintenanceStatus() {
  try {
    const maintenanceConfigPath = path.join(process.cwd(), 'data', 'maintenance.json');
    
    if (fs.existsSync(maintenanceConfigPath)) {
      const data = fs.readFileSync(maintenanceConfigPath, 'utf-8');
      return JSON.parse(data);
    }
    
    return { 
      enabled: false,
      configExists: false
    };
  } catch (error) {
    console.error('Erro ao verificar status de manutenção:', error);
    return { 
      enabled: false,
      error: 'Erro ao ler status',
      configExists: false
    };
  }
}