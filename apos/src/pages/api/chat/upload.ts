import { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import { IncomingForm } from 'formidable';
import fs from 'fs';
import path from 'path';

// Desabilitar o body parser do Next.js para este endpoint
export const config = {
  api: {
    bodyParser: false,
  },
};

// Armazenamento temporário de uploads (em um ambiente real, usaríamos um serviço de armazenamento)
let uploads: {
  id: string;
  userId: string;
  originalName: string;
  path: string;
  size: number;
  type: string;
  uploadedAt: Date;
}[] = [];

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Verificar autenticação
  const session = await getServerSession(req, res, authOptions);

  if (!session) {
    return res.status(401).json({ message: 'Não autorizado' });
  }

  // POST para fazer upload de arquivo
  if (req.method === 'POST') {
    return new Promise((resolve, reject) => {
      // Criar diretório de uploads se não existir
      const uploadDir = path.join(process.cwd(), 'public', 'uploads');
      
      try {
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }
      } catch (err) {
        console.error('Erro ao criar diretório de uploads:', err);
        res.status(500).json({ message: 'Erro ao processar upload' });
        return resolve(undefined);
      }

      const form = new IncomingForm({
        uploadDir,
        keepExtensions: true,
        maxFileSize: 5 * 1024 * 1024, // 5MB
      });

      form.parse(req, async (err, fields, files) => {
        if (err) {
          console.error('Erro ao fazer upload de arquivo:', err);
          res.status(500).json({ message: 'Erro ao processar upload' });
          return resolve(undefined);
        }

        try {
          const fileArray = Array.isArray(files.file) ? files.file : [files.file];
          const file = fileArray[0];

          if (!file) {
            res.status(400).json({ message: 'Nenhum arquivo enviado' });
            return resolve(undefined);
          }

          // Salvar informações do arquivo
          const fileId = `file_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
          const fileInfo = {
            id: fileId,
            userId: session.user.id,
            originalName: file.originalFilename || 'upload.jpg',
            path: `/uploads/${path.basename(file.filepath)}`,
            size: file.size,
            type: file.mimetype || 'image/jpeg',
            uploadedAt: new Date(),
          };

          uploads.push(fileInfo);

          // Retornar informações do arquivo
          res.status(200).json({
            id: fileInfo.id,
            url: fileInfo.path,
            originalName: fileInfo.originalName,
            size: fileInfo.size,
            type: fileInfo.type
          });

          return resolve(undefined);
        } catch (error) {
          console.error('Erro ao processar arquivo:', error);
          res.status(500).json({ message: 'Erro ao processar upload' });
          return resolve(undefined);
        }
      });
    });
  }

  // GET para obter informações de um arquivo
  if (req.method === 'GET') {
    try {
      const { fileId } = req.query;

      if (!fileId || typeof fileId !== 'string') {
        return res.status(400).json({ message: 'ID do arquivo é obrigatório' });
      }

      const fileInfo = uploads.find(upload => upload.id === fileId);

      if (!fileInfo) {
        return res.status(404).json({ message: 'Arquivo não encontrado' });
      }

      // Verificar se é o próprio usuário ou um admin
      const isAdmin = session.user.role === 'ADMIN';
      const isOwner = fileInfo.userId === session.user.id;

      if (!isAdmin && !isOwner) {
        return res.status(403).json({ message: 'Acesso negado a este arquivo' });
      }

      return res.status(200).json(fileInfo);
    } catch (error) {
      console.error('Erro ao buscar informações do arquivo:', error);
      return res.status(500).json({ message: 'Erro interno do servidor' });
    }
  }

  return res.status(405).json({ message: 'Método não permitido' });
} 