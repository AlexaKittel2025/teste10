import { NextApiRequest, NextApiResponse } from 'next';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  try {
    // Verificação simples - apenas em desenvolvimento
    // Em produção, adicione uma camada de segurança mais robusta
    const { name, email, password, secretKey } = req.body;

    // Segredo para proteção básica
    if (secretKey !== process.env.ADMIN_SECRET_KEY && secretKey !== 'green-game-admin-secret') {
      return res.status(401).json({ message: 'Não autorizado' });
    }

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Dados incompletos' });
    }

    // Verificar se o usuário já existe
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(400).json({ message: 'Email já cadastrado' });
    }

    // Gerar hash da senha
    const hashedPassword = await bcrypt.hash(password, 10);

    // Criar usuário administrador
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: 'ADMIN',
      },
    });

    console.log('Usuário administrador criado com sucesso:', user.id);
    const { password: _, ...userWithoutPassword } = user;
    return res.status(201).json(userWithoutPassword);
  } catch (error) {
    console.error('ERRO AO CRIAR USUÁRIO ADMIN:', error);
    return res.status(500).json({ 
      message: 'Erro interno do servidor',
      error: error instanceof Error ? error.message : String(error)
    });
  }
} 