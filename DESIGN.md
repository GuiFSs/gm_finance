---
name: "G&M Finance"
description: "Private two-person household cashbook, drawn as Brazilian concrete art: the month as flat planes of colour."
colors:
  ground: "#141414"
  surface: "#1b1b1a"
  surface-muted: "#1f1f1e"
  surface-hover: "#262625"
  rule: "#2c2c2a"
  rule-strong: "#3a3a37"
  ink: "#ebebe8"
  ink-muted: "#a3a39e"
  plane-out: "#e2352b"
  plane-open: "#f2c230"
  plane-in: "#2f5bd3"
  ink-out: "#ff7a6e"
  ink-open: "#f2c230"
  ink-in: "#93abff"
  on-plane-light: "#ffffff"
typography:
  display:
    fontFamily: "Jost, system-ui, sans-serif"
    fontSize: "48px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.03em"
    fontFeature: "\"tnum\" 1"
  headline:
    fontFamily: "Jost, system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.025em"
  body:
    fontFamily: "Jost, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.375
    fontFeature: "\"tnum\" 1"
  body-strong:
    fontFamily: "Jost, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 500
    lineHeight: 1.375
    fontFeature: "\"tnum\" 1"
  label:
    fontFamily: "Jost, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1
rounded:
  none: "0px"
spacing:
  plane-gap: "3px"
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  section: "32px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.ground}"
    rounded: "{rounded.none}"
    padding: "8px 16px"
    height: "44px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "8px 16px"
  button-ghost-hover:
    backgroundColor: "{colors.surface-hover}"
    textColor: "{colors.ink}"
  button-outline:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "8px 16px"
  button-new-purchase-tab:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.ground}"
    rounded: "{rounded.none}"
    size: "56px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "24px"
  month-plane-bar:
    rounded: "{rounded.none}"
    height: "64px"
  month-plane-bar-compact:
    rounded: "{rounded.none}"
    height: "48px"
  day-tile:
    typography: "{typography.body-strong}"
    rounded: "{rounded.none}"
    size: "40px"
  day-tile-open:
    backgroundColor: "{colors.plane-open}"
    textColor: "{colors.ground}"
  day-tile-out:
    backgroundColor: "{colors.plane-out}"
    textColor: "{colors.on-plane-light}"
  day-tile-in:
    backgroundColor: "{colors.plane-in}"
    textColor: "{colors.on-plane-light}"
  ledger-row:
    typography: "{typography.body}"
    textColor: "{colors.ink}"
    padding: "12px 0"
  paid-check:
    rounded: "{rounded.none}"
    size: "24px"
  paid-check-checked:
    backgroundColor: "{colors.plane-out}"
    textColor: "{colors.on-plane-light}"
  nav-item:
    typography: "{typography.body}"
    textColor: "{colors.ink-muted}"
    padding: "10px 12px"
  nav-item-active:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.ground}"
  tab-bar-item:
    typography: "{typography.label}"
    textColor: "{colors.ink-muted}"
    height: "56px"
  tab-bar-item-active:
    textColor: "{colors.ink}"
  segmented-toggle-on:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.ground}"
    rounded: "{rounded.none}"
    height: "32px"
    padding: "0 12px"
---

# Design System: G&M Finance

## Overview

**Creative North Star: "Concreto"**

The month is a concrete composition. Money is drawn as flat planes whose widths are the amounts, on a near-black ground, in the manner of Brazilian concrete art (Grupo Ruptura, Noigandres). Three pigments do all the work: red for money that went out, yellow for what is open or due, blue for money in and what is left. Everything else is off-white ink, 1px rules, and square corners. The screen reads as a few heavy shapes plus a quiet list; there are no metric cards and no grid of equal stat tiles.

Density is operational and phone-first. One number answers "quanto sobra", one bar shows how the month splits, and dated rows carry the work of ticking things paid. Type is lowercase Jost with tabular figures, ranked by weight more than by size: three sizes cover almost everything. Text is kept to the minimum; a value is labelled once, by its legend or its heading, never twice.

Colour is structural, not decorative. It lives in planes, day tiles, legend markers and the paid check. Amounts stay in ink and carry their sign; the colour beside them already says what they are.

