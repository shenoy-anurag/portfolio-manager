import { prisma } from '@/lib/db'
import type { AssetClass } from '@/generated/prisma/client'

export interface HoldingValuation {
  holdingId: string
  instrumentId: string
  accountId: string
  accountName: string
  accountType: string
  brokerName: string
  symbol: string
  name: string
  assetClass: AssetClass
  source: 'yahoo' | 'amfi' | 'manual'
  currency: string
  quantity: number
  avgCost: number
  purchaseDate: string | null
  price: number
  priceDate: string | null
  valueInCurrency: number
  invested: number
  pnl: number
  pnlPercent: number
  fxRate: number
  valueInr: number
  investedInr: number
  pnlInr: number
}

export interface PortfolioTotals {
  totalValueInr: number
  totalInvestedInr: number
  totalPnlInr: number
  totalPnlPercent: number
  byAssetClass: Record<string, number>
  byAccount: Record<string, number>
  holdings: HoldingValuation[]
}

async function latestPricePerInstrument(): Promise<Map<string, { price: number; date: string }>> {
  const groups = await prisma.pricePoint.groupBy({
    by: ['instrumentId'],
    _max: { date: true },
  })
  const map = new Map<string, { price: number; date: string }>()
  for (const g of groups) {
    const instrumentId = g.instrumentId
    const date = g._max.date
    if (!instrumentId || !date) continue
    const row = await prisma.pricePoint.findFirst({
      where: { instrumentId, date },
      select: { price: true, date: true },
    })
    if (row) map.set(instrumentId, { price: Number(row.price), date: row.date.toISOString().slice(0, 10) })
  }
  return map
}

async function latestFxPerCurrency(): Promise<Map<string, number>> {
  const groups = await prisma.fxRate.groupBy({
    by: ['currency'],
    _max: { date: true },
  })
  const map = new Map<string, number>()
  for (const g of groups) {
    const currency = g.currency
    const date = g._max.date
    if (!currency || !date) continue
    const row = await prisma.fxRate.findFirst({
      where: { currency, date },
      select: { inrRate: true },
    })
    if (row) map.set(currency, Number(row.inrRate))
  }
  return map
}

export async function computeValuation(): Promise<PortfolioTotals> {
  const holdings = await prisma.holding.findMany({
    include: { instrument: true, account: { include: { broker: true } } },
  })
  const prices = await latestPricePerInstrument()
  const fx = await latestFxPerCurrency()

  const valuations: HoldingValuation[] = holdings.map((h) => {
    const instrument = h.instrument
    const account = h.account
    const quantity = Number(h.quantity)
    const avgCost = Number(h.avgCost)

    const isManual = instrument.source === 'manual'
    const price = isManual ? 1 : (prices.get(instrument.id)?.price ?? avgCost)
    const priceDate = prices.get(instrument.id)?.date ?? null

    const valueInCurrency = quantity * price
    const invested = quantity * avgCost
    const pnl = valueInCurrency - invested
    const pnlPercent = invested !== 0 ? (pnl / invested) * 100 : 0

    const fxRate = fx.get(instrument.currency) ?? (instrument.currency === 'INR' ? 1 : 1)

    return {
      holdingId: h.id,
      instrumentId: instrument.id,
      accountId: account.id,
      accountName: account.name,
      accountType: account.type,
      brokerName: account.broker.name,
      symbol: instrument.symbol,
      name: instrument.name,
      assetClass: instrument.assetClass,
      source: instrument.source,
      currency: instrument.currency,
      quantity,
      avgCost,
      purchaseDate: h.purchaseDate ? h.purchaseDate.toISOString().slice(0, 10) : null,
      price,
      priceDate,
      valueInCurrency,
      invested,
      pnl,
      pnlPercent,
      fxRate,
      valueInr: valueInCurrency * fxRate,
      investedInr: invested * fxRate,
      pnlInr: pnl * fxRate,
    }
  })

  const totalValueInr = valuations.reduce((s, v) => s + v.valueInr, 0)
  const totalInvestedInr = valuations.reduce((s, v) => s + v.investedInr, 0)
  const totalPnlInr = valuations.reduce((s, v) => s + v.pnlInr, 0)

  const byAssetClass: Record<string, number> = {}
  const byAccount: Record<string, number> = {}
  for (const v of valuations) {
    byAssetClass[v.assetClass] = (byAssetClass[v.assetClass] ?? 0) + v.valueInr
    byAccount[v.accountName] = (byAccount[v.accountName] ?? 0) + v.valueInr
  }

  return {
    totalValueInr,
    totalInvestedInr,
    totalPnlInr,
    totalPnlPercent: totalInvestedInr !== 0 ? (totalPnlInr / totalInvestedInr) * 100 : 0,
    byAssetClass,
    byAccount,
    holdings: valuations,
  }
}
