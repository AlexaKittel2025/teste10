-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN "pixCode" TEXT;
ALTER TABLE "Transaction" ADD COLUMN "pixExpiration" TIMESTAMP(3);
ALTER TABLE "Transaction" ADD COLUMN "externalId" TEXT;
ALTER TABLE "Transaction" ADD COLUMN "paymentUrl" TEXT;
ALTER TABLE "Transaction" ADD COLUMN "qrCodeImage" TEXT;

-- CreateTable
CREATE TABLE "PaymentNotification" (
  "id" TEXT NOT NULL,
  "transactionId" TEXT NOT NULL,
  "externalId" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "payload" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentNotification_transactionId_key" ON "PaymentNotification"("transactionId");

-- AddForeignKey
ALTER TABLE "PaymentNotification" ADD CONSTRAINT "PaymentNotification_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;