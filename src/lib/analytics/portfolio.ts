import { prisma } from '@/lib/db'
import { getSettings } from '@/lib/settings'
import { computeValuation, type HoldingValuation } from '@/lib/valuation'
import { xirr } from '@/lib/analytics/xirr'
import { ASSET_CLASS_ORDER, ASSET_CLASS_LABELS } from '@/lib/constants'

export interface AllocationSlice {
  assetClass: string
  label: string
  value: number
  pct: number
}

export interface Opportunity {
  severity: 'info' | 'warning' | 'critical'
  title: string
  detail: string
  metric?: number
}

export interface Analytics {
  totalValue: number
  totalInvested: number
  totalPnl: number
  totalPnlPercent: number
  xirr: number
  holdingsCount: number
  allocation: AllocationSlice[]
  accountAllocation: AllocationSlice[]
  concentration: {
    hhi: number
    topHoldingWeight: number
    top5Weight: number
    topHolding: { name: string; pct: number } | null
  }
  opportunities: Opportunity[]
  staleCount: number
}

function safeDiv(a: number, b: number): number {
  return b === 0 ? 0 : a / b
}

export async function buildAnalytics(): Promise<Analytics> {
  const valuation = await computeValuation()
  const settings = await getSettings()
  const total = valuation.totalValueInr

  const allocation: AllocationSlice[] = ASSET_CLASS_ORDER.filter(
    (ac) => (valuation.byAssetClass[ac] ?? 0) > 0,
  ).map((ac) => ({
    assetClass: ac,
    label: ASSET_CLASS_LABELS[ac],
    value: valuation.byAssetClass[ac],
    pct: safeDiv(valuation.byAssetClass[ac], total) * 100,
  }))

  const accountAllocation: AllocationSlice[] = Object.entries(valuation.byAccount)
    .map(([name, value]) => ({
      assetClass: name,
      label: name,
      value,
      pct: safeDiv(value, total) * 100,
    }))
    .sort((a, b) => b.value - a.value)

  // XIRR from transactions + current value
  const txns = await prisma.transaction.findMany()
  const cashflows = txns
    .filter((t) => t.amount !== null)
    .map((t) => ({
      date: t.date,
      amount:
        t.type === 'buy' || t.type === 'sip' ? -Number(t.amount) : Number(t.amount),
    }))
  for (const h of valuation.holdings) {
    cashflows.push({ date: new Date(), amount: h.valueInr })
  }
  const portfolioXirr = xirr(cashflows)

  // Concentration
  const weights = valuation.holdings
    .map((h) => ({ name: h.name, pct: safeDiv(h.valueInr, total) }))
    .sort((a, b) => b.pct - a.pct)
  const hhi = weights.reduce((s, w) => s + w.pct * w.pct, 0)
  const top5Weight = weights.slice(0, 5).reduce((s, w) => s + w.pct, 0)
  const topHolding = weights[0] ?? null

  // Staleness
  const staleThresholdMs = 7 * 24 * 60 * 60 * 1000
  const staleCount = valuation.holdings.filter((h) => {
    if (h.source === 'manual') return false
    if (!h.priceDate) return true
    return new Date(h.priceDate).getTime() < Date.now() - staleThresholdMs
  }).length

  const opportunities: Opportunity[] = []
  const threshold = settings.concentrationThreshold ?? 0.15

  if (topHolding && topHolding.pct > threshold * 100) {
    opportunities.push({
      severity: 'warning',
      title: 'Concentrated position',
      detail: `${topHolding.name} is ${topHolding.pct.toFixed(1)}% of the portfolio.`,
      metric: topHolding.pct,
    })
  }
  if (weights.length >= 2 && top5Weight > 65) {
    opportunities.push({
      severity: 'warning',
      title: 'Top-5 concentration',
      detail: `Your top 5 holdings account for ${top5Weight.toFixed(1)}% of the portfolio.`,
      metric: top5Weight,
    })
  }
  const equityWeight =
    (valuation.byAssetClass.equity ?? 0) + (valuation.byAssetClass.mf_equity ?? 0)
  const equityPct = safeDiv(equityWeight, total) * 100
  if (equityPct > 70) {
    opportunities.push({
      severity: 'info',
      title: 'High equity exposure',
      detail: `${equityPct.toFixed(1)}% of your portfolio is in equity. Consider diversifying into debt.`,
      metric: equityPct,
    })
  }
  const cashLike =
    (valuation.byAssetClass.fd ?? 0) +
    (valuation.byAssetClass.ppf ?? 0) +
    (valuation.byAssetClass.epfo ?? 0) +
    (valuation.byAssetClass.mf_debt ?? 0)
  if (equityPct < 25 && safeDiv(cashLike, total) > 0.6) {
    opportunities.push({
      severity: 'info',
      title: 'Conservative portfolio',
      detail: 'A large share is in fixed-income. This protects capital but may lag inflation.',
    })
  }
  if (staleCount > 0) {
    opportunities.push({
      severity: 'info',
      title: 'Stale prices',
      detail: `${staleCount} holding(s) have no recent price. Run a refresh.`,
    })
  }
  if (valuation.holdings.length === 0) {
    opportunities.push({
      severity: 'critical',
      title: 'No holdings yet',
      detail: 'Add holdings via import or manual entry to start tracking.',
    })
  }

  return {
    totalValue: valuation.totalValueInr,
    totalInvested: valuation.totalInvestedInr,
    totalPnl: valuation.totalPnlInr,
    totalPnlPercent: valuation.totalPnlPercent,
    xirr: portfolioXirr,
    holdingsCount: valuation.holdings.length,
    allocation,
    accountAllocation,
    concentration: {
      hhi,
      topHoldingWeight: topHolding?.pct ?? 0,
      top5Weight,
      topHolding,
    },
    opportunities,
    staleCount,
  }
}

export type { HoldingValuation }
