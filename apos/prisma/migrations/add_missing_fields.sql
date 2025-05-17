-- Add missing optional fields to Transaction table if they don't exist
ALTER TABLE "Transaction" 
ADD COLUMN IF NOT EXISTS "pixCode" TEXT,
ADD COLUMN IF NOT EXISTS "pixExpiration" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "externalId" TEXT,
ADD COLUMN IF NOT EXISTS "paymentUrl" TEXT,
ADD COLUMN IF NOT EXISTS "qrCodeImage" TEXT;