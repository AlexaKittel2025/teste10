# Troubleshooting Guide for Withdrawal System

## Overview
The withdrawal system is already fully implemented and working as requested. Here's how it works:

1. User requests withdrawal → Creates a PENDING transaction
2. Balance is immediately deducted from user's account
3. Transaction appears in admin panel "Saques" tab
4. Admin can approve (COMPLETED) or reject (REJECTED) the withdrawal
5. If rejected, money is automatically refunded to user

## Common Issues and Solutions

### Issue 1: Error when clicking "Confirmar Saque"
**Possible causes:**
- Session expired
- Network connectivity issues
- Database connection problems

**Solutions:**
1. Check browser console for specific error messages
2. Ensure user is properly logged in
3. Check API logs for detailed error information
4. Verify database connection is active

### Issue 2: Withdrawal not appearing in admin panel
**Possible causes:**
- Transaction creation failed
- Admin not refreshing the page
- Filtering issues in admin panel

**Solutions:**
1. Click "Atualizar Transações" button in admin panel
2. Check if transaction was created in database
3. Verify admin has proper permissions

### Issue 3: Balance not updating after withdrawal
**Possible causes:**
- Frontend not refreshing balance
- Database transaction failed
- Caching issues

**Solutions:**
1. Call `refreshBalance()` after withdrawal
2. Check if balance was updated in database
3. Clear browser cache and reload page

## Testing the Withdrawal Flow

1. **Create a test withdrawal:**
   ```javascript
   // In browser console (logged in as user)
   fetch('/api/transactions', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({
       amount: 50,
       type: 'WITHDRAWAL',
       pixKey: 'test@email.com',
       method: 'pixWithdraw'
     })
   }).then(r => r.json()).then(console.log)
   ```

2. **Check withdrawal in admin panel:**
   - Navigate to Admin Panel → Saques tab
   - Look for the pending withdrawal
   - Click "Aprovar" or "Rejeitar"

3. **Verify transaction status:**
   - Return to user profile
   - Check transaction history
   - Verify balance changes

## API Endpoints

### Create Withdrawal
- **Endpoint:** `/api/transactions`
- **Method:** POST
- **Body:**
  ```json
  {
    "amount": 100,
    "type": "WITHDRAWAL",
    "pixKey": "user@email.com",
    "method": "pixWithdraw"
  }
  ```
- **Response:** Transaction object with PENDING status

### Update Withdrawal Status (Admin)
- **Endpoint:** `/api/admin/transactions/update-status`
- **Method:** POST
- **Body:**
  ```json
  {
    "transactionId": "cuid-string",
    "status": "COMPLETED" // or "REJECTED"
  }
  ```
- **Response:** Updated transaction object

### Get User Transactions
- **Endpoint:** `/api/transactions`
- **Method:** GET
- **Response:** Array of user's transactions

### Get Admin Withdrawals
- **Endpoint:** `/api/admin/transactions?type=WITHDRAWAL`
- **Method:** GET
- **Response:** Array of all withdrawals

## Database Schema
```prisma
model Transaction {
  id        String   @id @default(cuid())
  userId    String
  amount    Float
  type      TransactionType  // DEPOSIT or WITHDRAWAL
  status    TransactionStatus // PENDING, COMPLETED, REJECTED
  details   String?  // JSON string with pixKey and method
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  user      User     @relation(fields: [userId], references: [id])
}
```

## Error Messages

### User-facing errors:
- "Saldo insuficiente para este saque" - Insufficient balance
- "Valor de saque inválido" - Invalid withdrawal amount
- "Por favor, informe os dados para o saque" - Missing PIX key or bank details

### Admin-facing errors:
- "Transação não encontrada" - Transaction not found
- "Status inválido" - Invalid status provided
- "Acesso proibido" - User is not admin

## Additional Notes

- Withdrawals are always created with PENDING status
- Balance is deducted immediately when withdrawal is created
- Admin approval changes status to COMPLETED
- Admin rejection changes status to REJECTED and refunds the amount
- All transactions are logged with timestamps
- Details field stores PIX key and withdrawal method as JSON