**Key Characteristics:**
- Near-black ground (#141414) with off-white ink (#ebebe8); dark is the shipped default.
- Three flat pigments used only as planes and markers: vermelho, amarelo, azul.
- Square corners everywhere (all radii 0px); flat surfaces, separation by 1px rules.
- Lowercase bold Jost headings, tabular figures globally.
- The month plane bar is the signature: width equals value, tappable to filter.

## Colors

A black-and-off-white ground with three primary pigments that appear as shapes, not as text decoration.

### Primary
- **Vermelho Ruptura** (plane-out): money out and paid. Paid segment of the plane bar, paid day tile, checked paid box, the outlined "previsto" plane, and the stripe of the "falta" overlay. Also the destructive colour.
- **Amarelo Noigandres** (plane-open): open or due. The "em aberto" segment, due-soon day tiles (filled within two days, outlined later), legend markers, focus ring, caret and text selection.
- **Azul Concreto** (plane-in): money in and what is left. The "sobra" segment and income day tiles.

### Secondary
- **Text inks** (ink-out, ink-open, ink-in): lighter companions of the three pigments, for the rare case where state must sit in text on the dark ground: a deficit amount, a due-today meta line. Pigment hexes are too dark (red, blue) to read as 15px text on #141414; these are the legible versions.

### Neutral
- **Ground** (ground): the page, sidebar and tab bar. Also the dark stripe in the deficit overlay.
- **Raised Slab** (surface): cards, dialogs, sheets, popovers. One step above the ground, no shadow.
- **Quiet Slab** (surface-muted) and **Hover Slab** (surface-hover): muted fills and hover/active backgrounds on rows, legend items and nav.
- **Rule** (rule): 1px separators between ledger rows and around regions.
- **Strong Rule** (rule-strong): input borders, neutral day tiles, the dashed empty-month bar.
- **Ink** (ink): all primary text and every amount; inverted as the fill of primary buttons, the active nav item and the "+" tab.
- **Pencil** (ink-muted): meta lines, legend labels, inactive navigation.

### Named Rules
**The Planes Carry Colour Rule.** Pigment appears as filled or outlined shapes (planes, tiles, markers, checks). Amounts are set in ink with a sign (− for out, + for in); only a deficit or a due-today line moves into a text ink.

**The Three Pigments Rule.** Red, yellow, blue, each with one meaning everywhere: out/paid, open/due, in/left. No fourth hue, no smooth gradients, no tints used as backgrounds; the only patterned fill is the deficit stripe.

## Typography

**Display Font:** Jost (with system-ui, sans-serif)
**Body Font:** Jost (with system-ui, sans-serif)

**Character:** A Futura-lineage geometric sans used lowercase and heavy for headings, plain for everything else. Tabular figures are on globally (`font-feature-settings: "tnum" 1` on body), so columns of amounts align.

### Hierarchy
- **Display** (700, 48px, line-height 1, −0.03em): the single answer amount ("sobra em novembro") on Dashboard and Movimentos. Turns ink-out when the month is in deficit.
- **Headline** (700, 24px, tight, lowercase): page titles, the wordmark, section headings ("vence agora", "próximos").
- **Body** (400/500, 15px): everything else: ledger titles (500), meta lines (400, pencil), amounts (500), legend, nav, buttons in the redesigned surfaces.
- **Label** (400/500, 12px, lowercase): the mobile tab-bar labels only. A chrome exception, not a fourth content size.

### Named Rules
**The Three Sizes Rule.** Content uses 48, 24 and 15px, ranked by weight. A new size needs a reason the existing three cannot carry.

**The Lowercase Rule.** Headings, nav and tab labels are lowercase. No uppercase, no letter-spaced labels above headings.

**The Said Once Rule.** A value is labelled once: by its section heading, its legend entry, or its meta line. No caption repeating the heading, no explanatory paragraph under a number.

## Layout

Phone first. Content column with 16px side padding (24px from 640px, 32px from 768px), capped at 1024px wide. Below 768px the app has a fixed bottom tab bar (início, movimentos, a 56px square "+" for nova compra raised 20px above the bar, compras, mais) with safe-area padding; the page bottom pads 96px plus the safe area to clear it. From 768px a fixed 240px sidebar replaces the tab bar: wordmark, a full-width "nova compra" button, the full nav list, "sair" at the foot.

Vertical rhythm: section headings sit 32px below the previous block with 4px under them; ledger rows are 12px top and bottom separated by 1px rules; the plane bar sits 12px above its legend. The legend is a two-column grid (24px column gap, 4px row gap). Plane segments are separated by a 3px gap of ground.

## Elevation & Depth

Flat. Depth comes from tonal steps of near-black (ground, then raised slab, then hover slab) and from 1px rules, never from shadows. Cards are flat by construction. Overlays (dialog, sheet, popover, select) are distinguished by the raised slab tone and a backdrop; the stock shadcn shadow utilities still present on them are residue, not part of the system.

### Named Rules
**The Slab Rule.** Surfaces are flat at rest and in every state. Hover is a tonal step or a brightness lift on a plane, never a shadow or a lift.

## Shapes

Square everywhere: every radius token is 0px, so cards, buttons, inputs, tiles, checks, dialogs and sheets all have hard corners. The only round shapes are spinners and dots, which keep the full radius. Forms are rectangles: planes, 40px day tiles, 10px legend squares, the 56px "+" tab. Outlines are 2px when they encode state (previsto, open-later, forecast-in tiles; the paid check) and 1px when they only separate (rules, inputs, neutral tiles). The deficit is a diagonal stripe pattern at 135°, never a rounded badge.

## Components

Evidence scope: the Concreto components below ship on every route: `/dashboard`, `/movements`, `/purchases`, `/budgets`, `/categories`, `/pockets`, `/cards`, `/recurring`, `/goals`, `/deposits`, `/login`, the app shell, the purchase form and every dialog. The shadcn primitives in `src/shared/ui` (button, input, label, select, dialog, sheet, popover, toggle, dropdown-menu, checkbox, accordion, badge, card) are restyled to 15px, square and shadowless, so a stock import already lands in this world.

### Buttons
Flat ink slabs; the inverse of the ground.
- **Shape:** square (0px).
- **Primary:** ink fill, ground text, 500 weight. Hover drops to 90% opacity; press scales to 0.98.
- **Ghost:** transparent, ink text; hover fills with the hover slab. Used for the month switcher arrows (40px square) and "sair".
- **Outline:** ground fill with a strong-rule border; hover fills with the hover slab.
- **Focus:** 1px amarelo ring (`ring-1 ring-ring`) on every interactive element.
- **Disabled primary:** drops the slab: transparent fill, 1px strong-rule border, pencil text. A disabled action never becomes the loudest shape on the screen.
- **Sizes:** 40px default, 36px small, 40px square icon. Destructive actions in forms are ghost buttons in the red text ink ("excluir"), never a filled red slab outside the confirm dialog.

### Cards / Containers
- **Corner Style:** square (0px).
- **Background:** raised slab with a 1px rule border.
- **Shadow Strategy:** none (see Elevation).
- **Internal Padding:** 24px.
- Redesigned surfaces mostly avoid cards and use rule-separated lists directly on the ground.

### Inputs / Fields
- **Style:** transparent fill, 1px strong-rule border, square, 40px tall, 15px text; number inputs have no spinners. Sentence-case labels sit 6px above in 15px pencil; hints and errors sit below in 15px pencil or red text ink.
- **Focus:** 1px amarelo ring; the caret is amarelo too.
- **Disabled:** 50% opacity.

### Dialogs and Forms
Dialogs are a raised slab with a 1px strong-rule border, no shadow, square, with the close button as a 40px square in the top-right. The title is 24px bold lowercase, left-aligned; a proper name inside it (a card, a purchase) keeps its own casing. On phones a dialog spans the width minus 12px each side and scrolls its body. Forms end in one action row above a 1px rule: on phones cancel and save sit side by side in equal halves, with the destructive action centred below them; from 640px the destructive action moves to the left and cancel/save to the right. A destructive action only renders when there is something to remove. Delete lives inside the edit dialog, not as a row icon, except on categorias where the row has no other detail.

### Answer Figure
Every secondary route opens with one answer: a 15px/500 pencil label naming the question ("guardado nas caixinhas", "livre nos cartões", "falta guardar", "fixo por mês", "entrou em novembro", "livre no plano de setembro"), the 48px display amount with a 24px "R$" prefix, and a 15px pencil meta line. When the answer is a deficit the label says so ("passou do limite dos cartões", "passou da renda") and the figure moves to the red text ink, as on the dashboard. On desktop the figure and the route's plane sit side by side (2:3).

### Route Planes
Each route draws its money as one plane bar under the answer, with the same segment, gap and legend rules as the month plane bar:
- **Caixinhas:** one azul segment per pocket, sized by balance; each row's tile is an azul square holding that pocket's share in percent (stripe for a negative balance). Tapping a segment opens the pocket.
- **Cartões:** one bar per card: used (vermelho) plus livre (azul), or used plus a striped "excedido" segment for the amount over the limit.
- **Metas:** one bar per goal: guardado (azul) plus falta (2px azul outline).
- **Orçamento:** one vermelho-outlined segment per category with the spent share filled vermelho inside it (stripe when over), plus livre in azul; tapping a segment scrolls to its row. Each allocation and tag row repeats this as a 16px bar with a 1px outline, so an unspent plan reads hollow.
- **Recorrentes:** one segment per item, ordered by day: amarelo when due within two days, vermelho outline after. Tapping opens the item.
- **Depósitos:** the month's money split by destination in azul; the new/edit split editor previews the same plane live.
- **Pagar fatura:** the statement split by source (conta or caixinha).
A legend item whose value is zero is dropped, the same as a zero-width segment. A legend with one item takes one column.

### Navigation
- **Sidebar (≥768px):** 15px lowercase items, 10px × 12px padding, 16px icon. Inactive in pencil with hover slab on hover; active is an inverted ink slab with ground text at 500.
- **Tab bar (<768px):** 56px tall cells, 20px icon over a 12px lowercase label, inactive in pencil, active in ink with a 2px × 20px ink bar under the label. The centre cell is the square ink "+" for nova compra.
- **"mais" sheet:** bottom sheet with the secondary routes in the sidebar style, plus "comando por voz" and an outline "sair".

### Segmented Toggle
Square segments, 32px tall; the selected segment inverts to an ink slab with ground text ("por fonte" / "por data", "avulsos" / "recorrentes"). In forms the toggle is 40px tall to match inputs ("R$" / "%"), and on login the two people are a pair of 56px segments.

### Month Plane Bar (signature)
The month as one row of planes, 64px tall (48px compact), full width. Segment widths are proportional to value: pago (filled vermelho), em aberto (filled amarelo), previsto (2px vermelho outline, empty), sobra (filled azul). Segments are separated by 3px of ground and never narrower than 6px. In deficit the sobra segment drops out and a striped overlay (ground stripes over the bar, 2px ink left edge) covers the share of spending not covered, and the legend entry reads "falta" with a striped marker. With no data the bar is a dashed strong-rule rectangle. Width changes animate with `flex-grow` over 420ms on cubic-bezier(0.16, 1, 0.3, 1), only when reduced motion is not requested.

Below it, a two-column legend: 10px square marker, pencil label, ink amount (sobra omits its amount because the display number already states it). Each legend entry and each segment is a filter: tapping selects that status, dims the other segments to 25% opacity and filters the rows; tapping again clears.

On the dashboard the month is also a flat pie of what came in. Vermelho is what went out, azul is what was left, and the legend names entra as the whole rather than as a third slice. There is no falta slice. Categories are a second pie, split by a gap of ground, and each category's share of spending is written as a percent beside a matching color marker. Each category keeps its own flat color, stepped so neighboring slices differ; a purchase with no category is the gray slice "sem categoria". These colors stay on that pie. In the year the same section switches between the pie and twelve columns drawn like the year chart: each column is a month, stacked in the category colors, largest at the base, empty months a dashed stub. Tapping a column lists that month's categories with color, share, and amount. Opening a category redraws the columns in that category's tag colors. The month plane and the entra/sai pie keep the three pigments. In the year, twelve columns replace the pie: the same pigments, a deficit column keeps the striped overlay, and tapping a column returns to that month. Axis labels there use the 12px chrome size, because twelve of them share a phone width.

### Ledger Row and Day Tile
The list grammar of every redesigned screen. A row is a 40px square day tile, a two-line text block (15px/500 title in ink, 15px meta in pencil, both truncating), a right-aligned 15px/500 signed amount in ink, and an optional action. Rows are separated by 1px rules, 12px vertical padding; the whole row is a button with a hover-slab tint when it opens a detail.

Day tile tones follow the plane legend: filled vermelho (paid/out, white numeral), filled amarelo (due within two days, ground numeral), 2px amarelo outline (open later), 2px vermelho outline (forecast out), filled azul (in), 2px azul outline (forecast in), 1px strong-rule outline (neutral).

### Paid Check
A 24px square box with a 2px ink border inside a 44px hit area. Checked, it fills vermelho with a white tick. Marking a row paid keeps it in place: the tile turns vermelho, the title strikes through in pencil, the meta reads "pago agora", and the plane bar replans.

## Do's and Don'ts

### Do:
- **Do** show money as planes whose width is the amount; the month plane bar is the first thing under the answer number on Dashboard and Movimentos.
- **Do** set every amount in ink with its sign (−1.250,00, +9.234,44) and let the tile, marker or plane beside it carry the colour.
- **Do** keep each pigment to its one meaning: vermelho out/paid, amarelo open/due, azul in/left.
- **Do** use 0px corners on every new surface, 1px rules to separate and 2px outlines to encode state.
- **Do** keep content type to 48, 24 and 15px with lowercase bold headings and tabular figures.
- **Do** show a deficit as the striped "falta" overlay and turn only the display amount to the red text ink.
- **Do** use the 1px amarelo focus ring on every interactive element.

### Don't:
- **Don't** build a big balance card plus a grid of same-size stat tiles; that is the fintech default this world refuses.
- **Don't** colour amounts green/red or fill text with the pigment hexes; use ink, or the text inks when state must sit in text.
- **Don't** label a value twice or add explanatory copy under numbers and headings.
- **Don't** add shadows, rounded corners, smooth gradients or tinted backgrounds; hard 135° stripes are reserved for the deficit.
- **Don't** add uppercase or letter-spaced labels above headings.
- **Don't** introduce a fourth hue for tags or status. The category pie is the one exception, shared with the year category columns: each category keeps one flat color there, and each tag keeps one flat color on its own pie and columns.
