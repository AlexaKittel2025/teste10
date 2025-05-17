# Correção do Erro de Saque

## Problema
Erro ao criar saque: `The column 'Transaction.pixCode' does not exist in the current database`

## Causa
O schema do Prisma define campos opcionais (`pixCode`, `pixExpiration`, etc.) que não existem no banco de dados atual.

## Soluções Implementadas

### 1. Modificação da API de Transações
- Modificada para usar `select` ao criar transações
- Retorna apenas campos básicos existentes
- Evita campos opcionais que podem não existir

### 2. API Alternativa de Saques
- Criada em `/api/withdrawals/create`
- Usa apenas campos básicos
- Pode ser usada como fallback

### 3. Script de Correção do Banco
Execute o script para adicionar os campos faltantes:
```bash
node fix-withdrawal-db.js
```

## Como Testar

1. Tente fazer um saque normalmente pelo perfil do usuário
2. Se ainda houver erro, execute o script de correção
3. Como última alternativa, modifique o frontend para usar `/api/withdrawals/create`

## Código Corrigido

A API de transações agora usa select para evitar campos não existentes:

```typescript
const transaction = await prisma.transaction.create({
  data: {
    amount: numericAmount,
    type,
    status,
    userId: user.id,
    details: detailsString
  },
  select: {
    id: true,
    userId: true,
    amount: true,
    type: true,
    status: true,
    details: true,
    createdAt: true,
    updatedAt: true
  }
});
```

## Resultado Esperado
- Saques criados com status PENDING
- Saldo debitado imediatamente
- Transação visível no painel admin
- Admin pode aprovar/rejeitar o saque