# Contexto atual (agentes)

> Atualizado: 2026-11-20 — ajuste de saldo não conta como entrada nem saída em lugar nenhum (movimentos, entra/sai, sobra, fontes).

## Status

`estável`

Migration `0015_pocket_categories` **aplicada** no Turso de produção (16 migrations no journal; `pocket_categories` e `pockets.category_id` existem). A `0014` já estava aplicada.

## Objetivo recente

Quatro pedidos do usuário, todos em um mesmo lote:

1. **Excluir caixinha.** Botão "excluir" dentro do modal de edição, com confirmação.
2. **Categoria de caixinha.** Lista própria, separada das categorias de compra. Campo "Categoria" no criar/editar caixinha. Lista de caixinhas agrupada por categoria.
3. **Filtrar compras por meio de pagamento.** Select no sheet de filtros: todos, conta corrente, todos os cartões, cartão específico, todas as caixinhas, caixinha específica.
4. **Ajuste de saldo não é despesa nem entrada.** Editar a conta corrente ou uma caixinha muda o saldo. Esse valor não entra no entra/sai, na sobra, na lista de movimentos nem no card de fontes. Vale no mês e no ano.

## O que mudou

- `src/db/schema/schema.ts`: tabela `pocketCategories`; `pockets.categoryId` (FK, `ON DELETE SET NULL`).
- `src/db/migrations/0015_pocket_categories.sql` + entrada `idx 15` em `meta/_journal.json`. Escrita à mão (snapshots de drizzle só existem até 0005, como nas migrations 0006–0014).
- `src/shared/lib/finance-service.ts`:
  - `getPocketBalances` devolve `categoryId` e `categoryName`.
  - `assertPocketCategoryExists`.
  - `deletePocketIfUnused`: recusa se o saldo ≠ 0 ou se há compra, depósito, depósito recorrente, recorrência, funding de fatura ou meta ligados. Se passar, apaga as `pocket_entries` (saldo zero, somam zero) e a caixinha.
  - `getPurchases`: filtros `paymentSourceType` e `paymentSourceId`.
  - `getMonthMovements`: ajustes (`balance_adjustment`) não viram linha de entrada nem de saída. Transferências continuam.
  - `computeMonthTotals` (`src/features/month/month-model.ts`, `isBalanceAdjustment`): o entra/sai/sobra do dashboard, do ano e de `/movements` ignora ajuste. A lista de `/movements` também filtra. `computeSourcesSummary` não trata ajuste como saída a cobrir.
  - `useCreateAdjustment` invalida `movements`, para o mês aberto atualizar na hora.
- `src/app/api/pockets/route.ts` (POST aceita `categoryId`) e `src/app/api/pockets/[id]/route.ts` (PATCH aceita `categoryId`; novo DELETE).
- `src/app/api/pocket-categories/route.ts` e `[id]/route.ts`: CRUD. Excluir categoria só desvincula as caixinhas.
- `src/app/api/purchases/route.ts`: lê `paymentSourceType` (validado contra o enum) e `paymentSourceId`.
- `src/shared/lib/schemas.ts`: `categoryId` em `createPocketSchema` e `updatePocketSchema`.
- `src/shared/hooks/use-finance.ts`: `PocketRow` com categoria; `useDeletePocket`; `usePocketCategories` + create/update/delete; `usePurchases` repassa o filtro de pagamento; `useUpdatePocket` envia `categoryId`.
- `src/features/pockets/pocket-management.tsx`: campo categoria; excluir no modal de edição (botão "excluir" à esquerda, como em depósitos); lista agrupada com `LedgerGroup` quando há categorias (senão lista plana como antes).
- `src/features/categories/category-management.tsx`: toggle "compras | caixinhas" no topo. Mesmo layout e modais para as duas listas.
- `src/features/purchases/purchase-list.tsx`: select "Meio de pagamento" no sheet de filtros, chip de filtro ativo, `parsePaymentFilter` converte o valor do select nos parâmetros da API.

## Decisões

- **Exclusão de caixinha é bloqueada quando há histórico ligado.** Motivo: apagar compra ou depósito ligado deixaria o histórico órfão. O usuário precisa zerar o saldo e, se houver vínculo, a exclusão não é possível. Alternativa (arquivar caixinha) não foi implementada. Se o usuário quiser "apagar mesmo assim", é uma mudança de regra de negócio.
- **Categoria de caixinha fica na tela `/categories`**, como aba "caixinhas". Não foi colocada dentro do form da caixinha para não aninhar modais.
- **Ajuste de saldo muda o saldo e só isso.** Não é entrada nem saída em nenhuma tela que soma o mês (movimentos, início, ano, fontes). O saldo da conta e da caixinha continua incluindo o ajuste, porque o número editado é o saldo.
- **Pocket categories sem `createdAt`**, igual a `categories`.
- **Visual**: sem fluxo completo de impeccable. Reaproveitei `LedgerGroup`, `LedgerRow`, `FormActions`, `Modal` e `ToggleGroup`, que já seguem o DESIGN.md.

## Ainda aberto / próximo passo

- [ ] Smoke no navegador depois do deploy: excluir caixinha vazia; tentar excluir com saldo (mensagem); criar categoria de caixinha e vincular; ver agrupamento em `/pockets`; filtro de meio de pagamento em `/purchases`; editar a conta corrente e conferir que o valor não entra no entra/sai do início nem de `/movements`.
- [ ] Lint pré-existente, aviso: `exhaustive-deps` na linha `const list` de `purchase-list.tsx`. O `set-state-in-effect` do `edit`/`new` saiu: o modal abre no render e o effect só limpa a URL.
- [ ] Lint novo, baixa prioridade: `react-hooks/incompatible-library` por `pocketForm.watch("categoryId")` em `pocket-management.tsx`. Mesmo padrão já usado para `initialAmount`.

## Como validar

1. `npx tsc --noEmit` limpo (verificado).
2. `npx eslint src/features/pockets src/features/categories src/features/purchases src/shared/lib/finance-service.ts src/app/api/pockets src/app/api/pocket-categories` — só os itens de lint acima.
3. Teste de lógica com banco SQLite temporário (`DATABASE_URL=file:/tmp/x.db`, migrations aplicadas): 21 checagens passaram. O script foi removido do repo. Refazer se mexer em `finance-service`.
4. Não rodar contra o Turso de produção para testar. O `.env.local` aponta para ele, então `npm run dev` usa o banco real.

## Áreas tocadas

`src/db/`, `src/shared/lib/`, `src/shared/hooks/`, `src/app/api/pockets/`, `src/app/api/pocket-categories/`, `src/app/api/purchases/`, `src/features/pockets/`, `src/features/categories/`, `src/features/purchases/`, `.cursor/agent-context/`
