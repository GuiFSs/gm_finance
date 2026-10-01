# Contexto atual (agentes)

> Atualizado: 2026-10-01 — despesa por voz em produção

## Status

`estável`

## Objetivo recente

Publicar a feature de despesa por voz (MediaRecorder + Gemini) em produção, com env `GEMINI_*` na Vercel.

## O que mudou

- `purchase-form.tsx` — UI Falar / Parar / Enviar (gravação MediaRecorder)
- `POST /api/purchases/parse-voice` + `gemini-parse-purchase.ts` — parse multimodal Gemini
- `purchase-list.tsx` — removido card “Total das despesas”
- Docs: `README.md`, `APP.md`, skill deploy reference
- Prod: `GEMINI_API_KEY` e `GEMINI_MODEL` adicionadas na Vercel (Production/Preview/Development)

## Decisões

- Áudio no client → Gemini no server (sem Web Speech / Groq)
- Sem migration nova neste release
- Lint local tem erros pré-existentes em budgets/cards/purchases (setState-in-effect); build Next ok

## Ainda aberto / próximo passo

- [ ] Smoke em prod: login → Nova despesa → Falar → Enviar → form preenchido
- [ ] Backlog: goals edit/delete; DELETE cards/pockets; tags PATCH/DELETE; Telegram

## Como validar

1. `/login` em produção
2. `/purchases` → Nova despesa → Falar (mic) → Enviar → revisar campos → salvar
3. Sem `GEMINI_API_KEY`: API deve responder 503

## Áreas tocadas

`src/features/purchases`, `src/app/api/purchases/parse-voice`, `src/shared/lib/gemini-parse-purchase.ts`, docs agentes, Vercel env
