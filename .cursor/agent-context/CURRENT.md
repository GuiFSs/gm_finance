# Contexto atual (agentes)

> Atualizado: 2026-11-17 — todas as rotas restantes, login e diálogos migrados para o visual Concreto.

## Status

`pronto-para-revisar`

## Objetivo recente

Com dashboard, movimentos e compras já no visual novo, o usuário pediu o mesmo nas outras telas: orçamento, categorias, caixinhas, cartões, recorrentes, metas, depósitos e login, além dos diálogos compartilhados. Cada tela com dinheiro ganhou uma barra de planos própria. A revisão final (impeccable-finish-reviewer) deu `ship`.

## O que mudou

- `src/shared/ui/*` — os primitivos shadcn foram reestilizados: 15px, cantos retos, sem sombra.
  - `button` agora tem 40px. O disabled do default vira contorno apagado.
  - `input` e `select` têm 40px.
  - Título do `dialog`/`sheet` com 24px bold lowercase, o fechar é um quadrado de 40px e o `DialogContent` usa `grid-cols-[minmax(0,1fr)]` (corrige overflow no mobile).
  - O `modal` aceita `title: ReactNode`.
  - `dropdown-menu.tsx` foi instalado (shadcn) e reestilizado.
- `src/shared/ui/page-header.tsx` — exporta `PageHeader`, `Field` (label, hint, erro) e `FormActions`. No mobile do `FormActions`, cancelar e salvar ficam lado a lado e o destrutivo fica embaixo. Do `sm` para cima, o destrutivo vai para a esquerda.
- `src/features/month/plane-bar.tsx` (novo) — `PlaneBar` (tamanhos `sm|md|lg`; segmento com `fill` interno; `onSelect`) e `PlaneLegend`. A legenda descarta item com `value` zero e usa uma coluna quando tem um item só.
- `src/features/month/ledger.tsx` — novos `AnswerFigure`, `LedgerGroup` e `LedgerSkeleton`.
- `src/app/(protected)/*/page.tsx` — as rotas só renderizam o componente da feature.
- **Caixinhas** (`features/pockets/pocket-management.tsx`): figura "guardado nas caixinhas". Plano azul por caixinha, e o tile de cada linha mostra a fatia em %. A linha abre a edição, e o saldo aceita valor negativo.
- **Cartões** (`features/cards/card-management.tsx`): figura "livre nos cartões", ou "passou do limite dos cartões" quando negativa. Cada cartão tem um plano usado/livre ou usado/excedido. Botões "pagar fatura" e "editar".
- **Pagar fatura** (`card-statement-funding-modal.tsx`):
  - O `MonthSwitcher` substituiu o input de mês.
  - Os meses já planejados viraram `Button` shadcn.
  - Novo plano por fonte.
  - "remover plano deste mês" só aparece se houver plano.
- **Metas** (`features/goals/goal-management.tsx`, reescrito): figura "falta guardar". Cada meta tem um plano guardado/falta e o valor mensal até o prazo.
- **Categorias**: lista ordenada. Tocar a linha renomeia; a lixeira exclui.
- **Recorrentes**:
  - As abas foram removidas e a lista vai por próxima data.
  - Figura "fixo por mês", com um plano por item colorido pelo vencimento.
  - "Executar agora" virou "lançar vencidos".
  - Excluir fica dentro do modal de edição.
- **Depósitos** (`deposit-management.tsx`, reescrito com a lógica preservada):
  - Novo `SplitEditor` (R$/%, com prévia do plano).
  - Figura "entrou em {mês}" com plano por destino.
  - Toggle "avulsos | recorrentes".
  - Excluir fica dentro do modal.
- **Orçamento**:
  - `budget-planner.tsx`: figura "livre no plano", com um plano por categoria e o gasto preenchido. Tocar um segmento rola até a linha. O plano não aparece quando o mês está vazio. "copiar de {mês}" só aparece no estado vazio, e a barra sticky ficou só com Salvar.
  - `budget-allocation-rows.tsx`: cada linha tem uma mini-barra (planejado × gasto) e o texto "gasto X". "usar o restante" e "dividir em tags" ficam num `DropdownMenu` (…).
  - `category-picker-field`/`tag-picker-field`: "+ nova categoria/tag" virou a última opção do select.
- **Login** (`features/auth/login-form.tsx`): "g&m" em 48px. Toggle de duas pessoas no lugar do select e PIN numérico. O toast de boas-vindas saiu.
- **Detalhe da compra** (`purchase-detail-dialog.tsx`):
  - O título é o nome da compra.
  - As parcelas são `LedgerRow`.
  - O meta da parcela ficou "fatura nov/26 · vence 25/11".
- `enable-push.tsx`, `voice-command-fab.tsx`, filtro em `purchase-list.tsx` — passaram para 15px e tinta vermelha de texto.
- `src/app/globals.css` — esconde os spinners de `input[type=number]`.
- `DESIGN.md` — o escopo de evidência agora cobre todas as rotas. Novas seções: Dialogs and Forms, Answer Figure e Route Planes. Também foram atualizados disabled, inputs e toggle.

## Decisões

- O número negativo da figura continua na tinta vermelha (`text-ink-out`), porque o DESIGN.md permite isso para déficit. Já o rótulo muda para dizer que passou ("passou do limite…"), em vez de "livre" com valor negativo.
- A barra tem uma cor por significado: vermelho saiu/usado, amarelo vence em até 2 dias, azul entrou/guardado/livre. Contorno é previsto. Listras são excesso.
- Ações destrutivas ficam dentro do modal de edição (menos em categorias). Confirmar a exclusão fecha os dois modais.
- O shadcn MCP estava fora do ar, então `dropdown-menu` foi instalado com `npx shadcn@latest add dropdown-menu`.

## Ainda aberto / próximo passo

- [ ] Commitar (o diff é grande: `src/shared/ui`, `src/features/*`, `src/app/(protected)/*`, `DESIGN.md`)
- [ ] Lint: os erros antigos de `react-hooks/set-state-in-effect` em `budget-planner.tsx`, `card-statement-funding-modal.tsx` e `purchase-list.tsx` continuam lá
- [ ] Smoke no banco real: marcar/desmarcar Pago em `/movements`. Criar, editar e excluir em caixinhas, recorrentes, depósitos e metas (os prints usaram metas mockadas, porque o banco não tem nenhuma)
- [ ] Pendência anterior: confirmar a migração `0014_expense_payments` no Turso de **produção**

## Como validar

1. `npx tsc --noEmit` limpo
2. Em 390px, abrir cada rota. Não pode haver overflow horizontal, e a figura e o plano aparecem no topo.
3. `/budgets`: em setembro (que tem plano), cada linha tem uma mini-barra; o menu "…" mostra "usar o restante"/"dividir em tags", e o select tem "+ nova categoria" no fim.
4. `/cards`: o botão "pagar fatura" abre o modal. Em maio (mês com plano), "remover plano deste mês" aparece.
5. Prints de referência em `.impeccable/review/routes/`

## Áreas tocadas

`src/shared/ui/`, `src/features/{pockets,cards,goals,categories,recurring,deposits,budgets,auth,purchases,notifications,voice,month}/`, `src/app/(protected)/`, `src/app/globals.css`, `DESIGN.md`, `.cursor/agent-context/`
