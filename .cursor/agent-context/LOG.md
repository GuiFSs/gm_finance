# Log de alterações (agentes)

Entradas mais recentes no topo. Ver skill `document-changes` para o formato.

## 2026-11-17 — colunas de categoria no ano

- Status: `pronto-para-revisar`
- Resumo: No ano, "por mês" das categorias virou doze colunas no mesmo desenho do gráfico do início da tela. Cada coluna é um mês empilhado nas cores das categorias. Tocar a coluna mostra porcentagem e valor. A categoria aberta redesenha as colunas com as tags.
- Arquivos-chave: `src/features/dashboard/dashboard-overview.tsx`
- Próximo: nenhum nesta tela

## 2026-11-17 — categorias mês a mês no ano

- Status: `pronto-para-revisar`
- Resumo: No ano, a seção de categorias alterna entre a pizza e uma lista dos doze meses. Cada mês mostra cada categoria com cor, porcentagem daquele mês e valor. A categoria aberta faz o mesmo com as tags. A barra de uma categoria só saiu.
- Arquivos-chave: `src/features/dashboard/dashboard-overview.tsx`, `src/features/dashboard/category-spend.ts`
- Próximo: nenhum nesta tela

## 2026-11-17 — gasto mensal da categoria no ano

- Status: `pronto-para-revisar`
- Resumo: No ano, abrir uma categoria mostra doze barras horizontais (jan–dez) com o valor ao lado. Clicar uma tag filtra essas barras. A pizza da categoria e a das tags continuam. No mês essa lista não aparece.
- Arquivos-chave: `src/features/dashboard/dashboard-overview.tsx`, `src/features/dashboard/category-spend.ts`
- Próximo: nenhum nesta tela

## 2026-11-17 — tags ao clicar na categoria

- Status: `pronto-para-revisar`
- Resumo: Clicar numa categoria (fatia ou linha) abre a mesma pizza para as tags daquela categoria. Sem tag aparece como "sem tag". "categorias" volta. Movimentos passam a trazer os nomes das tags.
- Arquivos-chave: `src/features/dashboard/dashboard-overview.tsx`, `category-spend.ts`, `src/shared/lib/finance-service.ts`
- Próximo: nenhum nesta tela

## 2026-11-17 — cores na pizza de categoria

- Status: `pronto-para-revisar`
- Resumo: Cada categoria ganhou uma cor fixa na pizza e no marcador da lista. "sem categoria" fica cinza. As cores não entram no plano do mês nem na pizza de entra/sai.
- Arquivos-chave: `src/features/dashboard/category-spend.ts`, `flat-pie.tsx`, `dashboard-overview.tsx`
- Próximo: nenhum nesta tela

## 2026-11-17 — pizzas no dashboard

- Status: `pronto-para-revisar`
- Resumo: Saiu o gráfico por semana. O mês ganhou uma pizza de entra (o todo), sai e sobra, sem fatia "falta". Por categoria virou pizza com a porcentagem de cada uma; compra sem categoria aparece como "sem categoria".
- Arquivos-chave: `src/features/dashboard/dashboard-overview.tsx`, `flat-pie.tsx`, `category-spend.ts`
- Próximo: smoke do toggle Pago em `/movements`

## 2026-11-17 — dashboard lê mês ou ano

- Status: `pronto-para-revisar`
- Resumo: `/dashboard` deixou de ser uma segunda lista. Mostra a sobra do mês (plano + colunas por semana) ou do ano (12 colunas), saldos de agora e gasto por categoria. Marcar pago continua em movimentos. Mesma conta de `computeMonthTotals`.
- Arquivos-chave: `src/features/dashboard/dashboard-overview.tsx`, `period-model.ts`, `period-chart.tsx`, `use-period-data.ts`, `category-spend.ts`
- Próximo: smoke do toggle Pago em `/movements`; migrar as outras rotas

## 2026-11-17 — redesign "Concreto" (dashboard, movimentos, compras)

