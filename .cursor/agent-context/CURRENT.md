# Contexto atual (agentes)

> Atualizado: 2026-11-17 — no ano, por mês das categorias é o mesmo gráfico de doze colunas.

## Status

`pronto-para-revisar`

## Objetivo recente

O usuário queria o gráfico de categorias no ano no mesmo desenho das doze colunas do início da tela. Cada coluna é um mês. As cores dentro da coluna são as categorias. Tocar a coluna mostra a porcentagem e o valor daquele mês. Nas tags, o mesmo gráfico.

## O que mudou

- `src/features/dashboard/dashboard-overview.tsx` — "por mês" deixou de ser uma lista dos doze meses e passou a ser doze colunas, com a mesma altura, a linha de base, o traço tracejado no mês vazio e o rótulo de 12px do gráfico do ano. A coluna empilha as cores da categoria, a maior na base. A coluna tocada fica marcada no rótulo e a lista de baixo mostra cor, porcentagem e valor só daquele mês. Abrir uma categoria troca as cores para as tags. Porcentagem que arredonda para zero aparece como "<1%".
- `DESIGN.md` e o brief da superfície — as colunas de categoria entram na exceção de cor da pizza.

## Decisões

- O gráfico copia as colunas do ano. A lista só existe para o mês tocado, porque doze colunas estreitas não cabem porcentagem e valor dentro da barra.
- A cor continua estável no ano, a mesma da pizza. Mês vazio é o traço tracejado, não uma coluna cheia.
- O toggle pizza | por mês só existe na visão do ano.

## Ainda aberto / próximo passo

- [ ] Smoke no banco real: marcar/desmarcar Pago (despesa de conta e fatura do cartão) em `/movements`
- [ ] Migrar as demais rotas (orçamento, categorias, caixinhas, cartões, recorrentes, metas, depósitos) para o novo visual
- [ ] Lint: `react-hooks/set-state-in-effect` em `purchase-list.tsx`, e erros antigos em `budget-planner` e no funding modal
- [ ] Pendência anterior: confirmar migração `0014_expense_payments` no Turso de **produção**
- [ ] Commitar

## Como validar

1. `npx tsc --noEmit` limpo
2. `/dashboard`, ano, por categoria, "por mês": doze colunas jan–dez. Novembro vem marcado. Tocar julho troca a lista de baixo para as categorias de julho, com porcentagem e valor.
3. Clicar uma categoria redesenha as colunas nas cores das tags. "pizza" volta o círculo. No mês, o toggle some.
4. Saldos agora não mudam com o período.

## Áreas tocadas

`src/features/dashboard/`, `DESIGN.md`, `.impeccable/surfaces/src-app-protected-dashboard-page-tsx.md`, `.cursor/agent-context/`
