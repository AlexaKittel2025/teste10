-- Verificar se a tabela RewardRedemption existe
-- Se não existir, criar a tabela
CREATE TABLE IF NOT EXISTS "RewardRedemption" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rewardId" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RewardRedemption_pkey" PRIMARY KEY ("id")
);

-- Adicionar índices se não existirem
CREATE INDEX IF NOT EXISTS "RewardRedemption_userId_idx" ON "RewardRedemption"("userId");
CREATE INDEX IF NOT EXISTS "RewardRedemption_rewardId_idx" ON "RewardRedemption"("rewardId");

-- Adicionar foreign keys se não existirem
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'RewardRedemption_userId_fkey'
    ) THEN
        ALTER TABLE "RewardRedemption" ADD CONSTRAINT "RewardRedemption_userId_fkey" 
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'RewardRedemption_rewardId_fkey'
    ) THEN
        ALTER TABLE "RewardRedemption" ADD CONSTRAINT "RewardRedemption_rewardId_fkey" 
        FOREIGN KEY ("rewardId") REFERENCES "Reward"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;