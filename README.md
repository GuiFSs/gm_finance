# G&M Finance

Private financial management web app for two users (Guilherme and Maryane), built with Next.js App Router and Feature-Sliced Design.

## Stack

- Next.js App Router + React + TypeScript (strict mode)
- TailwindCSS + shadcn-style reusable UI + Lucide + Recharts
- Zustand (UI state) + TanStack Query (server state with 30s cache)
- React Hook Form + Zod
- Next.js Route Handlers (API)
- Turso (libSQL/SQLite) + Drizzle ORM + Drizzle migrations
- JWT session in `httpOnly` cookie

## Getting Started

1. Install dependencies:

```bash
npm install
```

2. Configure environment:

```bash
cp .env.example .env.local
```

Required variables:

- `DATABASE_URL`
- `TURSO_AUTH_TOKEN`
- `JWT_SECRET`
- `LOGIN_PIN` (backend-only login PIN)

Optional — Web Push (alertas de vencimento):

- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` — gerar com `npx web-push generate-vapid-keys`
- `VAPID_SUBJECT` — ex. `mailto:voce@exemplo.com`
- `CRON_SECRET` — string longa aleatória para o job diário

Optional — despesa por voz (MediaRecorder + Gemini):

- `GEMINI_API_KEY` — chave em [Google AI Studio](https://aistudio.google.com/apikey)
- `GEMINI_MODEL` — default `gemini-3.5-flash-lite` (não usar `gemini-2.0-flash`, descontinuado)

3. Run migrations:

```bash
npm run db:migrate
```

4. Start dev server:

```bash
npm run dev
```

Open `http://localhost:8080`.

## Web Push — alertas hoje/amanhã

O app envia **uma notificação por dia** (digest) com faturas de cartão, compras (conta/caixinha) e recorrentes que vencem **hoje ou amanhã**.

1. Gere as chaves VAPID e preencha o `.env.local`.
2. Faça deploy em produção (o service worker **não** roda em `next dev`).
3. No dashboard, use **Ativar notificações** (no iOS: instalar o PWA na Tela de Início).
4. Agende um cron gratuito (ex. [cron-job.org](https://cron-job.org)) diariamente ~08:00:

```bash
curl -X POST "https://SEU_HOST/api/notifications/due-soon" \
  -H "Authorization: Bearer $CRON_SECRET"
```

- Sem itens na janela: não envia.
- Já enviado no dia: responde `already_sent` (use `?force=1` só para teste).
- Endpoints 410/404 são removidos automaticamente.

## Default users

Initial seed runs automatically when `/api/auth/users` is accessed:

- Guilherme
- Maryane

PIN validation is backend-only and read from `LOGIN_PIN` env variable.

## Project structure (FSD)

- `src/app` and `src/app/api` for pages and route handlers
- `src/features` for screen-level and use-case UI modules
- `src/entities` for domain entity types/models
- `src/shared` for reusable UI, hooks, libs, utils, and types
- `src/db` for schema, migrations, and db client
- `src/store` for Zustand UI store

## Main routes

- `/login`
- `/dashboard`
- `/movements`
- `/purchases` and `/purchases/new`
- `/pockets`
- `/cards`
- `/recurring`
- `/goals`
- `/deposits`
- `/budgets`
- `/categories`

## Despesa por voz

No dialog **Nova despesa** (`PurchaseForm`):

1. **Falar** — inicia gravação (`MediaRecorder` + microfone)
2. **Parar** — descarta o áudio
3. **Enviar** — envia o áudio para `POST /api/purchases/parse-voice`; Gemini preenche o formulário
4. Usuário revisa e salva com o fluxo normal (`POST /api/purchases`)

Não usa Web Speech API (erro `network` frequente no Chrome). Requer `GEMINI_API_KEY`. Detalhes para agentes: `.cursor/agent-context/APP.md` (seção Voz).

Note: `TELEGRAM_*` in `.env.example` remains backlog — no Telegram bot code yet.
