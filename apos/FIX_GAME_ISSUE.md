# Guia de Correção - Jogo New Game

## Problema Relatado
O jogo na página new-game parou de funcionar após as últimas alterações

## Possíveis Causas

### 1. Erro de Socket.io
**Sintomas:**
- Mensagens de erro no console sobre socket.io
- GET http://localhost:3000/socket.io 404 (Not Found)

**Solução:**
1. Verificar se o servidor está rodando corretamente
2. Inicializar o socket ao iniciar o servidor

### 2. Problema com APIs
**Sintomas:**
- Erro ao fazer apostas
- Saldo não atualiza

**Solução:**
1. Verificar se todas as APIs estão funcionando
2. Testar endpoints individualmente

### 3. Alterações no Sistema de Transações
**Sintomas:**
- Erro ao criar transações
- Campo não existe no banco

**Solução:**
1. Usar select específico nas queries
2. Evitar campos opcionais

## Passos para Diagnosticar

### 1. Abrir o Console do Navegador
Procure por erros como:
- Socket connection errors
- API fetch errors
- Component render errors

### 2. Verificar Network Tab
- Veja se requisições estão falhando
- Verifique status codes
- Observe payloads

### 3. Testar Manualmente

#### Testar Socket:
```javascript
// No console do navegador
const socket = io();
socket.on('connect', () => console.log('Socket conectado!'));
socket.emit('connect-multiplier');
```

#### Testar API de Saldo:
```javascript
fetch('/api/user/balance')
  .then(r => r.json())
  .then(data => console.log('Saldo:', data))
```

#### Testar Estado do Jogo:
```javascript
fetch('/api/socket-multiplier')
  .then(r => r.text())
  .then(data => console.log('Socket multiplier:', data))
```

## Correções Aplicadas

### 1. API de Transações
- Modificada para usar select específico
- Evita campos não existentes

### 2. Socket Implementation
- Verifica se já existe instância global
- Evita múltiplas conexões

### 3. Balance Updates
- Usa refreshBalance após operações
- Força atualização visual

## Como Verificar se Está Funcionando

1. **Socket Conectado**: Deve aparecer no console "Conectado ao servidor Socket.IO"
2. **Estado do Jogo**: Deve receber "Estado do jogo recebido"
3. **Multiplicador**: Deve mostrar "Multiplicador atualizado"
4. **Apostas**: Deve confirmar "Aposta confirmada"
5. **CashOut**: Deve confirmar "CashOut confirmado"

## Script de Teste

Abra o arquivo `test-game-functionality.html` no navegador para:
1. Testar APIs
2. Testar Socket
3. Testar Saldo
4. Verificar Endpoints

## Se o Problema Persistir

1. **Reiniciar o Servidor**:
   ```bash
   npm run dev
   ```

2. **Verificar Logs do Servidor**:
   - Procure por erros de inicialização
   - Verifique se socket está sendo criado

3. **Limpar Cache**:
   - Clear browser cache
   - Hard refresh (Ctrl+F5)

4. **Verificar Dependências**:
   ```bash
   npm install
   ```

## Logs Importantes

### No Navegador:
- "Conectado ao servidor Socket.IO"
- "Estado do jogo recebido"
- "Mudança de fase"
- "Multiplicador atualizado"

### No Servidor:
- "[SOCKET] Servidor Socket.IO inicializado"
- "Cliente conectado ao multiplicador"
- "Aposta recebida"
- "Cash out realizado"

## Alterações que Podem ter Afetado

1. Sistema de transações modificado
2. API de saldo alterada
3. Sistema de recargas atualizado
4. Tratamento de erros melhorado

Se nenhuma dessas soluções funcionar, o problema pode estar na inicialização do servidor Socket.IO.