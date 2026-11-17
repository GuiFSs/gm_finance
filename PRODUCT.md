# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Guilherme and Maryane, two partners who share one household ledger as equals. Both log entries and review the month, mostly from their phones. Each sees and edits the same data.

## Product Purpose

A private household finance manager for a couple ("Gestão da casa"). It keeps the month under control: what has been paid, what is due, and what is left, across bank accounts, pockets (caixinhas), credit cards, budgets, recurring bills, deposits, and goals.

Success (inferred from the code, to confirm): the two of them can answer "what's paid, what's due, what's left" from the app without a spreadsheet.

## Positioning

Not yet confirmed by the user. Candidates the product already implements that a generic budgeting app would not truthfully copy:

- Card statements follow the due month: a purchase made on or after the closing day rolls into the next statement, and marking a statement paid settles every purchase of that month.
- Voice entry: a spoken description fills the expense form or proposes actions (create pocket, set balance, deposit, purchase). The user confirms before anything is saved.
- Pockets (caixinhas) as named balances inside the household money, with transfers between them.

## Operating Context

- Used mostly on the phone. Installable as a PWA on iPhone and Android home screens; desktop is secondary.
- Daily logging of expenses, a monthly review on the movements screen, and paying card statements.
- Due-date alerts: one daily push digest for items due today or tomorrow, sent by an external daily cron. On iOS this requires the app to be installed to the home screen.
- Deployed on Vercel from `main`. Data lives in a Turso (libSQL) database.

## Capabilities and Constraints

Capabilities: dashboard, movements of the month, purchases (including installments), pockets, cards with statements, recurring items, deposits, goals, budgets, categories, voice entry, due-date push alerts.

Constraints:

- Voice entry requires a Gemini API key.
- Push alerts require the PWA to be installed. The service worker does not run in `next dev`.
- Access is a single shared PIN from the `LOGIN_PIN` environment variable. There are no per-user accounts.
- Known gaps: goals have no edit or delete, pockets and cards have no delete, tags have no edit or delete. Whether these gaps are intended is undecided.

Terminology to keep in UI copy: "caixinha" (pocket), "fatura" (card statement), "movimentos" (movements), "compra" (purchase or expense), "recorrente" (recurring), "depósito" (deposit).

## Brand Commitments

- Name: "G&M Finance" (Guilherme and Maryane). Shell tagline: "Gestão da casa".
- UI copy in Brazilian Portuguese (pt-BR).
- Private for the two of them: no public sign-up and no marketing.
- Must work as an installable PWA on iPhone and Android.

## Evidence on Hand

- Icons: `public/icon-192.png`, `public/icon-512.png`, `public/apple-touch-icon.png`, `public/favicon.svg`.
- Product docs: `README.md`, `.cursor/agent-context/APP.md` (route map, flows, known gaps).
- No testimonials, case studies, press, screenshots, or marketing copy exist. Do not invent any.

## Product Principles

1. The month and the due date are the unit of truth. Card statements and due-soon alerts follow the due month, not the purchase date.
2. Paid status is set by a person, never inferred from a date.
3. Shared household, shared data. Any signed-in partner can view and edit household entries. The app records who created an entry but does not restrict access by it.
4. Capture is fast, saving is deliberate. Voice and quick entry fill the form or propose changes; the user reviews and confirms before anything is saved.
5. Built for two people, in Portuguese. It is not a general-purpose budgeting product and should not be shaped for one.
