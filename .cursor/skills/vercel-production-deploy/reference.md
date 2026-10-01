# Referência — produção Vercel / gm_finance

## Variáveis de ambiente

Espelho de `.env.example`. Em produção (Vercel), configurar **todas as required** antes do primeiro deploy útil; optionals conforme a feature no release.

### Required

| Variável | Notas |
|----------|--------|
| `DATABASE_URL` | Turso libSQL URL de **produção** |
| `TURSO_AUTH_TOKEN` | Token Turso de **produção** |
| `JWT_SECRET` | Segredo longo e aleatório (não reutilizar o de dev se possível) |
| `LOGIN_PIN` | PIN de login (backend-only) |

### Optional — Web Push / digest

| Variável | Notas |
|----------|--------|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Pública; ok no client |
| `VAPID_PRIVATE_KEY` | **Secreta** — só server |
| `VAPID_SUBJECT` | Ex.: `mailto:…` |
| `CRON_SECRET` | Bearer do cron diário `POST /api/notifications/due-soon` |

### Optional — voz (Gemini) / Telegram backlog

| Variável | Notas |
|----------|--------|
| `GEMINI_API_KEY` | Parse de despesa por voz (`POST /api/purchases/parse-voice`) |
| `GEMINI_MODEL` | Default `gemini-3.5-flash-lite` |
| `TELEGRAM_BOT_TOKEN` | Backlog — sem código ainda |
| `TELEGRAM_WEBHOOK_SECRET` | Backlog |
| `TELEGRAM_ALLOWED_CHATS` | Backlog; formato no `.env.example` |

**Nunca** colar valores secretos no chat, commits ou logs da skill. Ao auditar env, falar só dos **nomes** presentes/ausentes.

### CLI env (quando autenticado e projeto linkado)

```bash
vercel env ls
# Adicionar (interativo / conforme flags da CLI instalada):
# vercel env add NOME production
```

Preferir dashboard se a CLI não estiver logada: Project → Settings → Environment Variables.

## Migrations (Drizzle / Turso)

- Arquivos em `src/db/migrations/*.sql` + journal em `src/db/migrations/meta/`.
- O deploy na Vercel **não** substitui `npm run db:migrate` contra o banco de produção.
- Antes/depois do release com migration nova:

```bash
# Com DATABASE_URL + TURSO_AUTH_TOKEN de PRODUÇÃO no ambiente do shell
npm run db:migrate
```

Confirmar com o usuário que o env do shell aponta para **prod**, não para o `.env.local` de dev.

## Comandos úteis

```bash
# Auth / projeto
vercel login
vercel link          # na raiz do repo, se ainda não linkado
vercel whoami

# Deploy via Git (preferido)
git push origin main

# Deploy CLI (só se pedido)
vercel --prod

# Inspeção
vercel ls
vercel inspect <deployment-url-or-id>
vercel logs <deployment-url-or-id>

# Qualidade local
npm run lint
npm run build
```

## Smoke pós-deploy

1. Abrir URL de produção → `/login`
2. Login com PIN de produção
3. Dashboard carrega sem erro de API/DB
4. Se o release incluir push: UI “Ativar notificações” + cron com `CRON_SECRET` (README)

## Rollback (orientação)

1. Vercel → Deployments → deployment estável anterior → **Promote to Production** (ou equivalente na UI)
2. Se migration **já** rodou em prod e não for backward-compatible: **não** só rollback de código — coordenar correção de schema/dados com o usuário
3. Confirmar promote/rollback com o usuário antes de executar qualquer comando destrutivo
