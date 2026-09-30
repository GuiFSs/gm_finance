---
name: vercel-production-deploy
description: >-
  Administra e sobe alterações desta app para produção na Vercel (revisão,
  preflight, commit/push em main, env vars, migrations, status do deploy).
  Use quando o usuário pedir deploy, produção, publicar na Vercel, release,
  promover para prod, verificar deploy, rollback, ou gerenciar env de produção.
---

# Agente de deploy em produção (Vercel)

Responsável por **administrar e publicar** o `gm_finance` em produção na Vercel.
Seguir o fluxo **na ordem**. Não pular gates de segurança.

## Contexto do projeto

- Repo: `GuiFSs/gm_finance` · branch de produção: **`main`**
- Host: **Vercel** (Git integration → push em `main` = deploy de produção)
- Stack: Next.js + Turso/Drizzle · env documentado em `.env.example`
- CLI: `vercel` (login necessário para status/env/logs; deploy de prod preferencialmente via git)

Detalhes de env, migrations e comandos: [reference.md](reference.md).

## Regras de segurança (sempre)

1. **Nunca** fazer deploy de produção sem confirmação explícita do usuário nesta conversa.
2. **Nunca** `git push --force` / `--force-with-lease` em `main`.
3. **Nunca** commitar `.env`, `.env.local`, tokens, VAPID private key, `CRON_SECRET`, etc.
4. **Nunca** pular build quebrado ou migration pendente sem o usuário aceitar o risco por escrito.
5. Se houver mudanças locais não commitadas, **não** inventar conteúdo — revisar e perguntar o que entra no release.
6. Push / `vercel --prod` só depois do checklist verde **e** do "sim, pode subir".

## Fluxo de release (produção)

Copiar e marcar progresso:

```
Release:
- [ ] 1. Escopo e status
- [ ] 2. Review rápido
- [ ] 3. Preflight local
- [ ] 4. Migrations / env produção
- [ ] 5. Commit (se necessário)
- [ ] 6. Confirmação do usuário
- [ ] 7. Push / promote
- [ ] 8. Verificar deploy
- [ ] 9. Pós-deploy
```

### 1. Escopo e status

Rodar em paralelo:

- `git status -sb`
- `git diff` e `git diff --cached`
- `git log origin/main..HEAD --oneline` (commits a sair)
- `git fetch origin` (se rede ok) e comparar `main` vs `origin/main`

Resumir ao usuário em 3–6 bullets: o que vai para prod, arquivos sensíveis, migrations novas.

### 2. Review rápido

Checar o diff do release quanto a:

- Segredos / credenciais no código
- Breaking changes de API ou schema
- Feature flags / cron / push que dependem de env em produção
- Consistência com padrões do repo

Se houver **bloqueante**, parar e pedir correção antes de continuar.

### 3. Preflight local

Na raiz do repo:

```bash
npm run lint
npm run build
```

Se o usuário pedir só status ou rollback, pular build. Se lint/build falhar: **parar**, mostrar erro, não push.

### 4. Migrations e env de produção

- Se houver SQL novo em `src/db/migrations/`: avisar que **migrations precisam rodar contra o Turso de produção** (`DATABASE_URL` + `TURSO_AUTH_TOKEN` de prod). Não assumir que o build da Vercel aplica migrations sozinho.
- Conferir vars novas vs `.env.example` e [reference.md](reference.md). Se faltarem em produção, listar e **bloquear** o release até o usuário configurar (Vercel Dashboard ou `vercel env`).
- CLI sem login: orientar `vercel login` / link do projeto; não inventar tokens.

### 5. Commit (se necessário)

Working tree sujo:

- Se o usuário quiser incluir tudo (ou um subconjunto): preparar commit.
- Preferir a skill **commit-review** (mensagem Conventional Commits, uma linha, sem escopo entre parênteses).
- Só `git commit` se o usuário pedir commit explicitamente (regra do repo).

Working tree limpo e `main` à frente de `origin/main`: ir ao passo 6.

### 6. Confirmação do usuário

Antes de qualquer push ou `vercel --prod`, mostrar:

- Branch / commits que sobem
- Resultado do preflight
- Migrations / env pendentes (ou “ok”)
- Comando exato que será executado (ex.: `git push origin main`)

Perguntar: **“Posso subir para produção agora?”** Só continuar com resposta afirmativa clara.

### 7. Push / promote

Método padrão:

```bash
git push origin main
```

Alternativa (só se o usuário pedir deploy CLI e o projeto estiver linkado):

```bash
vercel --prod
```

Não usar `--force`. Não alterar git config.

### 8. Verificar deploy

Após o push:

- Com CLI autenticada: `vercel ls` / `vercel inspect` no deployment mais recente, ou abrir o deployment no dashboard.
- Sem CLI: orientar o usuário a conferir o deployment em https://vercel.com e o status do GitHub commit.
- Reportar: URL de produção, estado (Building / Ready / Error), commit SHA.

Se o deploy falhar: ler logs (`vercel logs` ou link do dashboard), diagnosticar, **não** re-push cego em loop.

### 9. Pós-deploy

- Se houver migration: lembrar de aplicar em produção e validar.
- Smoke mínimo sugerido: `/login` carrega; auth com PIN; dashboard abre.
- Se Web Push / cron entraram no release: lembrar VAPID + `CRON_SECRET` + cron externo (ver README).
- Resposta final curta: **Ready** + URL + SHA, ou **Falhou** + causa + próximo passo.

## Outras operações (administração)

| Pedido | Ação |
|--------|------|
| Status do deploy | `vercel ls` / inspect; resumir último prod |
| Env de produção | listar/sugerir via `vercel env` ou dashboard; nunca imprimir valores secretos |
| Rollback | orientar promote do deployment anterior no Vercel (ou redeploy de SHA estável); confirmar antes |
| Só checar se está pronto | rodar passos 1–4 e reportar go/no-go **sem** push |

## Formato da resposta ao usuário

1. **Escopo** — o que entra no release  
2. **Preflight** — lint/build/migrations/env (pass/fail)  
3. **Ação** — o que será feito / o que foi feito  
4. **Resultado** — URL, SHA, estado; ou bloqueio com motivo  

Em bloqueio, uma frase clara do que falta (ex.: “Falta `CRON_SECRET` em produção” / “Build falhou” / “Aguardando confirmação para push”).
