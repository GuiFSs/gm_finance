---
name: "G&M Finance"
description: "Private two-person household finance app: a calm, exact, shared cashbook."
colors:
  background: "#0c1222"
  surface: "#151d2e"
  surface-muted: "#1e293b"
  border: "#2d3a4f"
  foreground: "#e2e8f0"
  muted-foreground: "#94a3b8"
  primary: "#3b82f6"
  primary-foreground: "#ffffff"
  destructive: "#ef4444"
  destructive-foreground: "#ffffff"
  ring: "#60a5fa"
  income: "#4ade80"
  expense: "#f87171"
  attention: "#fcd34d"
typography:
  display:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: "2rem"
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: "1"
    letterSpacing: "-0.025em"
  body:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: "1.25rem"
  label:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: "1rem"
rounded:
  md: "6px"
  lg: "8px"
  xl: "12px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "36px"
  button-outline:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "36px"
  input:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: "4px 12px"
    height: "36px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.xl}"
    padding: "24px"
  badge-destructive:
    backgroundColor: "{colors.destructive}"
    textColor: "{colors.destructive-foreground}"
    rounded: "{rounded.md}"
    padding: "2px 10px"
---

# Design System: G&M Finance

## Overview

**Creative North Star: "The Household Ledger"**

G&M Finance is a shared cashbook for two people. The screen should feel like the ledger kept on the kitchen table: exact, unhurried, and out of the way of the numbers. Dark surfaces are the shipped default (`background` and `surface`), so the app stays quiet at night. The blue `primary` appears only where someone needs to act.

Density is comfortable-to-dense. Small type (`text-xs` and `text-sm`) carries most of the content, many rows fit on one screen, and cards keep generous padding. Hierarchy comes from size and weight steps, not from color. Money is the hero, so amounts are set in tabular figures and colored by direction.

Rejected, confirmed by the user: gradients, glassmorphism, neon accents, a cold and formal bank-portal look, and playful mascots or emoji-heavy copy.

**Key Characteristics:**
- Dark-first: the app ships with `<html class="dark">`
- One blue accent; the money-status colors carry direction, not decoration
- Flat at rest; shadows only on cards, buttons, and floating layers
- Small type with tabular figures on every amount
- 6px controls, 12px cards

## Colors

Quiet slate neutrals, one blue accent, and three money-status colors that carry direction.

### Primary
- **Ledger Blue** (`primary`): the single action color. Filled primary buttons, progress fills, and the active tint of navigation.

### Secondary
- **Money-In Green** (`income`): amounts that increase the balance; income rows and inflow totals.
- **Money-Out Red** (`expense`): amounts that decrease the balance; outflow totals and expense rows.
- **Pending Amber** (`attention`): pending items and things that need a look, such as open or unpaid entries.

### Tertiary
- **Overdraft Red** (`destructive`): negative balances, destructive actions, and the "Negativo" badge.
- **Focus Sky** (`ring`): the 1px focus ring on every interactive control.

### Neutral
- **Deep Ledger Navy** (`background`): the page background.
- **Ledger Card Slate** (`surface`): cards and panels.
- **Muted Slate** (`surface-muted`): quiet row fills and muted areas.
- **Rule Slate** (`border`): 1px borders, inputs, and secondary fills.
- **Ink Mist** (`foreground`): primary text.
- **Pencil Gray** (`muted-foreground`): helper text, descriptions, and placeholders.

### Named Rules
**The Direction Rule.** Green means money in, red means money out, amber means pending or needs attention. These hues never decorate.

**Drift to resolve.** The app shell (`src/shared/ui/app-shell.tsx`) and the mobile header use Tailwind `gray-50`, `gray-900`, and `gray-950` for surfaces instead of the tokens above. Fold them into the tokens; do not add a second neutral palette. The light theme in `globals.css` is maintained but not shipped.

## Typography

**Display Font:** Geist (with system-ui, sans-serif)
**Body Font:** Geist (with system-ui, sans-serif)
**Label/Mono Font:** Geist Mono is loaded in `src/app/layout.tsx` but no component uses it. Do not add it without a reason.

**Character:** One family, plain and functional. Hierarchy comes from size and weight, and amounts line up in columns.

### Hierarchy
- **Display** (700, 24px / 32px, -0.025em tracking): page titles in `PageHeader`.
- **Title** (600, 18px, line-height 1, -0.025em tracking): card titles (`CardTitle`) and dialog titles.
- **Body** (400, 14px / 20px in lists and cards; 16px on mobile inputs, 14px from `md`): list text, card content, form fields.
- **Label** (500, 12px / 16px): helper text, captions, and badge text (600 weight).

### Named Rules
**The Tabular Figures Rule.** Every amount uses `tabular-nums` so money columns align. Never set an amount in proportional digits.

## Layout

- **Desktop (768px and up, `md`):** a fixed 256px sidebar (`w-64`) holds navigation. Main content is offset by `md:ml-64` with 24px padding from `sm`.
- **Mobile (below 768px):** a sticky 56px top bar (`h-14`) with a menu button that opens a left sheet, capped at 18rem.
- **Grids:** one column by default, two from `sm` (640px), three to five from `lg` (1024px) for summary metrics. A 12-column grid appears in a few places.
- **Spacing rhythm:** 4px steps. Gaps of 4, 8, 12, and 16px. Card headers use 24px padding with a 16px bottom; card content uses 24px sides and bottom. Vertical stacks use `space-y-4` to `space-y-6`.
- **Page header:** stacks on mobile and sits in a row with actions from `sm` up.
- **Max widths:** rare. Content fills the main column.

