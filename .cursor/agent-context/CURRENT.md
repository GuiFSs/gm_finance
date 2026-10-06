# Contexto atual (agentes)

> Atualizado: 2026-10-06 — fatura de cartão no mês do vencimento

## Status

`estável`

## Objetivo recente

Corrigir vencimento na tela de movimentos: cartão fecha dia 30 e vence dia 7; em 06/10 a fatura atual deve vencer 07/10, não 07/11.

## O que mudou

- `src/shared/lib/card-statement.ts` — extraído `cardStatementMonth` + `cardDueDateForStatement`
- Mês da fatura passou a ser o **mês do vencimento** (não o mês do ciclo de compras)
- `finance-service.ts`, `due-soon-digest.ts` — filtros de movimentos/fatura/digest usam a nova regra
- Texto do detalhe da despesa alinhado (sem “mês seguinte ao da fatura”)
- `APP.md` — regra de fatura documentada

## Decisões

- Compras no dia do fechamento (inclusive) entram na **próxima** fatura (igual à regra antiga de `day >= closingDay`)
- Plano de pagamento (`statement_month`) passa a casar com o mês visto em Movimentos (mês em que se paga)

## Ainda aberto / próximo passo

- [ ] Smoke em prod: `/movements` outubro — compra pré-30/09 com venc. 07/10; pós-fechamento com venc. 07/11
- [ ] Planos de fatura já salvos com o mês antigo (ciclo, não vencimento) podem ficar no mês errado — conferir se há dados

## Como validar

1. Cartão fecha 30, vence 7
2. Compra com data 15/09/2026 → movimentos de **outubro** → venc. 07/10/2026
3. Compra com data 06/10/2026 → movimentos de **novembro** → venc. 07/11/2026

## Áreas tocadas

`src/shared/lib/card-statement.ts`, `finance-service.ts`, `due-soon-digest.ts`, `purchase-detail-dialog.tsx`, `APP.md`
