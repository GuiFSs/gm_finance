# Mapa da aplicação (agentes)

> Visão estável do `gm_finance`. Atualizar quando rotas, APIs, decisões de arquitetura ou gaps mudarem de forma permanente. Estado operacional do dia a dia fica em `CURRENT.md`.

App privado de finanças para **dois usuários** (Guilherme e Maryane). Stack: Next.js App Router, FSD, Turso/Drizzle, JWT cookie, Tailwind/shadcn, Zustand + TanStack Query.

## Arquitetura

| Camada | Path |
|--------|------|
| Rotas / API | `src/app`, `src/app/api` |
| UI por caso de uso | `src/features` |
| Domínio / tipos | `src/entities` |
| Shared (UI, libs, hooks) | `src/shared` |
| Schema + migrations | `src/db` |
| Zustand UI | `src/store` |

- Domínio financeiro central: `src/shared/lib/finance-service.ts`, orçamentos em `budget-service.ts`
- Fatura de cartão: `src/shared/lib/card-statement.ts` — mês da fatura = **mês do vencimento** (caixa). Compras no dia de fechamento em diante vão para a próxima fatura. Ex.: fecha 30, vence 7; compra 15/09 aparece em movimentos de outubro com venc. 07/10.
- Auth gate (Next 16): `src/proxy.ts` (não existe `middleware.ts`)
- UI: regra shadcn → `src/shared/ui`; skill deploy → `.cursor/skills/vercel-production-deploy`

## Auth

- PIN único de env: `LOGIN_PIN` (backend). Coluna `users.pin` no seed é legado (`env-controlled`); login **não** compara pin do DB.
- Seed automático em `GET /api/auth/users`: `user_guilherme`, `user_maryane`
- Sessão: JWT em cookie `httpOnly` `gm_finance_session`
- No login também disparam recorrentes/depósitos vencidos (`recurring` run)
- Household compartilhado: despesas (`GET/PATCH/DELETE /api/purchases/[id]`) são acessíveis por **qualquer** sessão autenticada; `createdByUserId` só identifica quem lançou

### Rotas públicas (`src/proxy.ts`)

`/login`, `/api/auth/login`, `/api/auth/users`, `/api/notifications/due-soon`, `/api/push/vapid-public-key`, assets PWA (`/sw.js`, workbox, worker, manifest, ícones).

## Páginas

| Rota | Feature |
|------|---------|
| `/login` | `features/auth` |
| `/dashboard` | `features/dashboard` + card push |
| `/movements` | `features/movements` |
| `/purchases`, `/purchases/new` | `features/purchases` |
| `/pockets` | `features/pockets` |
| `/cards` | `features/cards` (+ statement funding) |
| `/recurring` | `features/recurring` |
| `/goals` | `features/goals` |
| `/deposits` | `features/deposits` (+ recurring deposits) |
| `/budgets` | `features/budgets` |
| `/categories` | `features/categories` |

Nav: shell em `src/shared` / app-shell (rotas protegidas via `(protected)/layout.tsx`).

## APIs (resumo)

| Área | Endpoints |
|------|-----------|
| Auth | `login`, `logout`, `me`, `users` |
| Dashboard / ledger | `GET /api/dashboard`, `POST /api/adjustments`, `GET /api/movements` |
| Purchases | CRUD `/api/purchases`, `[id]`; `POST /api/purchases/parse-voice` (Gemini, despesa no form) |
| Voice (geral) | `POST /api/voice/parse` (Gemini multi-intent; **não** executa) |
| Pockets | GET/POST, `PATCH [id]`, `POST transfer` — **sem DELETE** |
| Cards | GET/POST, `PATCH [id]`, `statement-funding` — **sem DELETE** |
| Recurring | CRUD + `POST /api/recurring/run` |
| Deposits | CRUD deposits + CRUD `recurring-deposits` |
| Goals | **só** GET/POST |
| Budgets | GET/PUT/POST (`/api/budgets`) |
| Categories | GET/POST + PATCH/DELETE `[id]` |
| Tags | GET/POST — **sem PATCH/DELETE** |
| Push | `GET vapid-public-key` (público), `POST/DELETE subscribe` (sessão) |
| Cron digest | `POST /api/notifications/due-soon` (Bearer `CRON_SECRET`) |

## Web Push (HEAD `ef2a560` — em produção)

