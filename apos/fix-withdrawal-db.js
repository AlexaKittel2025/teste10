const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixWithdrawalDatabase() {
  console.log('🔧 Fixing withdrawal database issues...\n');
  
  try {
    // Tentar criar uma transação de teste
    console.log('Testing transaction creation...');
    
    // Verificar se as colunas existem
    const testTransaction = await prisma.$queryRaw`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'Transaction' 
      AND column_name IN ('pixCode', 'pixExpiration', 'externalId', 'paymentUrl', 'qrCodeImage')
    `;
    
    console.log('Existing columns:', testTransaction);
    
    // Se as colunas não existirem, criar
    if (testTransaction.length < 5) {
      console.log('\n⚠️  Missing columns detected. Adding them...');
      
      await prisma.$executeRaw`
        ALTER TABLE "Transaction" 
        ADD COLUMN IF NOT EXISTS "pixCode" TEXT,
        ADD COLUMN IF NOT EXISTS "pixExpiration" TIMESTAMP(3),
        ADD COLUMN IF NOT EXISTS "externalId" TEXT,
        ADD COLUMN IF NOT EXISTS "paymentUrl" TEXT,
        ADD COLUMN IF NOT EXISTS "qrCodeImage" TEXT
      `;
      
      console.log('✅ Columns added successfully!');
    } else {
      console.log('✅ All columns already exist!');
    }
    
    console.log('\n🎉 Database fixed successfully!');
    console.log('\nYou can now use the withdrawal system without issues.');
    
  } catch (error) {
    console.error('❌ Error fixing database:', error);
    console.log('\n💡 Alternative solution:');
    console.log('Use the new /api/withdrawals/create endpoint instead of /api/transactions');
    console.log('This endpoint only uses the basic fields that exist in your database.');
  } finally {
    await prisma.$disconnect();
  }
}

fixWithdrawalDatabase();