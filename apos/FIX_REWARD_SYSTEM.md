# Correção do Sistema de Recompensas

## Problema Relatado
1. Imagens de níveis e recompensas retornando 404
2. Erro ao resgatar recompensa: "Ocorreu um erro ao processar o resgate da recompensa"

## Soluções Implementadas

### 1. Imagens Faltando
Criar placeholder images executando:
```bash
node create-missing-images.js
```

Este script criará imagens placeholder em:
- `/public/images/levels/`
- `/public/images/rewards/`

### 2. Sistema de Resgate

#### Estrutura do Sistema
- `levelSystem.ts`: Sistema completo de níveis e recompensas
- `gameRewardsIntegration.ts`: Integração com o jogo
- API de resgate: `/api/user/rewards/redeem`

#### Verificações ao Resgatar Recompensa
1. Usuário autenticado
2. Recompensa existe
3. Usuário tem nível suficiente
4. Usuário tem pontos suficientes
5. Recompensa está ativa

#### Tipos de Recompensa Suportados
- `FREE_BET`: Aposta gratuita (adiciona ao saldo)
- `CASH_BONUS`: Bônus em dinheiro (adiciona ao saldo)
- `MULTIPLIER_BOOST`: Boost de multiplicador (não implementado ainda)
- `DAILY_LIMIT_BOOST`: Boost de limite diário (não implementado ainda)

## Integração com o Jogo

### 1. Aplicar Bônus no Cash Out
```typescript
import { applyCashOutBonus } from '@/lib/gameRewardsIntegration';

// No momento do cash out
const result = await applyCashOutBonus(userId, betAmount, multiplier);
// result.totalAmount incluirá o bônus de nível
```

### 2. Processar Recompensas Após Aposta
```typescript
import { processBetRewards } from '@/lib/gameRewardsIntegration';

// Após uma aposta ser finalizada
const rewards = await processBetRewards(userId, bet, isWin);
// rewards incluirá XP e pontos ganhos
```

## Como Testar

### 1. Verificar Imagens
No console do navegador:
```javascript
// Verificar se imagens estão acessíveis
fetch('/images/levels/level4.png').then(r => console.log('Level image:', r.status));
fetch('/images/rewards/free_bet.png').then(r => console.log('Reward image:', r.status));
```

### 2. Testar Resgate Manual
```javascript
// Testar resgate de recompensa
fetch('/api/user/rewards/redeem', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ rewardId: 'ID_DA_RECOMPENSA' })
}).then(r => r.json()).then(console.log);
```

### 3. Verificar Logs do Servidor
Procure por logs como:
```
Iniciando resgate de recompensa - Usuário: xxx, Recompensa: xxx
Recompensa a ser resgatada: {...}
Saldo antes do resgate: {...}
Resultado do resgate: {...}
Saldo após resgate: {...}
```

## Correções Necessárias no new-game

### 1. Adicionar Processamento de Recompensas
No arquivo `new-game/page.tsx`, após uma aposta ser finalizada:

```typescript
import { processBetRewards } from '@/lib/gameRewardsIntegration';

// Após cash out ou fim da rodada
const rewardResult = await processBetRewards(
  session.user.id,
  { id: betId, amount: betAmount, type: 'MULTIPLIER' },
  winAmount > 0
);

if (rewardResult.levelUp) {
  // Mostrar notificação de subida de nível
}
```

### 2. Aplicar Bônus de Nível
No momento do cash out:

```typescript
import { applyCashOutBonus } from '@/lib/gameRewardsIntegration';

const bonusResult = await applyCashOutBonus(
  session.user.id,
  betAmount,
  currentMultiplier
);

// Usar bonusResult.totalAmount em vez do cálculo simples
```

## Erros Comuns e Soluções

### Erro: "Recompensa não encontrada"
- Verificar se o ID da recompensa existe no banco
- Verificar se a inicialização do sistema foi feita

### Erro: "Pontos insuficientes"
- Verificar saldo de pontos do usuário
- Verificar custo da recompensa

### Erro: "Nível insuficiente"
- Verificar nível do usuário
- Verificar requisito de nível da recompensa

### Erro 500 na API
- Verificar logs do servidor
- Verificar estrutura do banco de dados
- Verificar transações do Prisma

## Próximos Passos

1. Criar imagens reais para níveis e recompensas
2. Implementar boosts temporários (multiplicador e limite)
3. Adicionar animações para subida de nível
4. Criar sistema de notificações de recompensas
5. Integrar completamente com a página new-game