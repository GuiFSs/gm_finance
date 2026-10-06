# Log de alterações (agentes)

Entradas mais recentes no topo. Ver skill `document-changes` para o formato.

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
