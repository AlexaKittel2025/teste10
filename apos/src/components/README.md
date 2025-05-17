# Componentes da Plataforma

Este diretório contém os componentes reutilizáveis da plataforma.

## Componentes de Apostas e Jogos

### `CashOut.tsx`
Componente para realizar Cash Out durante a fase de jogo. Exibe o valor da aposta e o potencial ganho, junto com um botão para efetivar o Cash Out.

**Props:**
- `placedBet`: Objeto com detalhes da aposta (`amount` e `timestamp`)
- `currentMultiplier`: Valor do multiplicador atual
- `isLoading`: Boolean para indicar estado de carregamento
- `onCashOut`: Função a ser chamada quando o usuário clicar em Cash Out
- `enableTooltips`: Boolean para habilitar ou desabilitar tooltips
- `className`: Classes CSS adicionais
- `currentPhase`: Fase atual do jogo ('betting', 'running', 'ended')
- `cashedOut`: Boolean que indica se o usuário já fez Cash Out nesta rodada

### `CashOutResult.tsx`
Componente para exibir o resultado após o usuário realizar um Cash Out bem-sucedido.

**Props:**
- `cashedOut`: Boolean que indica se o usuário fez Cash Out
- `cashOutMultiplier`: Multiplicador no momento do Cash Out
- `placedBet`: Objeto com detalhes da aposta
- `className`: Classes CSS adicionais

### `BetPlaced.tsx`
Componente para indicar que uma aposta foi colocada e está aguardando o início da rodada.

**Props:**
- `placedBet`: Objeto com detalhes da aposta
- `className`: Classes CSS adicionais

### `GamePhaseIndicator.tsx`
Componente para exibir a fase atual do jogo e o tempo restante.

**Props:**
- `currentPhase`: Fase atual do jogo ('betting', 'running', 'ended')
- `timeLeft`: Tempo restante em segundos
- `className`: Classes CSS adicionais
- `enableTooltips`: Boolean para habilitar ou desabilitar tooltips

### `AutoCashOutNotification.tsx`
Notificação que aparece quando um Cash Out automático é realizado.

**Props:**
- `multiplier`: Multiplicador no momento do Cash Out
- `amount`: Valor da aposta original
- `winAmount`: Valor ganho após o Cash Out
- `onClose`: Função a ser chamada quando a notificação for fechada
- `duration`: Duração em ms que a notificação será exibida (padrão: 5000ms)

## Como Usar

Exemplo de uso do componente CashOut:

```tsx
import CashOut from '@/components/CashOut';

// No seu componente
return (
  <CashOut
    placedBet={{ amount: 100, timestamp: Date.now() }}
    currentMultiplier={1.5}
    isLoading={false}
    onCashOut={async () => {
      // Lógica para fazer o cash out
      return true; // retorna true se bem-sucedido, false caso contrário
    }}
    currentPhase="running"
    cashedOut={false}
  />
);
```