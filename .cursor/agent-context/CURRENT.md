# Contexto atual (agentes)

> Atualizado: 2026-11-17 — `DESIGN.md` e `.impeccable/design.json` gerados (scan do sistema visual incumbente); pendências do pagamento manual mantidas abaixo

## Status

`pronto-para-revisar`

## Objetivo recente

Documentar o sistema visual atual em `DESIGN.md` (contrato para agentes gerarem telas no mesmo padrão) e no sidecar `.impeccable/design.json` (componentes e tokens para o painel live). Nenhum código de app foi alterado.

## O que mudou

- `PRODUCT.md` (raiz, sessão anterior) — plataforma `web`, usuários, propósito, restrições, princípios
- `DESIGN.md` (novo, raiz) — frontmatter com tokens do tema escuro (padrão enviado), 8 seções canônicas, North Star "The Household Ledger"
- `.impeccable/design.json` (novo) — schemaVersion 2: tonal ramps, sombras, motion, breakpoints, 8 componentes (`ds-*`), narrativa
- `.cursor/agent-context/CURRENT.md` e `LOG.md` — handoff atualizado

## Decisões

- Tema escuro é o padrão enviado (`<html class="dark">`); o frontmatter usa os valores escuros. Tema claro existe em `globals.css` (`:root`), mas não é o padrão.
- Valores do DESIGN.md vieram do código: tokens em `globals.css`, componentes em `src/shared/ui`, classes de status em `movements-list.tsx`.
- Tokens de status: verde = entrada, vermelho = saída, âmbar = pendente/atenção (confirmado pelo usuário). Vermelho destrutivo (`destructive`) é reservado a saldo negativo e ações destrutivas.
- **Drift a resolver (não documentado como sistema):** `app-shell.tsx` e o header mobile usam `gray-50/900/950` em vez dos tokens. Navegação também usa classes Tailwind (`blue-900/30`, `gray-300`), marcadas no DESIGN.md como drift.
- Fonte Geist Mono está carregada em `layout.tsx` mas nenhum componente usa.
- Valores de sombra e motion no sidecar são os defaults do Tailwind (`shadow-md`, `shadow-lg`, 150ms), não valores customizados.
- Tonal ramps: azul, verde, vermelho e âmbar usam escalas Tailwind; neutros usam uma rampa compartilhada construída a partir dos próprios tokens e de steps do slate.
- Ainda sem `.impeccable/config.json` (geração de imagem não detectada). Live mode não configurado.

## Ainda aberto / próximo passo

- [ ] Revisar `DESIGN.md` com o usuário (inclusive a seção Colors drift e a escolha entre tokens e classes Tailwind)
- [ ] Decidir se o drift de `gray-*` no shell vira tokens (mudança de código, fora deste handoff)
- [ ] Commitar `PRODUCT.md`, `DESIGN.md`, `.impeccable/design.json`, `.cursor/agent-context/`
- [ ] Pendência do pagamento manual (sessão anterior): confirmar que a migração `0014_expense_payments` está aplicada no Turso de **produção** (foi aplicada no banco do `.env.local`)
- [ ] Pendência do pagamento manual: smoke em `/movements` — marcar/desmarcar despesa de conta e fatura do cartão (agrupado e lista por data); entrada não ganha "Pago"

## Como validar

1. `PRODUCT.md` tem `## Platform` = `web` e o comentário `impeccable:product-schema 1`
2. `DESIGN.md` tem frontmatter YAML válido, todas as referências `{token}` resolvidas e as 8 seções canônicas na ordem
3. `.impeccable/design.json` é JSON válido; as 14 chaves de `colorMeta` batem com as 14 cores do frontmatter
4. Pagamento manual: abrir `/movements` no mês atual; despesa de conta ou caixinha com data passada mostra "Em aberto" e checkbox Pago (não "Já pago"); marcar, recarregar e conferir que persiste; no grupo do cartão, "Marcar fatura paga" quita todas as compras do mês; entrada do mês não tem checkbox Pago

## Áreas tocadas

`PRODUCT.md`, `DESIGN.md`, `.impeccable/design.json`, `.cursor/agent-context/`
