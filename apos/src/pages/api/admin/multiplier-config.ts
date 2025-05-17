import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import { prisma } from '@/lib/prisma';

// Definir interface para as configurações do jogo
interface MultiplierConfig {
  profitMargin: number;         // Margem de lucro da casa (%)
  initialMultiplier: number;    // Multiplicador inicial
  maxMultiplier: number;        // Multiplicador máximo
  minMultiplier: number;        // Multiplicador mínimo
  bettingPhaseDuration: number; // Duração da fase de apostas (ms)
  roundDuration: number;        // Duração da rodada (ms)
  aboveOneProbability: number;  // Probabilidade de resultado acima de 1.0 (0-1)
  volatility: number;           // Volatilidade (0-1)
  crashProbability: number;     // Probabilidade de quebra (0-1)
  trendStrength: number;        // Força das tendências (0-1)
}

// Valores padrão das configurações
const defaultConfig: MultiplierConfig = {
  profitMargin: 5,
  initialMultiplier: 1.0,
  maxMultiplier: 2.0,
  minMultiplier: 0.0,
  bettingPhaseDuration: 5000,
  roundDuration: 20000,
  aboveOneProbability: 0.3,
  volatility: 0.75,
  crashProbability: 0.25,
  trendStrength: 0.7
};

// Validar as configurações do jogo
function validateConfig(config: Partial<MultiplierConfig>): string | null {
  // Validar margem de lucro (0-15%)
  if (config.profitMargin !== undefined && (config.profitMargin < 0 || config.profitMargin > 15)) {
    return 'Margem de lucro deve estar entre 0% e 15%';
  }

  // Validar multiplicadores
  if (config.initialMultiplier !== undefined && (config.initialMultiplier < 0 || config.initialMultiplier > 2)) {
    return 'Multiplicador inicial deve estar entre 0 e 2';
  }
  
  if (config.maxMultiplier !== undefined && (config.maxMultiplier < 1 || config.maxMultiplier > 10)) {
    return 'Multiplicador máximo deve estar entre 1 e 10';
  }
  
  if (config.minMultiplier !== undefined && (config.minMultiplier < 0 || config.minMultiplier > 1)) {
    return 'Multiplicador mínimo deve estar entre 0 e 1';
  }
  
  // Validar durações (mínimo 1s, máximo 60s)
  if (config.bettingPhaseDuration !== undefined && 
     (config.bettingPhaseDuration < 1000 || config.bettingPhaseDuration > 60000)) {
    return 'Duração da fase de apostas deve estar entre 1s e 60s';
  }
  
  if (config.roundDuration !== undefined && 
     (config.roundDuration < 1000 || config.roundDuration > 60000)) {
    return 'Duração da rodada deve estar entre 1s e 60s';
  }
  
  // Validar probabilidades (0-1)
  if (config.aboveOneProbability !== undefined && 
     (config.aboveOneProbability < 0 || config.aboveOneProbability > 1)) {
    return 'Probabilidade de valor acima de 1.0 deve estar entre 0 e 1';
  }
  
  if (config.volatility !== undefined && 
     (config.volatility < 0 || config.volatility > 1)) {
    return 'Volatilidade deve estar entre 0 e 1';
  }
  
  if (config.crashProbability !== undefined && 
     (config.crashProbability < 0 || config.crashProbability > 1)) {
    return 'Probabilidade de quebra deve estar entre 0 e 1';
  }
  
  if (config.trendStrength !== undefined && 
     (config.trendStrength < 0 || config.trendStrength > 1)) {
    return 'Força das tendências deve estar entre 0 e 1';
  }
  
  return null; // Configuração válida
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Verificar autenticação de administrador
  const session = await getServerSession(req, res, authOptions);
  
  if (!session || session.user.role !== 'ADMIN') {
    return res.status(401).json({ message: 'Não autorizado. Apenas administradores podem acessar.' });
  }
  
  // Verificar se o modelo SystemConfig existe
  const hasSystemConfig = 'systemConfig' in prisma;
  // Verificar se o modelo HouseBalance existe
  const hasHouseBalance = 'houseBalance' in prisma;
  
  // Lidar com GET - Buscar configurações atuais
  if (req.method === 'GET') {
    try {
      // Buscar configurações avançadas na tabela SystemConfig
      let advancedConfig: MultiplierConfig = { ...defaultConfig };
      
      if (hasSystemConfig) {
        try {
          // @ts-ignore - Ignorar erro de tipo pois já verificamos a existência
          const configRecord = await prisma.systemConfig.findFirst({
            where: { key: 'multiplier_config' }
          });
          
          if (configRecord) {
            advancedConfig = {
              ...defaultConfig,
              ...JSON.parse(configRecord.value)
            };
          }
        } catch (err) {
          console.error('Erro ao buscar SystemConfig:', err);
        }
      }
      
      // Buscar margem de lucro e saldo na tabela HouseBalance
      let houseConfig = {
        profitMargin: defaultConfig.profitMargin,
        balance: 100000
      };
      
      if (hasHouseBalance) {
        try {
          // @ts-ignore - Ignorar erro de tipo pois já verificamos a existência
          const houseBalance = await prisma.houseBalance.findFirst({
            where: { gameType: "multiplicador" }
          });
          
          if (houseBalance) {
            houseConfig = {
              profitMargin: houseBalance.profitMargin,
              balance: houseBalance.balance
            };
            
            // Garantir que a profitMargin está sincronizada
            advancedConfig.profitMargin = houseBalance.profitMargin;
          }
        } catch (err) {
          console.error('Erro ao buscar HouseBalance:', err);
        }
      }
      
      // Mesclar configurações e retornar
      return res.status(200).json({
        ...advancedConfig,
        ...houseConfig,
        gameType: "multiplicador"
      });
    } catch (error) {
      console.error('Erro ao buscar configurações do jogo Multiplicador:', error);
      return res.status(500).json({ message: 'Erro interno do servidor' });
    }
  }
  
  // Lidar com POST - Atualizar configurações
  if (req.method === 'POST') {
    try {
      const updates = req.body;
      
      // Validar configurações
      const validationError = validateConfig(updates);
      if (validationError) {
        return res.status(400).json({ message: validationError });
      }
      
      // Atualizar configurações avançadas na tabela SystemConfig
      let advancedConfig = { ...defaultConfig };
      let configId = null;
      
      if (hasSystemConfig) {
        try {
          // Buscar configuração existente
          // @ts-ignore - Ignorar erro de tipo pois já verificamos a existência
          const configRecord = await prisma.systemConfig.findFirst({
            where: { key: 'multiplier_config' }
          });
          
          if (configRecord) {
            // Mesclar com a configuração existente
            advancedConfig = {
              ...defaultConfig,
              ...JSON.parse(configRecord.value),
              ...updates
            };
            configId = configRecord.id;
            
            // Atualizar configuração
            // @ts-ignore - Ignorar erro de tipo pois já verificamos a existência
            await prisma.systemConfig.update({
              where: { id: configId },
              data: { value: JSON.stringify(advancedConfig) }
            });
          } else {
            // Mesclar com a configuração padrão
            advancedConfig = {
              ...defaultConfig,
              ...updates
            };
            
            // Criar nova configuração
            // @ts-ignore - Ignorar erro de tipo pois já verificamos a existência
            const newConfig = await prisma.systemConfig.create({
              data: {
                key: 'multiplier_config',
                value: JSON.stringify(advancedConfig)
              }
            });
            
            configId = newConfig.id;
          }
        } catch (err) {
          console.error('Erro ao acessar SystemConfig:', err);
        }
      }
      
      // Se a margem de lucro for atualizada, também atualizar na tabela HouseBalance
      if (updates.profitMargin !== undefined && hasHouseBalance) {
        try {
          // Buscar ou criar registro
          // @ts-ignore - Ignorar erro de tipo pois já verificamos a existência
          const houseBalance = await prisma.houseBalance.findFirst({
            where: { gameType: "multiplicador" }
          });
          
          if (houseBalance) {
            // Atualizar configuração existente
            // @ts-ignore - Ignorar erro de tipo pois já verificamos a existência
            await prisma.houseBalance.update({
              where: { id: houseBalance.id },
              data: { profitMargin: updates.profitMargin }
            });
          } else {
            // Criar nova configuração
            // @ts-ignore - Ignorar erro de tipo pois já verificamos a existência
            await prisma.houseBalance.create({
              data: {
                gameType: "multiplicador",
                profitMargin: updates.profitMargin,
                balance: 100000 // Saldo inicial padrão
              }
            });
          }
        } catch (err) {
          console.error('Erro ao acessar HouseBalance:', err);
        }
      }
      
      // Gerar resposta
      return res.status(200).json({
        success: true,
        message: 'Configurações do jogo atualizadas com sucesso',
        data: advancedConfig
      });
    } catch (error) {
      console.error('Erro ao atualizar configurações do jogo Multiplicador:', error);
      return res.status(500).json({ message: 'Erro interno do servidor' });
    }
  }
  
  // Método não permitido
  return res.status(405).json({ message: 'Método não permitido' });
} 