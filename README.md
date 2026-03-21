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

3. Run migrations:

```bash
npm run db:migrate
```

4. Start dev server:

```bash
npm run dev
```

Open `http://localhost:3000`.

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
- `/purchases` and `/purchases/new`
- `/pockets`
- `/cards`
- `/recurring`
- `/goals`
- `/deposits`
