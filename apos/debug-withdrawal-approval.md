# Debug Guide: Withdrawal Approval

## Problema Relatado
Erro 500 ao clicar em "Aprovar" no painel admin

## Correções Implementadas

### 1. API `/api/admin/transactions/update-status`
- Adicionado logging detalhado
- Uso de `select` para evitar campos não existentes no banco
- Transação do banco para garantir atomicidade
- Melhor tratamento de erros

### 2. Frontend Admin Panel
- Console.log para debug
- Mensagens de erro/sucesso mais claras
- Refresh automático após sucesso
- Loading state durante atualização

### 3. React Warning
- Corrigido warning sobre `fetchPriority`
- Adicionado prop `priority` no Image component

## Como Debugar

1. **Abra o Console do Navegador**
   - Você verá logs como:
   ```
   Atualizando status da transação: {transactionId: "xxx", status: "COMPLETED"}
   ```

2. **Verifique o Terminal do Servidor**
   - Procure por logs como:
   ```
   Recebendo requisição para atualizar status: {...}
   Buscando transação: xxx
   Transação encontrada: {...}
   Status da transação xxx atualizado para COMPLETED
   ```

3. **Se Houver Erro**
   - O erro será logado com detalhes:
   ```
   Erro ao atualizar status da transação: [erro]
   Detalhes do erro: {
     message: "...",
     stack: "...",
     name: "..."
   }
   ```

## Possíveis Causas do Erro 500

1. **Campo não existe no banco**
   - Solução: API agora usa `select` explícito

2. **Transação não encontrada**
   - Verifica se o ID está correto
   - Logs mostrarão "Transação não encontrada"

3. **Erro de permissão**
   - Verifica se usuário é admin
   - Logs mostrarão erro 403

4. **Erro de constraint do banco**
   - Possivelmente tentando atualizar para status inválido
   - Logs mostrarão detalhes específicos

## Teste Manual

1. **Como Admin:**
   ```javascript
   // No console do navegador (logado como admin)
   fetch('/api/admin/transactions/update-status', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({
       transactionId: 'ID_DA_TRANSACAO_AQUI',
       status: 'COMPLETED'
     })
   }).then(r => r.json()).then(console.log).catch(console.error)
   ```

2. **Verificar Transação:**
   ```javascript
   // Listar saques pendentes
   fetch('/api/admin/transactions?type=WITHDRAWAL')
     .then(r => r.json())
     .then(data => console.log(data.filter(t => t.status === 'PENDING')))
   ```

## Fluxo Correto

1. User cria saque → Status: PENDING
2. Admin vê saque na lista
3. Admin clica "Aprovar"
4. API atualiza status → COMPLETED
5. UI mostra sucesso
6. Lista é atualizada automaticamente

## Verificações Finais

- [ ] Console do navegador mostra logs
- [ ] Terminal do servidor mostra logs
- [ ] Erro específico é identificado
- [ ] Transação tem status atualizado
- [ ] UI reflete a mudança

Se o erro persistir após estas correções, o problema pode estar na estrutura do banco de dados ou em constraints específicas.