# Contexto atual (agentes)

> Atualizado: 2026-11-17 — redesign "Concreto" das 3 páginas principais (dashboard, movimentos, compras) + shell. `DESIGN.md` e `.impeccable/design.json` reescritos (overwrite) para o sistema Concreto.

## Status

`pronto-para-revisar`

## Objetivo recente

O usuário pediu um redesign de `/dashboard`, `/movements` e `/purchases` com nova identidade visual (as outras rotas migram depois). Prioridades: dashboard mostra quanto sobra no mês; movimentos mostra o que está aberto/vence para marcar pago; compras = lançar despesa rápido. Dores: muito scroll e muito texto explicativo.

## O que mudou

- **Tokens/tema** — `src/app/globals.css`: paleta `.dark` nova (fundo `#141414`, tinta `#ebebe8`), planos `--plane-out` (vermelho `#e2352b`, saída/pago), `--plane-open` (amarelo `#f2c230`, aberto/vence), `--plane-in` (azul `#2f5bd3`, entrada/sobra) e `--ink-out/open/in` para texto; raio 0 em todos os `--radius-*`; `tnum` global; `.plane-segment` com transição de flex-grow.
- `src/app/layout.tsx`: Geist → Jost (`--font-jost`); `theme-color` `#141414`.
- `src/shared/ui/card.tsx`, `button.tsx`: sem sombras. `toggle.tsx`, `toggle-group.tsx` instalados via `npx shadcn add` (MCP shadcn estava indisponível).
- **Novo `src/features/month/`**: `month-model.ts` (status das linhas, totais do mês, itens em aberto, formatação), `month-plane.tsx` (barra-assinatura do mês; segmentos e legenda filtram), `ledger.tsx` (`DayTile`, `LedgerRow`, `PaidCheck`, `MonthSwitcher`, `SectionHeading`), `open-items-list.tsx` (lista "vence agora" com marcar pago).
- `src/features/dashboard/dashboard-overview.tsx` reescrito (sobra do mês + plano, vence agora, próximos, saldos, por categoria, gráfico). `category-spend.ts` novo; `month-budget-summary.tsx` removido.
- `src/features/movements/movements-list.tsx` reescrito (lê `?month=&status=`; grupos por fonte ou por data; fatura do cartão com "marcar fatura paga"/"pagar com…"; fontes em accordion).
- `src/features/purchases/purchase-list.tsx` reescrito (lista por mês, filtros em Sheet, `?new=1`/`?edit=`). `purchase-form.tsx`: Valor primeiro em tamanho display, seções "compra"/"pagamento"/"categoria"/"tags", sem textos de ajuda, voz como botão "Preencher falando".
- `src/shared/ui/app-shell.tsx` reescrito (sidebar desktop; tab bar mobile com "+" central e Sheet "mais"). `voice-command-fab.tsx`: FAB só no desktop; exporta `VOICE_OPEN_EVENT` (`gm:voice-open`).
- Page wrappers das 3 rotas simplificados (Suspense onde há `useSearchParams`).
- `DESIGN.md` + `.impeccable/design.json`: overwrite com o sistema Concreto (escolha do usuário); rotas não redesenhadas e defaults 14px dos primitivos shadcn ficam marcados como drift.
- Impeccable: brief da superfície em `.impeccable/surfaces/src-app-protected-dashboard-page-tsx.md` (contrato de direção); mocks em `.impeccable/mocks/decision/`; capturas em `.impeccable/review/`.

## Decisões

- Valores em tinta com sinal (−/+); cor fica nos planos e marcadores, não no número.
- Escala tipográfica: 48 (valor display) / 24 (títulos) / 15 (resto). Labels do tab bar a 12px como chrome.
- Nada rotulado duas vezes (ex.: legenda "sobra" sem valor; "vence agora" mostra só a contagem).
- Itens do cartão usam `dueDate` como data efetiva.

## Ainda aberto / próximo passo

- [ ] Smoke no banco real: marcar/desmarcar Pago (despesa de conta e fatura do cartão) pela lista "vence agora" e por `/movements`
- [ ] Migrar as demais rotas (orçamento, categorias, caixinhas, cartões, recorrentes, metas, depósitos) para o novo visual
- [ ] Lint: `react-hooks/set-state-in-effect` em `purchase-list.tsx` (efeito dos params de URL, já existia), e erros antigos em `budget-planner` e no funding modal
- [ ] Pendência anterior: confirmar migração `0014_expense_payments` no Turso de **produção**
- [ ] Commitar

## Como validar

1. `npx tsc --noEmit` limpo
2. `/dashboard`: valor da sobra no topo, barra do mês; clicar num segmento/legenda leva a `/movements?status=…`
3. `/movements`: switcher de mês ao lado do título; filtro pela barra; alternar "por fonte/por data"
4. Mobile: "+" abre nova compra; "mais" → "comando por voz" abre o dialog de voz

## Áreas tocadas

`src/app/globals.css`, `src/app/layout.tsx`, `src/features/{month,dashboard,movements,purchases,voice}`, `src/shared/ui/{app-shell,button,card,toggle,toggle-group}.tsx`, `package.json`, `DESIGN.md`, `.impeccable/`, `.cursor/agent-context/`
