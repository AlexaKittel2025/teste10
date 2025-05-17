-- Esta migration adiciona os campos relacionados ao PIX na tabela Transaction
-- Execute esta migration quando for implementar o sistema de pagamento PIX

-- Adicionar as colunas à tabela Transaction se não existirem
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "pixCode" TEXT;
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "pixExpiration" TIMESTAMP(3);
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "externalId" TEXT;
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "paymentUrl" TEXT;
ALTER TABLE "Transaction" ADD COLUMN IF NOT EXISTS "qrCodeImage" TEXT;

-- Criar índice para externalId para busca mais rápida
CREATE INDEX IF NOT EXISTS "Transaction_externalId_idx" ON "Transaction"("externalId");