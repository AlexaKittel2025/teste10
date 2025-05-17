import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '../auth/[...nextauth]';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Obter sessão do usuário
  const session = await getServerSession(req, res, authOptions);

  if (!session) {
    return res.status(401).json({ message: 'Não autorizado. Faça login primeiro.' });
  }

  // Processar requisição para obter o limite atual
  if (req.method === 'GET') {
    try {
      // Tentar encontrar o usuário
      const user = await prisma.user.findUnique({
        where: { id: session.user.id }
      });

      if (!user) {
        return res.status(404).json({ message: 'Usuário não encontrado' });
      }

      // O limite diário já está diretamente no modelo User
      const userDailyLimit = user.dailyBetLimit || 5000;
      
      console.log('Obtendo limite diário de apostas:', {
        userId: user.id,
        userName: user.name,
        dailyBetLimit: userDailyLimit
      });
      
      return res.status(200).json({ dailyBetLimit: userDailyLimit });
    } catch (error) {
      console.error('Erro ao buscar limite diário:', error);
      // Em caso de erro, retornar o limite padrão
      return res.status(200).json({ dailyBetLimit: 5000 });
    }
  }

  // Processar requisição para atualizar o limite
  if (req.method === 'POST') {
    try {
      const { dailyBetLimit } = req.body;
      
      // Validar o limite informado
      const limit = parseFloat(dailyBetLimit);
      
      if (isNaN(limit) || limit < 0) {
        return res.status(400).json({ message: 'Valor de limite inválido. Por favor, informe um valor positivo.' });
      }
      
      // Definir limites mínimo e máximo permitidos
      const MIN_LIMIT = 100;    // Limite mínimo: R$ 100
      const MAX_LIMIT = 50000;  // Limite máximo: R$ 50.000
      
      if (limit < MIN_LIMIT) {
        return res.status(400).json({ message: `O limite mínimo permitido é R$ ${MIN_LIMIT.toFixed(2)}.` });
      }
      
      if (limit > MAX_LIMIT) {
        return res.status(400).json({ message: `O limite máximo permitido é R$ ${MAX_LIMIT.toFixed(2)}.` });
      }
      
      // Atualizar o limite diário do usuário
      try {
        const updatedUser = await prisma.user.update({
          where: { id: session.user.id },
          data: { dailyBetLimit: limit },
          select: { dailyBetLimit: true }
        });
        
        console.log('Limite diário atualizado com sucesso:', updatedUser);
        
        return res.status(200).json({ 
          message: 'Limite diário de apostas atualizado com sucesso',
          dailyBetLimit: updatedUser.dailyBetLimit,
          isPersisted: true
        });
      } catch (updateError) {
        console.error('Erro ao atualizar limite diário no banco de dados:', updateError);
        // Em caso de erro na persistência, informar o usuário
        return res.status(500).json({ 
          message: 'Erro ao salvar o limite no banco de dados. Por favor, tente novamente mais tarde.',
          error: updateError instanceof Error ? updateError.message : 'Erro desconhecido'
        });
      }
    } catch (error) {
      console.error('Erro ao processar a solicitação de atualização do limite diário:', error);
      return res.status(500).json({ message: 'Erro interno do servidor' });
    }
  }

  return res.status(405).json({ message: 'Método não permitido' });
} 