# Contexto atual (agentes)

> Atualizado: 2026-11-17 — "sem categoria" e "sem tag" no dashboard também abrem compras filtradas.

## Status

`pronto-para-revisar`

## Objetivo recente

Dois pedidos do usuário na tela de compras e no dashboard:

1. Tocar numa categoria ou tag no dashboard abre `/purchases` já filtrada. O período acompanha o mês da tela. No ano, o mês tocado no gráfico "por mês" vale; sem toque, o ano inteiro.
2. Compras ganhou um botão de olho para mostrar/ocultar o valor total. Começa escondido a cada visita.

## O que mudou

- `src/features/dashboard/dashboard-overview.tsx` (`CategorySection`):
  - Tocar a linha ou a fatia de uma categoria chama `openPurchases`, que faz `router.push('/purchases?categoryId=…&startDate=…&endDate=…')`.
  - Tocar uma tag (dentro da categoria aberta) envia `categoryId` + `tagId`.
  - Os ids são resolvidos por nome em `useCategories()` / `useTags()`. Nomes são únicos no schema. Se a lista ainda não carregou, o clique não faz nada.
  - "sem categoria" abre compras com `uncategorized=1`. "sem tag" abre compras da categoria aberta com `untagged=1`.
  - O drill-down para as tags continua acessível pelo botão "tags" de cada linha de categoria (`SpendRow` agora tem `onOpen` e `onDrill`).
  - `rowLinks` e `openSlice` ligam linhas e pizza. `CategoryColumns` recebe `rowLinks` no lugar de `onPick`.
- `src/features/dashboard/period-model.ts` — `periodDateRange(period)`: `YYYY-MM` vira o intervalo do mês, `YYYY` vira o ano (inclusivo).
- `src/features/purchases/purchase-list.tsx`:
  - `filtersFromSearchParams` lê `categoryId`, `tagId`, `uncategorized`, `untagged`, `startDate` e `endDate` da URL no estado inicial dos filtros.
  - `showTotals` (padrão `false`): o total do topo vira `R$ •••••` e o total de cada mês vira `•••••`. O valor de cada compra continua visível.

- `getPurchases` / `GET /api/purchases`: `uncategorized=1` exige `categoryId` nulo; `untagged=1` descarta compras que tenham qualquer tag (filtro em memória, depois do join de tags).
- `usePurchases` e `filtersFromSearchParams` repassam os dois flags. O chip da tela mostra "sem categoria" / "sem tag". Escolher uma categoria ou tag no sheet desliga o flag correspondente.

## Decisões

- Clique em categoria navega; o drill-down virou o botão "tags". Motivo: o pedido era que o clique abrisse compras, e as tags precisavam continuar acessíveis.
- Tag filtra por categoria **e** tag, para bater com o número que a fatia mostra.
- Período sem mês no ano = ano inteiro (`startDate`/`endDate`), para o total da lista bater com o da categoria no ano.
- "Ocultar valor" é só estado de tela, não persiste (volta escondido a cada visita), como pedido.
- Ocultar valor cobre só agregados (total do topo e total por mês). Valores individuais de cada compra não foram escondidos. Se o usuário quiser esconder esses também, é mudança pequena em `PurchaseRowItem`.

## Ainda aberto / próximo passo

- [ ] Smoke no navegador: tocar categoria (pizza e linha), tag, e "por mês" no ano; confirmar o chip de filtro e o período na tela de compras
- [ ] Commitar e dar push em `main` (feito ao final desta entrega; ver LOG)
- [ ] Lint: `react-hooks/set-state-in-effect` no effect de `edit`/`new` em `purchase-list.tsx` e `exhaustive-deps` na linha `const list` — já existiam antes
- [ ] Lint: os erros antigos de `react-hooks/set-state-in-effect` em `budget-planner.tsx`, `card-statement-funding-modal.tsx` continuam lá
- [ ] Smoke no banco real: marcar/desmarcar Pago em `/movements`. Criar, editar e excluir em caixinhas, recorrentes, depósitos e metas
- [ ] Pendência anterior: confirmar a migração `0014_expense_payments` no Turso de **produção**

## Como validar

1. `npx tsc --noEmit` limpo
2. `npx eslint src/features/dashboard src/features/purchases` — só os itens de lint acima
3. No dashboard, mês: tocar categoria → `/purchases` com o chip da categoria e o intervalo do mês. Tocar tag → chip da categoria + tag. Tocar "sem categoria" → chip "sem categoria". Dentro de uma categoria, tocar "sem tag" → chip da categoria + "sem tag".
4. No dashboard, ano, aba "por mês": tocar um mês e depois uma categoria → período = aquele mês. Sem tocar em mês (aba pizza) → ano inteiro.
5. `/purchases`: total escondido por padrão; o olho mostra o total e os totais por mês.

## Áreas tocadas

`src/features/dashboard/`, `src/features/purchases/`, `.cursor/agent-context/`
