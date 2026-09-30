# Contexto atual (agentes)

> Atualizado: 2026-09-30 — versionar handoff de agentes + README rotas

## Status

`estável`

## Objetivo recente

Versionar docs de handoff (`.cursor/agent-context`, regra/skill) e alinhar README às rotas; push due-soon já em produção.

## O que mudou

- Produção Vercel: deployment Ready; código alinhado a `ef2a560` em `main`
- Env de produção presentes (nomes): `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `CRON_SECRET` (+ DB/JWT/PIN já existentes)
- Docs de agentes commitados: `APP.md`, `CURRENT.md`, `LOG.md`, regra `document-agent-changes`, skill `document-changes`
- README: rotas `/movements`, `/budgets`, `/categories` + nota Telegram/Groq reservados

## Decisões

- Prod = push em `main` → Vercel; migrate Turso continua **manual** (não no build)
- Cron digest continua **externo** (não Vercel Cron)
- Telegram/Groq ainda não implementados

## Ainda aberto / próximo passo

- [ ] Confirmar que migration `0013_push_notifications.sql` rodou no Turso de **produção**
- [ ] Confirmar cron diário apontando para `POST /api/notifications/due-soon` com Bearer `CRON_SECRET`
- [ ] Smoke test: “Ativar notificações” no PWA/prod + (opcional) `?force=1` no cron
- [ ] Produto (backlog): goals edit/delete; DELETE cards/pockets; tags PATCH/DELETE; Telegram/Groq

## Como validar

- Dashboard em prod → **Ativar notificações** (iOS: app na Tela de Início)
- `GET /api/push/vapid-public-key` sem 503
- Cron: `POST /api/notifications/due-soon` com Bearer → JSON ok / `already_sent` / sem envio se janela vazia

## Áreas tocadas

Produção Vercel `gm-finance`; `.cursor/agent-context/*`; push stack já em HEAD (`notifications`, `api/push`, migration `0013`, `worker/index.js`)
