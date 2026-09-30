---
name: document-changes
description: >-
  Documenta alterações do projeto de forma clara para handoff entre agentes.
  Atualiza .cursor/agent-context/CURRENT.md e LOG.md. Use ao finalizar mudanças
  de código, ao iniciar uma sessão com trabalho em andamento, quando o usuário
  pedir documentar, handoff, contexto para agentes, ou quando a regra
  document-agent-changes exigir atualização.
---

# Documentar alterações (handoff entre agentes)

Manter `.cursor/agent-context/` como fonte de verdade para o que está acontecendo no repo. Escrever para **outro agente** que não viu este chat.

## Quando usar

- Após qualquer mudança relevante no código (mesmo parcial)
- No início de uma tarefa se `CURRENT.md` parecer desatualizado
- Quando o usuário pedir documentar / handoff / contexto

## Fluxo

1. Ler `.cursor/agent-context/CURRENT.md` (e `APP.md` se a mudança alterar mapa/APIs/gaps).
2. Conferir o que mudou nesta sessão (`git status`, `git diff` se útil).
3. Reescrever `CURRENT.md` com o template abaixo (substituir o conteúdo; não acumular seções infinitas).
4. Se rotas, APIs, auth, env usados no código ou gaps permanentes mudaram → atualizar `APP.md`.
5. Prepender uma entrada curta no topo de `LOG.md` (abaixo do título).
6. Não mencionar segredos nem valores de env; só nomes de variáveis se necessário.

## Template — CURRENT.md

```markdown
# Contexto atual (agentes)

> Atualizado: YYYY-MM-DD — resumo em uma linha do último trabalho

## Status

`em-andamento` | `pronto-para-revisar` | `bloqueado` | `estável`

## Objetivo recente

O que se tentou alcançar (1–3 frases).

## O que mudou

- caminho/arquivo — o que e por quê (bullet por mudança importante)

## Decisões

- Decisão e motivo (só o que outro agente precisa respeitar)

## Ainda aberto / próximo passo

- [ ] Próxima ação concreta
- [ ] Riscos ou dependências (env, migration, deploy)

## Como validar

Comandos ou checks manuais mínimos para verificar o trabalho.

## Áreas tocadas

Pastas/módulos principais (ex.: `src/app/api/push`, `src/db/schema`).
```

## Template — entrada em LOG.md

Prepender **no topo** (mais recente primeiro), após o heading do arquivo:

```markdown
## YYYY-MM-DD — título curto

- Status: `em-andamento` | `pronto-para-revisar` | `bloqueado` | `estável`
- Resumo: 1–2 frases
- Arquivos-chave: `path1`, `path2`
- Próximo: ação concreta (ou "nenhum")
```

Manter `LOG.md` enxuto: no máximo ~30 entradas recentes; arquivar/remover as mais antigas se crescer demais.

## Estilo

- Português, direto, imperativo onde fizer sentido
- Preferir caminhos de arquivo e nomes de símbolos a prosa vaga
- Assumir que o leitor **não** tem o transcript do chat
- Uma decisão por bullet; evitar fluff

## Exemplo bom vs ruim

**Ruim:** "Melhorei as notificações."

**Bom:** "Adicionei `src/app/api/push/subscribe/route.ts` e migration `0013_push_notifications.sql`. Falta setar `VAPID_*` em produção e testar subscribe no dashboard."
