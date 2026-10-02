# Contexto atual (agentes)

> Atualizado: 2026-10-01 — release voz multi-intent em produção

## Status

`estável`

## Objetivo recente

Publicar FAB de comandos por voz (multi-intent Gemini) em produção: criar caixinha, atualizar saldo/descrição, depósito, despesa.

## O que mudou

- `POST /api/voice/parse` + `gemini-parse-voice-command.ts` — parse multi-intent (não muta)
- `voice-command-fab.tsx` / `voice-preview.ts` — FAB no AppShell + confirm + executor
- `set_pocket_balance` — saldo e/ou descrição (`PATCH` + adjustment)
- Docs: `README.md`, `APP.md`, `LOG.md`
- Env prod: `GEMINI_API_KEY` / `GEMINI_MODEL` já existiam (sem vars novas)

## Decisões

- Parse no server; mutações só após Confirmar no client via APIs existentes
- Sem migration neste release
- Lint local ainda tem erros pré-existentes em budgets/cards/purchases; build Next ok

## Ainda aberto / próximo passo

- [ ] Smoke em prod: FAB → 4 intents (caixinha, saldo+desc, depósito, despesa)
- [ ] Backlog: transferências, metas, orçamentos, delete, Telegram

## Como validar

1. `/login` em produção
2. Qualquer tela autenticada → mic FAB → Falar → Enviar → Confirmar
3. Sem `GEMINI_API_KEY`: `POST /api/voice/parse` → 503

## Áreas tocadas

`src/features/voice`, `src/app/api/voice/parse`, `src/shared/lib/gemini-parse-voice-command.ts`, `app-shell.tsx`, docs agentes
