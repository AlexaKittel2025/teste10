# Claude Configuration File

## Regras gerais
- Sempre revise mentalmente os efeitos da mudança antes de salvar.
- Nunca salve arquivos que causem erro de execução.
- Prefira refatorações seguras e reversíveis.
- Pergunte antes de remover código, exceto se for claramente morto.
- Avise sempre que alguma alteração exigir restart, rebuild ou update de dependências.

## Estrutura esperada
- `src/app`: páginas principais
- `src/components`: componentes reutilizáveis
- `src/hooks`: hooks customizados
- `src/utils`: funções auxiliares
- `src/styles`: arquivos de estilo

## Estilo e boas práticas
- Código limpo, sem `console.log` desnecessário
- TypeScript com tipagem explícita em props
- Componentes com no máximo 200 linhas
- Separar lógica de exibição da lógica de negócio

## Cuidados com IA
- Não sobrescreva arquivos grandes sem revisão
- Evite gerar arquivos monolíticos
- Sempre tente identificar o impacto em outros arquivos

## Ações comuns esperadas
- Refatorar arquivos grandes automaticamente
- Corrigir bugs e sugerir melhorias
- Validar rota, props e comportamento visual
- Documentar funções críticas com `/** ... */`

## Ignorar
- Pastas `node_modules`, `.next`, `public`
- Arquivos `.env*`