## Elevation & Depth

Flat at rest. Surfaces separate by tone and a 1px border, not by shadow. Shadows appear on cards and buttons, and on floating layers (dialogs and sheets).

### Shadow Vocabulary
- **Card, shipped dark theme** (`shadow-lg` with `shadow-black/20`): `0 10px 15px -3px rgb(0 0 0 / 0.2), 0 4px 6px -4px rgb(0 0 0 / 0.2)`. The resting shadow of a card.
- **Filled button at rest** (`shadow-md`): `0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)`.
- **Floating** (`shadow-lg`): hover on filled buttons and the surface of dialogs and sheets. Dialog overlay is `bg-black/80`.
- **Control rest** (`shadow-sm`): `0 1px 2px 0 rgb(0 0 0 / 0.05)`, outline buttons and inputs.

### Named Rules
**The Flat-At-Rest Rule.** Rows, list items, and page sections are flat. A shadow means the element can be acted on or floats above the page.

## Shapes

- **Controls** (buttons, inputs, badges): 6px radius (`rounded-md`).
- **Cards:** 12px radius (`rounded-xl`), a 1px `border` edge. Dialogs use 8px from `sm` (`sm:rounded-lg`).
- **Bars and pills:** fully rounded (`rounded-full`), used for progress bars.
- **Strokes:** 1px only. Focus is a 1px `ring`.

## Components

### Buttons
- **Shape:** 6px radius, 36px tall (`h-9`), 16px horizontal padding, 14px medium text.
- **Primary:** filled `primary` with `primary-foreground` text. Hover drops to 90% opacity with a larger shadow. Active scales to 98%.
- **Secondary:** filled Rule Slate with Ink Mist text.
- **Outline:** 1px `border` edge, background as the page, hover fills with Rule Slate.
- **Ghost:** no edge, hover fills with Rule Slate. **Link:** Ledger Blue text, underline on hover.
- **Sizes:** `sm` is 32px with 12px text; `lg` is 40px; `icon` is a 36px square.
- **Focus:** 1px Focus Sky ring.

### Badges
- **Shape:** 6px radius, 2px by 10px padding, 12px semibold text.
- **Default:** solid `primary`. **Destructive:** solid `destructive`, used for "Negativo". **Outline:** text only.
- **Money status pills:** a tinted fill (green, red, amber, or sky at low opacity) with a darker text color of the same hue.

### Cards / Containers
- **Corner Style:** 12px (`rounded-xl`).
- **Background:** `surface`, with a 1px `border`.
- **Shadow Strategy:** card shadow from the Elevation section.
- **Internal Padding:** 24px header with 16px below; 24px content sides and bottom.

### Inputs / Fields
- **Style:** 36px tall, 6px radius, 1px `border` edge, transparent background, 12px horizontal padding.
- **Focus:** 1px Focus Sky ring.
- **Placeholder:** `muted-foreground`.
- **Amount fields:** use the shared `CurrencyInput` (`src/shared/ui/currency-input.tsx`).

### Navigation
- **Style:** 256px fixed sidebar on desktop; 14px text with a 16px icon; 12px horizontal padding.
- **Active:** blue tint behind the item (`blue-900` at 30%) with `blue-400` text.
- **Inactive:** `gray-300` text, `gray-800` on hover. These are Tailwind palette values, not tokens; see Colors drift.
- **Mobile:** the same list inside a sheet opened from the top bar.

### Money figure (signature)
- **Shape:** inline text, medium to semibold weight, `tabular-nums`.
- **Color:** `income` for money in, `expense` for money out, `destructive` for negative balances.
- **Rule:** the sign or a word accompanies the color (for example "Negativo"), so color is never the only signal.

### Progress
- **Shape:** 8px tall, fully rounded.
- **Track:** `primary` at 20% opacity. **Fill:** `primary`.

### Dialog
- **Shape:** max width 512px (`max-w-lg`), 24px padding, 8px corners from `sm`.
- **Surface:** `background` with a 1px `border` edge and a `shadow-lg` floating shadow over a `bg-black/80` overlay.

## Do's and Don'ts

### Do:
- **Do** use Ledger Blue (`primary`) for one main action per view.
- **Do** set every amount with `tabular-nums` and color it by direction: green for in, red for out, Overdraft Red for negative balances.
- **Do** pair color with a word or a sign: "Negativo", "Em aberto", or a leading minus.
- **Do** keep depth flat at rest. Add shadow only to cards, buttons, and floating layers.
- **Do** keep controls 36px tall with 6px corners, and cards 12px.

### Don't:
- **Don't** use gradients, glassmorphism, or neon accents.
- **Don't** make it look like a cold, formal bank portal, with dense legal-style chrome or intimidating layouts.
- **Don't** use mascots, bright playful gradients, or emoji-heavy copy.
- **Don't** introduce a second accent hue. The blue primary and the three money colors are the palette.
- **Don't** add new `gray-*` surfaces to screens. Use the tokens and fold drift into them.
- **Don't** use the money-direction colors for decoration.
