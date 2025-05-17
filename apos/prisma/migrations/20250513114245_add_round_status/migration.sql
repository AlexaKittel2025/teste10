-- CreateEnum
CREATE TYPE "RoundStatus" AS ENUM ('BETTING', 'RUNNING', 'FINISHED');

-- AlterTable
ALTER TABLE "Round" ADD COLUMN     "status" "RoundStatus" NOT NULL DEFAULT 'BETTING';
