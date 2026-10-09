# Contexto atual (agentes)

> Atualizado: 2026-10-09 — detalhe da despesa acessível ao household inteiro

## Status

`estável`

## Objetivo recente

Corrigir modal "Detalhes da despesa" que falhava ("Não foi possível carregar os detalhes") ao abrir compra de outro usuário (ex.: Maryane abrindo "Lua de mel cartao Gui" lançada por Guilherme).

## O que mudou

- `src/shared/lib/finance-service.ts` — `getPurchaseDetailById` deixa de exigir `createdByUserId === userId` (household compartilhado)
- `src/app/api/purchases/[id]/route.ts` — `GET` com try/catch para erro de DB não virar 500 opaco
- `APP.md` — documenta acesso compartilhado a despesas

## Decisões

- Leitura **e** mutação (PATCH/DELETE) de despesas ficam abertas a qualquer sessão autenticada, alinhado a movimentos/lista que já mostram tudo
- `createdByUserId` permanece no schema só como auditoria de quem lançou

## Ainda aberto / próximo passo

- [ ] Smoke em prod: logada como Maryane → `/movements` → abrir "Lua de mel cartao Gui" (parcela 8/8) → modal com 8 parcelas

## Como validar

1. Login como Maryane
2. Abrir movimentos de outubro → despesa "Lua de mel cartao Gui" (−R$ 147,65, parcela 8/8)
3. Modal deve listar as 8 parcelas (mar–out/2026), sem mensagem de erro

## Áreas tocadas

`src/shared/lib/finance-service.ts`, `src/app/api/purchases/[id]/route.ts`, `.cursor/agent-context/`
