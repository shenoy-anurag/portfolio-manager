# Portfolio Manager — Implementation Plan

A single-user, self-hosted web app that tracks all Indian investments (demat stocks, mutual funds, PPF, EPFO, FDs, US stocks) in one dashboard. Prices refresh on a schedule (daily default, down to 1-minute). Holdings import from Zerodha XLSX, CAMS CAS (Excel/PDF), a versioned JSON portfolio format, or manual entry. Deterministic analytics and charts ship in v1; OpenAI narrative analysis is architected now and built later.

## Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 16 (App Router) + TypeScript | Server-side fetching, API routes for refresh/import |
| UI | Tailwind CSS + shadcn/ui (radix-nova) | Requested, fast consistent components |
| Charts | Recharts | Donut, area, bar, line supported |
| DB | SQLite + Prisma 7 (driver adapter `@prisma/adapter-better-sqlite3`) | Zero-config, single file, personal tool |
| Excel parsing | `exceljs` | Zerodha / CAMS Excel exports |
| PDF parsing | `pdfjs-dist` (legacy build) | Password-protected CAMS CAS PDFs |
| Yahoo data | Server-side REST `query1.finance.yahoo.com` (chart + batch quote) | NSE `.NS`, BSE `.BO`, US tickers, `INR=X`, history. No key |
| MF NAV | AMFI `NAVAll.txt` (official daily dump) | Authoritative daily NAV for all schemes |
| Scheduler | `node-cron` via Next.js `instrumentation.ts` `register()` | Runs inside the server process |
| AI (future) | `openai` SDK behind a provider interface | Clean plug-in point |
| Package mgmt | `pnpm` | Requested |

## Data Model (Prisma / SQLite)

- **Instrument** — `symbol`, `name`, `source` (yahoo/amfi/manual), `assetClass` (equity / mf-equity / mf-debt / ppf / epfo / fd / us-equity / gold), `currency`, `amfiCode`, `isin`, `interestRate`
- **Broker** — name + source kind (zerodha/cams/manual/us) + broker account mapping
- **Account** — `brokerId`, `name`, `type` (demat/mf/ppf/epfo/fd/us), `currency`, `params` (JSON: FD maturity, PPF rate, etc.)
- **Holding** — `accountId`, `instrumentId`, `quantity`, `avgCost`, `purchaseDate`, `params`
- **Transaction** — `type` (buy/sell/sip/dividend), `quantity`, `amount`, `nav`, `date`, `folio`, `notes`
- **PricePoint** — `instrumentId`, `date`, `price`
- **FxRate** — `date`, `currency`, `inrRate`
- **Snapshot** — `date`, `totalValueInr`, `investedInr`, `breakdown` (JSON)
- **AppSetting** — `key`, `value` (refresh cadence, thresholds, OpenAI key flag)
- **ImportLog / RefreshLog** — audit trail

## Modules

### Providers (`src/lib/providers/`)
- `yahoo.ts` — batched quotes, historical chart series, user-agent handling, backoff + cache
- `amfi.ts` — parse `NAVAll.txt`, scheme master → Instrument, daily NAV map
- `fx.ts` — USD→INR via `INR=X`, cached per day
- `refresh.ts` — refresh stale instruments, batch Yahoo calls, snapshot portfolio
- `scheduler.ts` — `node-cron` at configured cadence
- `GET /api/refresh` — manual trigger + future external cron

### Importers (`src/lib/importers/`)
- `zerodha.ts` — holdings XLSX (Equity + Mutual Funds sheets)
- `camsExcel.ts` — CAMS transaction-details Excel statement
- `camsPdf.ts` — password-protected CAS PDF (best-effort, pdfjs-dist)
- `exchange.ts` — PEX JSON import (see `docs/portfolio-format.md`)
- `manual.ts` — PPF / EPFO / FD / US stock forms
- Shared mapping-preview flow at `/import`

### Analytics (`src/lib/analytics/`) — deterministic
- `allocation.ts` — % by asset class / broker / holding
- `xirr.ts` — per-holding and portfolio XIRR
- `risk.ts` — concentration (HHI), volatility, diversification, drawdown
- Opportunity flags (over-concentration, 52-week proximity, etc.)

### AI Service Interface (`src/lib/ai/portfolioAnalyzer.ts`)
- `interface PortfolioAnalyzer { analyze(...) }`
- `OpenAIPortfolioAnalyzer` — stub in v1, enabled later via setting

## Pages

- `/` Dashboard — net worth/invested/P&L cards, allocation donut, net-worth trend, top movers
- `/holdings` — table, filters, CRUD, per-holding XIRR/P&L
- `/import` — Zerodha XLSX, CAMS Excel/PDF, PEX JSON, manual forms
- `/analytics` — concentration, risk, diversification, opportunities
- `/settings` — refresh cadence, thresholds, export/import, OpenAI placeholder

## Build Phases

1. Scaffold — Next.js 16 + TS + Tailwind + shadcn/ui + Prisma/SQLite (pnpm)
2. Data model + providers + refresh engine
3. Manual entry
4. Zerodha XLSX importer
5. CAMS importer (Excel, then PDF)
6. PEX v1 export/import
7. Scheduler + daily snapshots
8. Dashboard + analytics + charts
9. AI service interface stub + settings placeholder
10. Seed demo data, tests, README + docs polish

## Risks & Mitigations

- **Yahoo is unofficial** → batched calls, caching, backoff, AMFI fallback for MFs; provider interface allows swapping NSE/BSE wrappers later (NSE/BSE have no official public REST API).
- **CAS PDF parsing is brittle** → CAMS Excel statement is the primary path; PDF best-effort.
- **Intraday refresh + rate limits** → daily is the sane default; enforce min interval and batch sizes.
