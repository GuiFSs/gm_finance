---
version: 1
slug: "src-app-protected-dashboard-page-tsx"
primary_target: "src/app/(protected)/dashboard/page.tsx"
related_targets: ["src/app/(protected)/movements/page.tsx","src/app/(protected)/purchases/page.tsx"]
---

# Surface brief: Dashboard, Movimentos, Compras

Scope: the three most-used screens (`/dashboard`, `/movements`, `/purchases`) plus the app shell they sit in. Mode: Operate. Phone first (PWA), desktop secondary.

Job: início answers sobra for the month or the year. Movimentos keeps the lists and the paid checks. Compras logs a compra in one tap.

Constraints: pt-BR copy; keep every existing function (month navigation, Pago toggles, fatura paid, pagamento da fatura modal, purchase detail/edit/delete, filters, sort, nova categoria/tag, voice FAB). Other routes are not redesigned now; they inherit the new tokens.

## Direction contract

THESIS: The month is a concrete composition. Money is drawn as flat planes whose widths are the amounts, not as metric cards. Refuses the fintech default of a big balance card plus a grid of same-size stat tiles.

OWN-WORLD: Brazilian concrete art (Grupo Ruptura, Noigandres). Near-black ground, off-white ink, three flat pigments in planes only: vermelho for money out/paid, amarelo for open/due, azul for money in/what's left. Square corners everywhere, 1px rules, lowercase Futura-lineage headings (Jost), tabular figures. Colour lives in planes and markers; amounts stay in ink with a sign.

STORY: Open the app, read what's left in one number, see the month as a plane and as a pie of entra, sai and sobra, or switch to the year and see the twelve months. Categories are a pie with each share written as a percent; spending with no category reads "sem categoria". Opening a category shows its tags, each in its own color. In the year, pizza | por mês switches that section to twelve columns drawn like the year chart, each column a month stacked in category colors. Tapping a column lists that month's shares. Opening a category redraws the columns in tag colors. Tick what got paid on movimentos.

FIRST VIEWPORT: Phone. Top strip: wordmark, mês | ano, and the month or year switcher. "sobra em novembro" or "falta em 2026" over the amount, then entra · sai. Month: the plane bar, then the pie. Year: "por mês", twelve columns. Below, "saldos agora" and "por categoria". Bottom tab bar: início, movimentos, + (nova compra), compras, mais.

FORM: Concreto, candidate 7 of 7 on the grounded list. seed:29f3eb64df3fcb8d. Raises: three type sizes, ranked by weight (timetable slide rack); nothing labeled twice (Factory sleeve); a paid row moves in place and the bar replans (boarding pass); every plane filters to its rows (monochrome marketing). Signature move: the month plane bar, tappable, on Dashboard and Movimentos.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
