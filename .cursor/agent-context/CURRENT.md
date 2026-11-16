# Contexto atual (agentes)

> Atualizado: 2026-11-16 — despesa paga na mão, fatura do cartão quita o mês

## Status

`pronto-para-revisar`

## Objetivo recente

Em movimentos do mês, despesa deixa de virar “já pago” pela data. A pessoa marca Pago. No cartão, um único “fatura paga” quita todas as compras daquele mês.

## O que mudou

- `src/db/schema/schema.ts` + `src/db/migrations/0014_expense_payments.sql` — `purchases.paid_at` (conta/caixinha) e tabela `card_statement_payments` (cartão + `yyyy-MM`)
- `src/shared/lib/finance-service.ts` — movimentos trazem `paid`; `setPurchasePaid` e `setCardStatementPaid`
- `PATCH /api/purchases/[id]/paid` — só conta/caixinha; cartão responde erro pedindo a fatura
- `PUT /api/cards/[id]/statement-payment` — marca ou desmarca a fatura do mês
- `src/features/movements/movements-list.tsx` — checkbox Pago por despesa; no grupo do cartão (e na lista por data) o botão “Marcar fatura paga”
- Migração `0014` aplicada com `npm run db:migrate` no banco do `.env.local`

## Decisões

- Entradas, transferências e ajustes não têm quitação manual
- Recorrente prevista que ainda não virou compra (conta/caixinha) continua “Previsto”; no cartão, se a fatura do mês está paga, a linha prevista também aparece paga
- Cada parcela de conta/caixinha é uma linha: marcar uma não marca as outras
- Compra nova no cartão depois da fatura marcada entra como paga, porque a fonte é a fatura do mês, não cada compra
- Desmarcar a fatura reabre todas as compras daquele mês

## Ainda aberto / próximo passo

- [ ] Confirmar que a migração `0014_expense_payments` está aplicada no Turso de **produção** (a aplicação foi feita no banco do `.env.local`; se forem bancos diferentes, rodar `npm run db:migrate` com as credenciais de prod)
- [ ] Smoke em `/movements`: marcar/desmarcar despesa de conta e fatura do cartão (agrupado e lista por data); conferir que entrada não ganha “Pago”

## Como validar

1. Abrir `/movements` no mês atual
2. Despesa de conta ou caixinha com data passada mostra “Em aberto” e um checkbox Pago — não “Já pago”
3. Marcar Pago, recarregar, o estado permanece; desmarcar volta a “Em aberto”
4. No grupo do cartão, “Marcar fatura paga” deixa todas as compras daquele mês como pagas
5. Entrada do mês não tem checkbox Pago

## Áreas tocadas

`src/db`, `src/shared/lib/finance-service.ts`, `src/shared/hooks/use-finance.ts`, `src/app/api/purchases/[id]/paid`, `src/app/api/cards/[id]/statement-payment`, `src/features/movements/movements-list.tsx`, `.cursor/agent-context/`
