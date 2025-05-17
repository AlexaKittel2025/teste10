import { NextApiRequest, NextApiResponse } from 'next';
import { serialize } from 'cookie';
import fs from 'fs';
import path from 'path';

// Caminho para o arquivo de configuração de manutenção
const maintenanceConfigPath = path.join(process.cwd(), 'data', 'maintenance.json');

// Interface para o status de manutenção
interface MaintenanceStatus {
  enabled: boolean;
  plannedEndTime: string;
  title: string;
  message: string;
}

// Função para ler o status atual da manutenção
const readMaintenanceStatus = (): MaintenanceStatus => {
  try {
    if (fs.existsSync(maintenanceConfigPath)) {
      const data = fs.readFileSync(maintenanceConfigPath, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Erro ao ler arquivo de manutenção:', error);
  }
  
  // Valores padrão caso o arquivo não exista ou tenha problemas
  return {
    enabled: false,
    plannedEndTime: '',
    title: 'Sistema em Manutenção',
    message: 'Estamos trabalhando para melhorar o sistema. Voltaremos em breve!'
  };
};

// Função para salvar o status de manutenção
const saveMaintenanceStatus = (status: MaintenanceStatus): boolean => {
  try {
    // Garantir que o diretório existe
    const dir = path.dirname(maintenanceConfigPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(maintenanceConfigPath, JSON.stringify(status, null, 2));
    return true;
  } catch (error) {
    console.error('Erro ao salvar arquivo de manutenção:', error);
    return false;
  }
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Verificar se o usuário tem permissão de administrador
  const adminToken = req.headers.authorization?.split(' ')[1];
  if (adminToken !== process.env.ADMIN_API_TOKEN) {
    return res.status(401).json({ error: 'Não autorizado' });
  }

  // GET - Obter status atual da manutenção
  if (req.method === 'GET') {
    const status = readMaintenanceStatus();
    return res.status(200).json(status);
  }
  
  // POST - Atualizar status da manutenção
  if (req.method === 'POST') {
    try {
      const { enabled, plannedEndTime, title, message } = req.body;
      
      // Validação básica
      if (typeof enabled !== 'boolean') {
        return res.status(400).json({ error: 'Campo "enabled" deve ser booleano' });
      }
      
      const status: MaintenanceStatus = {
        enabled,
        plannedEndTime: plannedEndTime || '',
        title: title || 'Sistema em Manutenção',
        message: message || 'Estamos trabalhando para melhorar o sistema. Voltaremos em breve!'
      };
      
      const success = saveMaintenanceStatus(status);
      
      if (success) {
        // Definir variáveis de ambiente em tempo de execução
        process.env.MAINTENANCE_MODE = enabled ? 'true' : 'false';
        process.env.MAINTENANCE_END_TIME = plannedEndTime || '';
        process.env.MAINTENANCE_TITLE = title || '';
        process.env.MAINTENANCE_MESSAGE = message || '';
        
        // Definir cookie para middleware
        const maintenanceCookie = serialize('maintenance-mode', enabled ? 'true' : 'false', {
          path: '/',
          httpOnly: true,
          maxAge: 60 * 60 * 24 * 30, // 30 dias
          sameSite: 'strict',
          secure: process.env.NODE_ENV === 'production'
        });
        
        res.setHeader('Set-Cookie', maintenanceCookie);
        
        return res.status(200).json({ 
          success: true, 
          message: `Modo de manutenção ${enabled ? 'ativado' : 'desativado'} com sucesso` 
        });
      } else {
        return res.status(500).json({ error: 'Falha ao salvar configuração de manutenção' });
      }
    } catch (error) {
      console.error('Erro ao processar requisição:', error);
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
  
  // Método não permitido
  return res.status(405).json({ error: 'Método não permitido' });
} 