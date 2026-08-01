# UI Restyle Plan: IBM Carbon + Robinhood + Recursive

Goal: restyle the existing portfolio-manager UI using IBM Carbon design language, Robinhood-inspired colors (green `#00C805`-family positives, red negatives), the `Recursive` font, a collapsible sidebar, and dark mode by default. Chart/UI interactivity is inspired by the Statsman repo (https://github.com/shenoy-anurag/Statsman).

## Decisions
- Proceed from Statsman source code only (the `docs/statsman-sample.png` screenshot cannot be viewed by the model).
- Carbon density: sharp, small-radius corners (`rounded-none`/`rounded-sm`), border-focused layering like Statsman.
- Chart interactivity scope: custom dense tooltip + time-range chips (6M/1Y/All) on the net-worth chart, allocation hover highlight, green/red theming. No navigation changes.

## Steps
1. **`src/app/globals.css` — tokens**
   - Add `--positive` / `--negative` CSS vars + `--color-positive` / `--color-negative` in `@theme inline`; replaces hardcoded `text-emerald-600` / `text-red-600` with `text-positive` / `text-negative`.
   - Dark theme (default): near-black `--background`, layered grays for `--card`/`--muted`/`--secondary`, subtle `--border`; `--primary` = Robinhood green with dark `--primary-foreground`; `--chart-1` green, rest a coherent green/red/gray palette. Keep light variant for toggle.
   - Carbon density: small `--radius` (~0.25rem); cards/inputs/buttons `rounded-sm`/`rounded-none`, border-focused layering.

2. **`src/app/layout.tsx` + globals — fonts**
   - Add `Recursive` from `next/font/google`: `weight: ["300","400","500","700","900"]`, `variable: "--font-recursive"`, `subsets: ["latin"]`; add class to `<html>`; map `--font-sans: var(--font-recursive)`. Geist stays as mono fallback.

3. **`src/components/theme-provider.tsx`**
   - Flip custom provider default to `dark`; SSR class init to dark to avoid flash.

4. **`src/components/app-shell.tsx` — collapsible sidebar**
   - Expanded `w-56` ↔ collapsed icon rail (`w-16`) with `Tooltip` on items, collapse toggle button, localStorage-persisted preference; active item gets green accent; mobile header unchanged.

5. **Pages/components restyle**
   - Dashboard (`src/app/page.tsx`): theme-aware chart colors via CSS vars (drop hardcoded `COLORS`); net-worth AreaChart → green stroke/gradient + custom dense INR tooltip + time-range chips; allocation Pie → hover highlight + pct in legend; StatCards → `text-positive`/`text-negative`, larger value type; Top Holdings rows → hover bg + `tabular-nums`.
   - Holdings (`src/app/holdings/page.tsx`): row hover, `tabular-nums`, green/red P&L, Carbon density.
   - Import (`src/app/import/page.tsx`), Analytics (`src/app/analytics/page.tsx`), Settings (`src/app/settings/page.tsx`), `src/components/manual-entry-dialog.tsx`: token/color swaps, green primary buttons, green/red XIRR, Carbon-radius inputs.

6. **Verify**
   - `pnpm lint` → `pnpm exec tsc --noEmit` → `pnpm build` → live checks on `/`, `/holdings`, `/import`, `/analytics`, `/settings`.

## Notes
- Recharts in this repo is 3.8.0 (Statsman uses 2.15.4) — verify prop/API compatibility for any copied pattern.
- Dev server log lives at `/tmp/pm-dev.log`; live checks run against http://localhost:3000.
- Theme provider is custom (`src/components/theme-provider.tsx`), not next-themes.