- Status: `pronto-para-revisar`
- Resumo: Nova identidade visual (impeccable, direção "Concreto": fundo #141414, planos vermelho/amarelo/azul, cantos retos, Jost, minúsculas, 3 tamanhos 48/24/15). Redesenho das 3 páginas principais e do shell; demais rotas herdam tokens mas não foram redesenhadas. Revisor final: ship.
- Arquivos-chave: `globals.css`, `layout.tsx`, `src/features/month/*` (novo), `dashboard-overview.tsx`, `movements-list.tsx`, `purchase-list.tsx`, `purchase-form.tsx`, `app-shell.tsx`, `voice-command-fab.tsx`
- DESIGN.md + design.json reescritos (overwrite) para Concreto.
- Próximo: smoke do toggle Pago no banco real; migrar as outras rotas

## 2026-11-17 — DESIGN.md e sidecar (impeccable document)

- Status: `pronto-para-revisar`
- Resumo: Scan do sistema visual incumbente. `DESIGN.md` com tokens do tema escuro (padrão enviado), North Star "The Household Ledger" e regras (Direction, Tabular Figures, Flat-At-Rest). `.impeccable/design.json` (schema v2) com 8 componentes `ds-*`. Sem alteração de código do app; drift de `gray-*` no shell registrado, não corrigido.
- Arquivos-chave: `DESIGN.md`, `.impeccable/design.json`, `src/app/globals.css`, `src/shared/ui/*`
- Próximo: revisar DESIGN.md com o usuário; decidir sobre o drift de `gray-*`

## 2026-11-17 — PRODUCT.md (impeccable init)

- Status: `pronto-para-revisar`
- Resumo: Criado `PRODUCT.md` com plataforma `web`, usuários, propósito, restrições e princípios, a partir de entrevista com o usuário. Sem alteração de código do app; sem `DESIGN.md`, sem `.impeccable/config.json`, sem live mode.
- Arquivos-chave: `PRODUCT.md`, `.cursor/agent-context/CURRENT.md`
- Próximo: confirmar posicionamento e métrica de sucesso (marcados como inferidos); decidir sobre gaps de delete/edit

## 2026-11-16 — pagamento manual das despesas

- Status: `pronto-para-revisar`
- Resumo: Movimentos não marcam “já pago” pela data. Conta/caixinha: checkbox por despesa. Cartão: uma fatura paga quita o mês. Migração 0014 aplicada no Turso do `.env.local`. Push em `main` feito (deploy Vercel automático).
- Arquivos-chave: `finance-service.ts`, `movements-list.tsx`, `0014_expense_payments.sql`
- Próximo: confirmar que `0014` está aplicada no Turso de produção; smoke em `/movements` (conta + fatura)

## 2026-10-09 — detalhe da despesa no household

- Status: `estável`
- Resumo: Modal falhava para Maryane em compras do Gui (404 por `createdByUserId`); `getPurchaseDetailById` agora compartilha o household.
- Arquivos-chave: `finance-service.ts`, `api/purchases/[id]/route.ts`
- Próximo: smoke em prod como Maryane na parcela 8/8

## 2026-10-06 — fatura no mês do vencimento

- Status: `estável`
- Resumo: Movimentos/fatura/digest usam o mês do vencimento; fecha 30/vence 7 → compra 15/09 aparece em outubro com venc. 07/10, não 07/11.
- Arquivos-chave: `src/shared/lib/card-statement.ts`, `finance-service.ts`, `due-soon-digest.ts`
- Próximo: smoke em `/movements` (compra pré vs pós fechamento)

## 2026-10-01 — release voz multi-intent em produção

- Status: `estável`
- Resumo: Commit + push `main` do FAB de comandos por voz (parse multi-intent + confirm); `GEMINI_*` já em prod.
- Arquivos-chave: `api/voice/parse`, `gemini-parse-voice-command.ts`, `voice-command-fab.tsx`, `app-shell.tsx`
- Próximo: smoke FAB nos 4 intents em prod

## 2026-10-01 — voz: saldo + descrição caixinha

- Status: `pronto-para-revisar`
- Resumo: `set_pocket_balance` aceita `newDescription`; executor faz PATCH + adjustment no mesmo confirm.
- Arquivos-chave: `gemini-parse-voice-command.ts`, `voice-command-fab.tsx`, `voice-preview.ts`
- Próximo: smoke áudio com valor e descrição juntos

## 2026-10-01 — fix voz atualizar caixinha

- Status: `pronto-para-revisar`
- Resumo: Prompt + recovery para `set_pocket_balance`; Gemini não deve mais dizer que atualizar caixinha não é suportado.
- Arquivos-chave: `gemini-parse-voice-command.ts`
- Próximo: smoke “atualizar caixinha X para N”

## 2026-10-01 — MVP voz geral (comandos)

- Status: `pronto-para-revisar`
- Resumo: FAB mic global; `POST /api/voice/parse` multi-intent; confirm + executor (pocket, saldo, depósito, despesa).
- Arquivos-chave: `gemini-parse-voice-command.ts`, `api/voice/parse`, `voice-command-fab.tsx`, `app-shell.tsx`
- Próximo: smoke Falar → Confirmar nos 4 intents

## 2026-10-01 — release voz em produção

- Status: `estável`
- Resumo: Commit + push `main` da despesa por voz; `GEMINI_API_KEY`/`GEMINI_MODEL` na Vercel.
- Arquivos-chave: `purchase-form.tsx`, `parse-voice/route.ts`, `gemini-parse-purchase.ts`
- Próximo: smoke Falar/Enviar em prod

## 2026-10-01 — docs voz para agentes

- Status: `estável`
- Resumo: README e APP.md documentam despesa por voz (MediaRecorder + Gemini, Parar/Enviar, schema, arquivos).
- Arquivos-chave: `README.md`, `.cursor/agent-context/APP.md`, `CURRENT.md`
- Próximo: commit quando o usuário pedir

## 2026-10-01 — voz Gemini OK (validado)

- Status: `pronto-para-revisar`
- Resumo: Usuário confirmou que áudio preenche despesas bem; schema Gemini corrigido; UX Parar/Enviar.
- Arquivos-chave: `purchase-form.tsx`, `gemini-parse-purchase.ts`
- Próximo: commit / env prod se for publicar

## 2026-10-01 — voz: MediaRecorder + Gemini (fix network)

- Status: `pronto-para-revisar`
- Resumo: Web Speech gerava `network`; passou a gravar áudio e enviar ao Gemini para parse.
- Arquivos-chave: `purchase-form.tsx`, `gemini-parse-purchase.ts`, `parse-voice/route.ts`
- Próximo: retestar Falar no Chrome

## 2026-10-01 — despesa por voz (Web Speech + Gemini)

- Status: `pronto-para-revisar`
- Resumo: Botão Falar em Nova despesa; STT no browser; parse via Gemini; form preenchido para confirmar e salvar.
- Arquivos-chave: `purchase-form.tsx`, `api/purchases/parse-voice/route.ts`, `gemini-parse-purchase.ts`
- Próximo: configurar `GEMINI_API_KEY` e testar no Chrome

## 2026-10-01 — removeu total das despesas

- Status: `pronto-para-revisar`
- Resumo: Removido o card “Total das despesas” (soma agregada) da lista em `purchase-list.tsx`.
- Arquivos-chave: `src/features/purchases/purchase-list.tsx`
- Próximo: validar visualmente a tela de despesas

## 2026-09-30 — docs de agentes no git

- Status: `estável`
- Resumo: Commit do handoff (`.cursor/agent-context`, regra/skill) e README com rotas faltantes.
- Arquivos-chave: `.cursor/agent-context/*`, `.cursor/rules/document-agent-changes.mdc`, `.cursor/skills/document-changes/SKILL.md`, `README.md`
- Próximo: validar migrate 0013 + cron + smoke push em prod

## 2026-09-30 — push em produção

- Status: `estável`
- Resumo: Deploy prod Ready; env VAPID + CRON_SECRET configurados. Falta confirmar migration 0013, cron agendado e smoke test de notificações.
- Arquivos-chave: (código já em `ef2a560` / `main`) · docs locais em `.cursor/agent-context/`
- Próximo: validar migrate 0013 + cron + Ativar notificações em prod

## 2026-09-30 — inventário app + APP.md

- Status: `pronto-para-revisar`
- Resumo: Mapa estável da app (rotas/APIs/gaps) e CURRENT alinhado ao HEAD com push due-soon; checklist prod pendente.
- Arquivos-chave: `.cursor/agent-context/APP.md`, `CURRENT.md`, `README.md`
- Próximo: validar migration 0013 + VAPID/CRON/cron em produção

## 2026-09-30 — bootstrap documentação de agentes

- Status: `estável`
- Resumo: Regra always-apply + skill + CURRENT/LOG para handoff entre agentes.
- Arquivos-chave: `.cursor/rules/document-agent-changes.mdc`, `.cursor/skills/document-changes/SKILL.md`, `.cursor/agent-context/`
- Próximo: usar e atualizar CURRENT na próxima feature real
