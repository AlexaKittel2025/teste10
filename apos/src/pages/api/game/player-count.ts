import { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';

// Valores mínimo e máximo permitidos
const MIN_PLAYERS = 42450;
const MAX_PLAYERS = 364000;

// Função de fallback para gerar um número de jogadores quando o DB não está disponível
function generateFallbackPlayerCount() {
  // Iniciar próximo ao mínimo para parecer realista
  const baseCount = MIN_PLAYERS * 1.05;
  // Adicionar uma variação aleatória (até 15% do intervalo)
  const maxVariation = (MAX_PLAYERS - MIN_PLAYERS) * 0.15;
  const randomVariation = Math.floor(Math.random() * maxVariation);
  return baseCount + randomVariation;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // GET: Obter contagem atual de jogadores
  if (req.method === 'GET') {
    try {
      // Verificar se o prisma está disponível
      if (!prisma) {
        console.log('Prisma não está disponível, usando fallback para contagem de jogadores');
        return res.status(200).json({
          count: generateFallbackPlayerCount(),
          lastUpdated: new Date().toISOString(),
          trend: 'up',
          changeRate: 0.01
        });
      }
      
      // Procurar a configuração existente
      let playerCountSetting;
      try {
        playerCountSetting = await prisma.settings.findFirst({
          where: { key: 'player_count' },
        });
      } catch (dbError) {
        console.error('Erro ao acessar o banco de dados:', dbError);
        return res.status(200).json({
          count: generateFallbackPlayerCount(),
          lastUpdated: new Date().toISOString(),
          trend: 'up',
          changeRate: 0.01
        });
      }

      // Se não existe, criar um valor inicial ou usar fallback se o banco de dados falhar
      if (!playerCountSetting) {
        // Gerar um número aleatório entre 42.450 e 200.000
        const initialCount = Math.floor(Math.random() * (200000 - MIN_PLAYERS)) + MIN_PLAYERS;
        
        try {
          // Salvar o valor no banco de dados
          const newSetting = await prisma.settings.create({
            data: {
              key: 'player_count',
              value: JSON.stringify({
                count: initialCount,
                lastUpdated: new Date().toISOString(),
                trend: 'up',
                changeRate: 0.03
              })
            },
          });
          
          console.log('Configuração inicial de jogadores criada:', newSetting);
        } catch (createError) {
          // Se falhar ao criar no banco de dados, ainda retornamos um valor válido
          console.error('Erro ao criar configuração inicial de jogadores:', createError);
        }
        
        // Retornar o valor inicial
        return res.status(200).json({
          count: initialCount,
          lastUpdated: new Date().toISOString(),
          trend: 'up',
          changeRate: 0.03
        });
      }
      
      // Parsear o valor existente com tratamento de erro
      let playerCountData;
      try {
        playerCountData = JSON.parse(playerCountSetting.value);
        
        // Verificar se a contagem está dentro dos limites, se não, corrigir
        if (playerCountData.count < MIN_PLAYERS) {
          console.log(`Corrigindo contagem de jogadores abaixo do mínimo: ${playerCountData.count} -> ${MIN_PLAYERS}`);
          playerCountData.count = MIN_PLAYERS;
        } else if (playerCountData.count > MAX_PLAYERS) {
          console.log(`Corrigindo contagem de jogadores acima do máximo: ${playerCountData.count} -> ${MAX_PLAYERS}`);
          playerCountData.count = MAX_PLAYERS;
        }
      } catch (parseError) {
        console.error('Erro ao parsear dados de contagem de jogadores:', parseError);
        // Usar valores padrão em caso de erro
        playerCountData = {
          count: MIN_PLAYERS + Math.floor(Math.random() * 50000),
          lastUpdated: new Date().toISOString(),
          trend: 'up',
          changeRate: 0.02
        };
      }
      
      // Verificar se é hora de atualizar (a cada 5 minutos)
      const lastUpdated = new Date(playerCountData.lastUpdated);
      const now = new Date();
      const diffInMinutes = (now.getTime() - lastUpdated.getTime()) / (1000 * 60);
      
      if (diffInMinutes >= 5) {
        // Calcular o próximo valor
        let currentCount = playerCountData.count;
        let trend = playerCountData.trend || 'up';
        let changeRate = playerCountData.changeRate || 0.02;
        
        // 15% de chance de mudar a tendência
        if (Math.random() < 0.15) {
          trend = trend === 'up' ? 'down' : 'up';
          // Ajustar a taxa de variação aleatoriamente entre 0.5% e 5%
          // Taxas menores para números maiores resultam em mudanças mais suaves
          changeRate = Math.random() * 0.045 + 0.005;
        }
        
        // Calcular a variação baseada na tendência
        const variation = currentCount * changeRate * (trend === 'up' ? 1 : -1);
        
        // Adicionar alguma aleatoriedade à variação (±20%)
        const randomFactor = Math.random() * 0.4 + 0.8; // 0.8 a 1.2
        const finalVariation = variation * randomFactor;
        
        // Para números altos, fazer uma pequena suavização para não oscilar demais
        const smoothingFactor = 1 - (currentCount / MAX_PLAYERS) * 0.3; // 0.7 a 1.0
        const smoothedVariation = finalVariation * smoothingFactor;
        
        // Calcular o novo valor
        let newCount = Math.round(currentCount + smoothedVariation);
        
        // Garantir que o valor esteja dentro dos limites
        newCount = Math.max(MIN_PLAYERS, Math.min(MAX_PLAYERS, newCount));
        
        // Se chegar perto dos limites, mudar a tendência
        // Começar a inverter a tendência antes para evitar mudanças bruscas
        if (newCount > MAX_PLAYERS * 0.85 && trend === 'up') {
          trend = 'down';
          // Reduzir a taxa de variação
          changeRate = Math.max(0.005, changeRate * 0.7);
        } else if (newCount < MIN_PLAYERS * 1.15 && trend === 'down') {
          trend = 'up';
          // Reduzir a taxa de variação
          changeRate = Math.max(0.005, changeRate * 0.7);
        }
        
        // Adicionar variação ao longo do dia (maior número de jogadores no final da tarde/noite)
        const hourOfDay = new Date().getHours();
        // Fator que favorece maior número de jogadores entre 18h e 23h
        const timeBonus = (hourOfDay >= 18 && hourOfDay <= 23) ? 1.2 : 
                         (hourOfDay >= 13 && hourOfDay < 18) ? 1.1 : 
                         (hourOfDay >= 8 && hourOfDay < 13) ? 0.95 : 0.9;
        
        if (timeBonus > 1 && newCount < MAX_PLAYERS * 0.7) {
          // Favorecer crescimento em horários de pico
          if (trend === 'up') {
            changeRate = changeRate * 1.2;
          } else if (Math.random() < 0.3) {
            trend = 'up';
          }
        } else if (timeBonus < 1 && newCount > MIN_PLAYERS * 1.5) {
          // Favorecer redução em horários de baixo movimento
          if (trend === 'down') {
            changeRate = changeRate * 1.1;
          } else if (Math.random() < 0.2) {
            trend = 'down';
          }
        }
        
        // Formatação para exibir números grandes de forma mais legível
        const formatNumber = (num) => num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
        
        console.log(
          `Contagem de jogadores atualizada: ${formatNumber(currentCount)} → ${formatNumber(newCount)} ` + 
          `(${trend}, taxa: ${changeRate.toFixed(3)}, variação: ${Math.round(smoothedVariation)})`
        );
        
        // Tente atualizar o registro no banco de dados, mas se falhar, ainda retorne o novo valor
        try {
          await prisma.settings.update({
            where: { id: playerCountSetting.id },
            data: {
              value: JSON.stringify({
                count: newCount,
                lastUpdated: now.toISOString(),
                trend,
                changeRate
              })
            }
          });
          console.log('Dados de contagem de jogadores salvos no banco de dados.');
        } catch (updateError) {
          console.error('Erro ao atualizar contagem de jogadores no banco de dados:', updateError);
          // Continua e retorna o novo valor mesmo se o banco de dados falhar
        }
        
        // Retornar o novo valor
        return res.status(200).json({
          count: newCount,
          lastUpdated: now.toISOString(),
          trend,
          changeRate
        });
      }
      
      // Se não for hora de atualizar, verificar se está dentro dos limites antes de retornar
      // Garantir que mesmo os valores armazenados respeitem os limites 
      if (playerCountData.count < MIN_PLAYERS) {
        console.log(`Ajustando contagem armazenada abaixo do mínimo: ${playerCountData.count} -> ${MIN_PLAYERS}`);
        playerCountData.count = MIN_PLAYERS;
      } else if (playerCountData.count > MAX_PLAYERS) {
        console.log(`Ajustando contagem armazenada acima do máximo: ${playerCountData.count} -> ${MAX_PLAYERS}`);
        playerCountData.count = MAX_PLAYERS;
      }
      
      return res.status(200).json(playerCountData);
      
    } catch (error) {
      console.error('Erro ao obter contagem de jogadores:', error);
      // Mesmo em caso de erro geral, retornar um valor válido em vez de um erro 500
      return res.status(200).json({
        count: MIN_PLAYERS + Math.floor(Math.random() * 50000),
        lastUpdated: new Date().toISOString(),
        trend: 'up',
        changeRate: 0.02
      });
    }
  }
  
  // Método não permitido
  return res.status(405).json({ error: 'Método não permitido' });
}