- Digest **1×/dia**: faturas/compras/recorrentes que vencem **hoje ou amanhã**
- Libs: `web-push.ts`, `due-soon-digest.ts`
- Migration: `0013_push_notifications.sql` → `push_subscriptions`, `notification_sends` (confirmar aplicada no Turso prod)
- SW custom: `worker/index.js` via `@ducanh2912/next-pwa` — **desabilitado em `next dev`**
- Env prod: `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `CRON_SECRET` (já configurados na Vercel)
- Cron é **externo** (não há `vercel.json` Cron); ver README
- `?force=1` só para teste; 410/404 removem subscription

## Env

**Obrigatório:** `DATABASE_URL`, `TURSO_AUTH_TOKEN`, `JWT_SECRET`, `LOGIN_PIN`

**Push/cron:** `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `CRON_SECRET`

**Voz (despesa no form + comandos gerais):** `GEMINI_API_KEY` (obrigatória para parse), `GEMINI_MODEL` (default `gemini-3.5-flash-lite`)

**No `.env.example` mas SEM código:** `TELEGRAM_*` — backlog; **não implementar** a partir só do example.

## Deploy (produção)

- Repo `GuiFSs/gm_finance`, prod = push em `main` → Vercel
- Migrations **manuais** contra Turso (`npm run db:migrate` **não** roda no deploy)
- Skill: `.cursor/skills/vercel-production-deploy/SKILL.md`

## Gaps conhecidos (produto)

- Telegram bot: não existe em `src/` (env reservado)
- Goals: sem edit/delete
- Cards / pockets: sem DELETE API
- Tags: sem PATCH/DELETE
- `ideias.md` na raiz: nota solta (não é spec oficial)

## Voz — comandos gerais (MVP)

FAB de mic no `AppShell` (telas autenticadas). Parse tipado → dialog de confirmação → execução no client.

### Intents

| Intent | Efeito ao confirmar |
|--------|---------------------|
| `create_pocket` | `POST /api/pockets` |
| `set_pocket_balance` | `POST /api/adjustments` (delta = novo − atual), igual à edição na tela de Caixinhas |
| `create_deposit` | `POST /api/deposits` (1 split: conta ou 1 caixinha) |
| `create_purchase` | `POST /api/purchases` |
| `unknown` | Só mensagem; sem Confirmar |

### Backend

- `POST /api/voice/parse` — sessão; body `{ audioBase64, mimeType }` (ou `transcript`); **não** muta
- Lib: `src/shared/lib/gemini-parse-voice-command.ts`
- UI: `src/features/voice/voice-command-fab.tsx`, `voice-preview.ts`

### Fora do MVP

Transferências, metas, orçamentos, faturas, delete, consultas faladas, recorrentes.

## Voz — despesa no formulário (implementado)

Feature estável para agentes. **Não** reintroduzir Web Speech / Groq Whisper / WhatsApp sem pedido explícito.

### Fluxo UX

1. `/purchases` → **Nova despesa** → botão **Falar** (só modo criação; não em edição)
2. Gravação com `MediaRecorder` + `getUserMedia`
3. **Parar** — descarta áudio; **Enviar** — para e manda ao servidor (máx. ~30s)
4. Gemini devolve campos → `reset` do `PurchaseForm` → usuário confirma e salva via `POST /api/purchases` existente

### Backend

- `POST /api/purchases/parse-voice` — sessão obrigatória; body JSON `{ audioBase64, mimeType }` (ou `{ transcript }` legado/teste)
- Lib: `src/shared/lib/gemini-parse-purchase.ts` — carrega pockets/cards/categories/tags, chama Gemini `generateContent` multimodal, valida Zod, sanitiza IDs
- Schema Gemini: tipos `STRING`/`NUMBER`/`INTEGER`/`ARRAY`/`OBJECT` + `nullable: true` — **não** usar `type: ["string","null"]` nem `additionalProperties` (API rejeita)
- Default model: `gemini-3.5-flash-lite` via `GEMINI_MODEL`

### Arquivos

| Path | Papel |
|------|--------|
| `src/features/purchases/purchase-form.tsx` | UI Falar / Parar / Enviar |
| `src/app/api/purchases/parse-voice/route.ts` | Route handler |
| `src/shared/lib/gemini-parse-purchase.ts` | Prompt + Gemini + sanitize |

### Env prod

Antes de publicar: `GEMINI_API_KEY` (e opcionalmente `GEMINI_MODEL`) na Vercel.

## Convenções para agentes

1. Ler `CURRENT.md` (estado) + este `APP.md` (mapa) antes de features grandes
2. UI nova → shadcn MCP + `src/shared/ui`
3. Após mudanças relevantes → skill `document-changes`
4. Deploy prod → skill `vercel-production-deploy` + confirmação explícita do usuário
