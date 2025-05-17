# Plano de Refatoração do Projeto

Este documento detalha o plano para refatoração e melhorias no projeto, identificando problemas e propondo soluções estruturadas.

## 1. Problemas Estruturais

### 1.1. Mistura de Estruturas Next.js

**Problema**: O projeto mistura o sistema de rotas do Next.js, usando tanto `/pages` (Pages Router) quanto `/app` (App Router).

**Solução**:
- Migrar completamente para App Router
- Mover todas as páginas de `/pages` para `/app` com estrutura adequada
- Atualizar os layouts e providers

**Implementação gradual**:
1. Criar estrutura paralela em `/app`
2. Migrar uma seção funcional por vez
3. Manter redirecionamentos temporários
4. Remover código antigo quando estável

### 1.2. APIs Duplicadas

**Problema**: APIs estão distribuídas entre `/pages/api` e `/app/api`.

**Solução**:
- Consolidar todas as APIs no formato App Router (`/app/api`)
- Reorganizar por domínio funcional

**Implementação gradual**:
1. Criar novas APIs no formato Route Handlers
2. Implementar redirecionamentos temporários
3. Atualizar chamadas de API no frontend
4. Depreciar e remover antigas APIs após transição

### 1.3. Inconsistência de Idiomas

**Problema**: Mistura de português e inglês nos nomes de arquivos e diretórios.

**Solução**:
- Padronizar todos os nomes de arquivos e diretórios em inglês
- Manter textos de interface no idioma do usuário

**Arquivos a renomear**:
- `/imagens` → `/images`
- `/public/imagens` → `/public/images`
- `/app/nova-interface` → `/app/new-interface`
- `/app/novo-jogo` → `/app/new-game`

## 2. Arquivos Duplicados e Temporários

### 2.1. Arquivos Temporários

**Arquivos a remover**:
- `/src/app/nova-interface/page.tsx.bak`
- `/src/app/nova-interface/page.tsx.bak2`
- `/src/app/nova-interface/temp.txt`
- `/temp.txt`

### 2.2. Componentes de Gráficos Redundantes

**Problema**: Múltiplas implementações de gráficos com funcionalidades sobrepostas.

**Componentes afetados**:
- `AreaChart.tsx`
- `PixiAreaChart.tsx`
- `SimpleAreaChart.tsx`
- `MultiplierChart.tsx`

**Solução**:
- Criar biblioteca unificada de gráficos
- Implementar componente base com seletores de renderização
- Extrair lógica comum para utilitários compartilhados

**Estrutura proposta**:
```
/components/charts/
  - index.ts
  - AreaChart.tsx        # Componente unificado 
  - MultiplierChart.tsx  # Componente especializado
  - renderers/           # Implementações específicas
    - SVGRenderer.tsx
    - CanvasRenderer.tsx
    - PixiRenderer.tsx
  - utils/               # Funções utilitárias
  - hooks/               # React hooks compartilhados
```

## 3. Componentes Grandes

### 3.1. Refatoração do Componente de Jogo (`/app/novo-jogo/page.tsx`)

**Problema**: Componente muito grande (~2200 linhas) com múltiplas responsabilidades.

**Solução**:
- Dividir em subcomponentes menores e focados
- Extrair lógica para custom hooks
- Separar lógica de negócios da apresentação

**Estrutura proposta**:
```
/app/new-game/
  - page.tsx             # Componente principal simplificado
  - components/
    - BettingPanel.tsx   # Painel de apostas
    - GameDisplay.tsx    # Exibição do jogo
    - CashoutButton.tsx  # Botão de cashout
    - StatsPanel.tsx     # Painel de estatísticas
  - hooks/
    - useGameSocket.ts   # Gerenciamento de socket
    - useBetting.ts      # Lógica de apostas
    - useMultiplier.ts   # Lógica do multiplicador
```

### 3.2. Refatoração do Componente de Chat (`/components/ChatSupport.tsx`)

**Problema**: Componente grande (~600 linhas) com múltiplas responsabilidades.

**Solução**:
- Dividir em subcomponentes para cada seção
- Extrair lógica para custom hooks
- Utilizar Context API para estado compartilhado

**Estrutura proposta**:
```
/components/chat/
  - ChatSupport.tsx      # Componente principal simplificado
  - MessageDisplay.tsx   # Exibição de mensagens
  - UserSelector.tsx     # Seletor de usuário
  - MessageInput.tsx     # Entrada de mensagem
  - hooks/
    - useChatMessages.ts # Gerenciamento de mensagens
    - useChatUsers.ts    # Gerenciamento de usuários
```

## 4. Prioridades de Implementação

1. **Alta prioridade**:
   - Remover arquivos temporários e backup
   - Refatorar componentes muito grandes
   - Consolidar implementações de gráficos

2. **Média prioridade**:
   - Padronizar nomes de arquivos/diretórios em inglês
   - Migrar APIs para App Router

3. **Baixa prioridade**:
   - Migrar completamente para App Router
   - Reorganizar estrutura de diretórios

## 5. Conclusão

Este plano de refatoração visa melhorar a manutenibilidade, consistência e qualidade do código, permitindo implementações graduais para minimizar regressões. Cada mudança deve ser testada individualmente antes de prosseguir para a próxima etapa.