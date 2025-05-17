import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '../auth/[...nextauth]';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Verificar autenticação
  const session = await getServerSession(req, res, authOptions);

  if (!session || !session.user?.id) {
    return res.status(401).json({ message: 'Não autorizado. Faça login primeiro.' });
  }

  // Aceitar somente método POST
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  try {
    const { name, phone, address } = req.body;
    
    // Log detalhado dos dados recebidos
    console.log('Dados recebidos para atualização:', { name, phone, address });
    
    // Validar dados
    if (name !== undefined && (typeof name !== 'string' || name.trim().length < 2)) {
      return res.status(400).json({ message: 'O nome deve ter pelo menos 2 caracteres' });
    }

    // Se nenhum dado válido foi fornecido
    if (name === undefined && phone === undefined && address === undefined) {
      return res.status(400).json({ message: 'Nenhum dado válido para atualização' });
    }

    // Buscar usuário atual para comparar com os novos dados
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { name: true, phone: true, address: true }
    });

    if (!currentUser) {
      return res.status(404).json({ message: 'Usuário não encontrado' });
    }

    // Verificar se há mudanças reais para persistir
    const hasChanges = 
      (name !== undefined && name !== currentUser.name) ||
      (phone !== undefined && phone !== currentUser.phone) ||
      (address !== undefined && address !== currentUser.address);

    if (!hasChanges) {
      return res.status(200).json({
        ...currentUser,
        id: session.user.id,
        email: session.user.email,
        isPersisted: true,
        message: 'Nenhuma alteração detectada'
      });
    }

    console.log(`Atualizando dados do usuário ${session.user.id}:`, { name, phone, address });

    // Criar objeto com os dados a serem atualizados
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (phone !== undefined) updateData.phone = phone;
    if (address !== undefined) updateData.address = address;

    // Atualizar os dados do usuário no banco de dados
    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        address: true
      }
    });

    console.log('Usuário atualizado com sucesso:', updatedUser);

    return res.status(200).json({
      ...updatedUser,
      isPersisted: true,
      message: 'Dados atualizados com sucesso'
    });
  } catch (error) {
    console.error('Erro ao atualizar usuário:', error);
    return res.status(500).json({ message: 'Erro interno do servidor' });
  }
} 