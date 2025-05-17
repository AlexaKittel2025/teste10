# Ao Vivo Game System Documentation

## Níveis e Recompensas

O sistema de Níveis e Recompensas foi integrado ao jogo "Ao Vivo" para proporcionar uma experiência mais envolvente aos jogadores. A integração inclui:

1. **Ganho de XP e Pontos de Fidelidade**
   - Os jogadores ganham XP e pontos de fidelidade ao fazer apostas
   - Apostas vencedoras concedem bônus de XP
   - O valor da aposta influencia a quantidade de XP e pontos ganhos

2. **Multiplicadores de Bônus baseados no Nível**
   - Jogadores de níveis mais altos recebem multiplicadores de bônus nas suas apostas
   - O multiplicador é aplicado automaticamente no momento do cash-out

3. **Notificações de Progresso**
   - Notificações de subida de nível
   - Indicadores de XP e pontos ganhos após cada aposta bem-sucedida

## Componentes Principais

- **LevelRewards**: Gerencia a exibição de notificações de subida de nível e recompensas
- **LevelUpNotification**: Exibe uma notificação quando o jogador sobe de nível
- **LevelRewardsPopup**: Mostra os pontos e XP ganhos após uma aposta bem-sucedida
- **LevelCard**: Exibe o nível atual do jogador e o progresso para o próximo nível

## API do Sistema de Níveis

- `addBetRewards(userId, bet, isWin)`: Adiciona XP e pontos de fidelidade após uma aposta
- `updateUserLevel(userId)`: Verifica e atualiza o nível do usuário com base no XP acumulado
- `getUserBonusMultiplier(userId)`: Obtém o multiplicador de bônus baseado no nível do jogador
- `redeemReward(userId, rewardId)`: Permite ao jogador resgatar uma recompensa

## Integração com o Jogo

O sistema de níveis está integrado ao jogo nos seguintes pontos:

1. **Momento do Cash-Out**
   - Quando um jogador faz cash-out, o sistema calcula e aplica o multiplicador de bônus
   - Após um cash-out bem-sucedido, o jogador recebe XP e pontos de fidelidade

2. **Mostrando Benefícios de Nível**
   - O multiplicador de bônus é exibido na interface do jogo
   - A quantidade de pontos e XP é mostrada após cada ganho

## Recursos Adicionais

- **Hook `useLevelSystem`**: Facilita a integração do sistema de níveis em qualquer componente React
- **Utilitário `gameRewardsIntegration`**: Fornece funções para aplicar recompensas e multiplicadores em jogos

## Comandos Úteis

Para depurar o sistema de níveis, você pode usar os seguintes comandos:

```bash
# Verificar se o sistema de níveis está inicializado
curl http://localhost:3000/api/system/check-levels

# Inicializar o sistema de níveis (requer autenticação de administrador)
curl -X POST http://localhost:3000/api/system/init-levels

# Verificar o nível e pontos de um usuário específico
curl http://localhost:3000/api/user/level
```

## Notas de Implementação

- O sistema de níveis usa o Prisma para interagir com o banco de dados PostgreSQL
- As transações são usadas para garantir consistência ao atualizar pontos e resgatar recompensas
- Os cálculos de XP e pontos são feitos no servidor para evitar manipulação pelo cliente