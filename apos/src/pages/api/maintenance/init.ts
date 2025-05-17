import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';

// Caminho para o arquivo de configuração de manutenção
const maintenanceConfigPath = path.join(process.cwd(), 'data', 'maintenance.json');

// Configuração padrão de manutenção
const defaultConfig = {
  enabled: false,
  plannedEndTime: '',
  title: 'Sistema em Manutenção',
  message: 'Estamos trabalhando para melhorar o sistema. Voltaremos em breve!'
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Apenas permitir método POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  // Verificar autorização
  const adminToken = req.headers.authorization?.split(' ')[1];
  if (adminToken !== process.env.ADMIN_API_TOKEN) {
    return res.status(401).json({ error: 'Não autorizado' });
  }

  try {
    // Verificar se o arquivo já existe
    if (fs.existsSync(maintenanceConfigPath)) {
      return res.status(200).json({ 
        message: 'Arquivo de configuração de manutenção já existe',
        exists: true 
      });
    }

    // Garantir que o diretório exists
    const dir = path.dirname(maintenanceConfigPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Criar o arquivo com a configuração padrão
    fs.writeFileSync(maintenanceConfigPath, JSON.stringify(defaultConfig, null, 2));

    return res.status(201).json({ 
      message: 'Arquivo de configuração de manutenção criado com sucesso',
      exists: false 
    });
  } catch (error) {
    console.error('Erro ao criar arquivo de manutenção:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
} 