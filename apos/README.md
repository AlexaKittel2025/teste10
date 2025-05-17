# Green Game

Plataforma de apostas e jogos online com suporte a PIX e múltiplos métodos de pagamento.

## Configuração do Ambiente

1. Clone o repositório:
```bash
git clone https://github.com/AlexaKittel2025/apos.git
cd apos
```

2. Instale as dependências:
```bash
npm install
```

3. Configure as variáveis de ambiente:
Crie um arquivo `.env.local` na raiz do projeto com as seguintes variáveis:

```
DATABASE_URL="postgresql://usuario:senha@localhost:5432/nome_do_banco"
NEXTAUTH_SECRET="sua-chave-secreta"
NEXTAUTH_URL="http://localhost:3000"
JWT_SECRET="sua-chave-jwt"

# Configurações para controle de manutenção
ADMIN_API_TOKEN="token-para-api-admin"
ADMIN_BYPASS_TOKEN="token-para-bypass-manutencao"
STATUS_API_TOKEN="token-para-verificacao-status"

# Configurações OpenPix (API PIX)
OPENPIX_API_URL="https://api.openpix.com.br/api/v1"
OPENPIX_API_KEY="sua-chave-api-openpix"
OPENPIX_APP_ID="seu-app-id-openpix"
OPENPIX_WEBHOOK_SECRET="seu-webhook-secret-openpix"
```

4. Execute as migrações do banco de dados:
```bash
npx prisma migrate dev
```

5. Inicie o servidor de desenvolvimento:
```bash
npm run dev
```

## Estrutura de Pastas

- `/src/app` - Componentes e páginas do App Router
- `/src/pages` - Componentes e páginas do Pages Router (legado)
- `/src/components` - Componentes reutilizáveis
- `/src/lib` - Bibliotecas e utilitários
- `/prisma` - Esquema do banco de dados e migrações

## Funcionalidades Principais

- Sistema de autenticação com Next.js e NextAuth
- Gerenciamento de saldo e transações
- Integração com API PIX para pagamentos
- Sistema de apostas em tempo real
- Chat de suporte ao cliente
- Painel administrativo

## Integração com PIX

O sistema utiliza a API da OpenPix para processar pagamentos via PIX. A integração inclui:

1. Geração de QR Code para pagamento
2. Rastreamento de status da transação
3. Confirmação automática via webhook
4. Atualização de saldo em tempo real

## Tecnologias Utilizadas

- Next.js 14
- React 18
- Prisma (ORM)
- PostgreSQL
- Socket.IO (tempo real)
- TypeScript
- TailwindCSS