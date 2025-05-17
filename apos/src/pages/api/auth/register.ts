import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Método não permitido' });
  }

  try {
    console.log('========== TENTATIVA DE REGISTRO ==========');
    console.log('Corpo da requisição:', req.body);
    
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      console.error('Dados incompletos:', { name, email, password: !!password });
      return res.status(400).json({ message: 'Dados incompletos' });
    }

    console.log('Verificando se o usuário já existe');
    try {
      const existingUser = await prisma.user.findUnique({
        where: { email },
      });

      console.log('Usuário já existe?', !!existingUser);
      if (existingUser) {
        return res.status(400).json({ message: 'Email já cadastrado' });
      }
    } catch (dbError) {
      console.error('Erro ao verificar usuário existente:', dbError);
      throw dbError;
    }

    console.log('Gerando hash da senha');
    try {
      const hashedPassword = await bcrypt.hash(password, 10);
      console.log('Hash gerado com sucesso');

      console.log('Criando usuário no banco de dados');
      const user = await prisma.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
        },
      });

      console.log('Usuário criado com sucesso:', user.id);
      const { password: _, ...userWithoutPassword } = user;
      return res.status(201).json(userWithoutPassword);
    } catch (cryptoError) {
      console.error('Erro ao gerar hash ou criar usuário:', cryptoError);
      throw cryptoError;
    }
  } catch (error) {
    console.error('ERRO AO REGISTRAR USUÁRIO:', error);
    return res.status(500).json({ 
      message: 'Erro interno do servidor',
      error: error instanceof Error ? error.message : String(error)
    });
  }
} 