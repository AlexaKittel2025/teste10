# Debug Guide: Sistema de Recarga de Saldo

## Problema Relatado
Erro 500 ao clicar em "Adicionar Saldo" no painel admin

## Correções Implementadas

### 1. API `/api/admin/recharge`
- Adicionado logging detalhado com prefixo `[RECHARGE API]`
- Melhor validação de entrada
- Conversão de string para número no amount
- Transação de banco para garantir consistência
- Mensagens de erro específicas

### 2. Frontend Admin Panel
- Validação antes de enviar requisição
- Console.log com prefixo `[ADMIN]`
- Mensagens de erro mais claras
- Reset do campo após sucesso
- Melhor tratamento de erros de conexão

## Como Debugar

### 1. Console do Navegador
Ao clicar em "Adicionar Saldo", você verá:
```
[ADMIN] Enviando recarga: {userId: "xxx", amount: 100}
[ADMIN] Resposta recebida: 200 {user data}
```

### 2. Terminal do Servidor
Procure por logs como:
```
[RECHARGE API] Requisição recebida: POST
[RECHARGE API] Sessão: Autenticado
[RECHARGE API] Body recebido: {userId: "xxx", amount: 100}
[RECHARGE API] Adicionando R$ 100 ao usuário xxx
[RECHARGE API] Usuário encontrado: user@email.com Saldo atual: 500
[RECHARGE API] Saldo atualizado com sucesso: {user data}
```

### 3. Possíveis Erros

#### Erro 401: Not authenticated
```
[RECHARGE API] Sessão: Não autenticado
```
**Solução**: Fazer login novamente

#### Erro 403: Not admin
```
[RECHARGE API] Usuário não é admin: USER
```
**Solução**: Usar conta de administrador

#### Erro 404: User not found
```
[RECHARGE API] Usuário não encontrado: xxx
```
**Solução**: Verificar ID do usuário

#### Erro 400: Invalid input
```
ID do usuário e valor são obrigatórios
Valor deve ser um número positivo
```
**Solução**: Verificar dados enviados

#### Erro 500: Database error
```
[RECHARGE API] Erro ao adicionar saldo: [error details]
[RECHARGE API] Detalhes do erro: {message, stack, name}
```
**Solução**: Verificar estrutura do banco

## Teste Manual

### 1. Buscar Usuário
```javascript
// No console do navegador (como admin)
fetch('/api/admin/users?email=user@example.com')
  .then(r => r.json())
  .then(user => {
    console.log('User found:', user);
    window.testUserId = user.id;
  })
```

### 2. Adicionar Saldo
```javascript
// Usando o ID obtido anteriormente
fetch('/api/admin/recharge', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: window.testUserId,
    amount: 100
  })
}).then(r => r.json()).then(console.log)
```

### 3. Verificar Transação
```javascript
// Ver depósitos do usuário
fetch('/api/transactions')
  .then(r => r.json())
  .then(transactions => {
    console.log('Deposits:', 
      transactions.filter(t => t.type === 'DEPOSIT')
    );
  })
```

## Fluxo Correto

1. Admin busca usuário por email
2. Sistema mostra dados do usuário
3. Admin define valor a adicionar
4. Admin clica "Adicionar Saldo"
5. API valida e processa
6. Saldo é incrementado
7. Transação é registrada
8. UI mostra sucesso

## Verificações

- [ ] Console mostra logs `[ADMIN]`
- [ ] Terminal mostra logs `[RECHARGE API]`
- [ ] Erro específico é identificado
- [ ] Saldo do usuário é atualizado
- [ ] Transação aparece no histórico
- [ ] UI mostra mensagem de sucesso

## Problemas Comuns

### 1. Campo amount como string
**Sintoma**: Erro de validação
**Correção**: API agora converte string para número

### 2. Usuário não selecionado
**Sintoma**: Erro "Nenhum usuário selecionado"
**Correção**: Frontend valida antes de enviar

### 3. Valor zero ou negativo
**Sintoma**: Erro "Valor deve ser maior que zero"
**Correção**: Frontend valida antes de enviar

### 4. Erro de constraint do banco
**Sintoma**: Erro 500 com mensagem de constraint
**Correção**: Usar transação para garantir consistência

Se o erro persistir, verifique:
1. Logs detalhados no terminal
2. Estrutura da tabela Transaction
3. Permissões do usuário admin