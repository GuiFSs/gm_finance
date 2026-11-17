---
version: 1
slug: "src-app-protected-dashboard-page-tsx"
primary_target: "src/app/(protected)/dashboard/page.tsx"
related_targets: ["src/app/(protected)/movements/page.tsx","src/app/(protected)/purchases/page.tsx"]
---

# Surface brief: Dashboard, Movimentos, Compras

Scope: the three most-used screens (`/dashboard`, `/movements`, `/purchases`) plus the app shell they sit in. Mode: Operate. Phone first (PWA), desktop secondary.

Job: answer "quanto sobra este mês", show what is still open or due so it can be marked paid, and log a new compra in one tap. User pains: too much scrolling, too much explanatory text.

Constraints: pt-BR copy; keep every existing function (month navigation, Pago toggles, fatura paid, pagamento da fatura modal, purchase detail/edit/delete, filters, sort, nova categoria/tag, voice FAB). Other routes are not redesigned now; they inherit the new tokens.

## Direction contract

THESIS: The month is a concrete composition. Money is drawn as flat planes whose widths are the amounts, not as metric cards. Refuses the fintech default of a big balance card plus a grid of same-size stat tiles.

OWN-WORLD: Brazilian concrete art (Grupo Ruptura, Noigandres). Near-black ground, off-white ink, three flat pigments in planes only: vermelho for money out/paid, amarelo for open/due, azul for money in/what's left. Square corners everywhere, 1px rules, lowercase Futura-lineage headings (Jost), tabular figures. Colour lives in planes and markers; amounts stay in ink with a sign.

STORY: Open the app, read what's left in one number, see the month split into pago / em aberto / previsto / sobra, tick what got paid, tap + to log a compra.

FIRST VIEWPORT: Phone. Top strip: wordmark and month switcher. "sobra em novembro" lowercase over a 52px amount. A full-width 64px plane bar with a four-line legend. "vence agora" with dated rows (a square day tile, title, source, amount, Pago check). Bottom tab bar: início, movimentos, + (nova compra), compras, mais.

FORM: Concreto, candidate 7 of 7 on the grounded list. seed:29f3eb64df3fcb8d. Raises: three type sizes, ranked by weight (timetable slide rack); nothing labeled twice (Factory sleeve); a paid row moves in place and the bar replans (boarding pass); every plane filters to its rows (monochrome marketing). Signature move: the month plane bar, tappable, on Dashboard and Movimentos.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
