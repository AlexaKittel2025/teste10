-- CreateEnum
CREATE TYPE "RewardType" AS ENUM ('FREE_BET', 'MULTIPLIER_BOOST', 'CASH_BONUS', 'DAILY_LIMIT_BOOST');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "daysActive" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "lastActive" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "level" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "loyaltyPoints" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totalPlayed" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "xp" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "PlayerLevel" (
    "id" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "requiredXP" INTEGER NOT NULL,
    "bonusMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "loyaltyMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "dailyBonus" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "icon" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlayerLevel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reward" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "pointsCost" INTEGER NOT NULL,
    "type" "RewardType" NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "icon" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "minimumLevel" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RewardRedemption" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rewardId" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RewardRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_RewardToUser" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "PlayerLevel_level_key" ON "PlayerLevel"("level");

-- CreateIndex
CREATE UNIQUE INDEX "_RewardToUser_AB_unique" ON "_RewardToUser"("A", "B");

-- CreateIndex
CREATE INDEX "_RewardToUser_B_index" ON "_RewardToUser"("B");

-- AddForeignKey
ALTER TABLE "_RewardToUser" ADD CONSTRAINT "_RewardToUser_A_fkey" FOREIGN KEY ("A") REFERENCES "Reward"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_RewardToUser" ADD CONSTRAINT "_RewardToUser_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
