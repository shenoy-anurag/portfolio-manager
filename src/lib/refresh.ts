import { prisma } from '@/lib/db'
import { fetchQuotes } from '@/lib/providers/yahoo'
import { fetchAmfiNavs } from '@/lib/providers/amfi'
import { fetchUsdInr } from '@/lib/providers/fx'
import { computeValuation } from '@/lib/valuation'

export interface RefreshResult {
  ok: boolean
  quotesUpdated: number
  navUpdated: number
  fxUpdated: number
  error?: string
}

export function startOfDay(date = new Date()): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

export async function runRefresh(): Promise<RefreshResult> {
  const startedAt = new Date()
  const log = await prisma.refreshLog.create({ data: { startedAt, status: 'running' } })
  let quotesUpdated = 0
  let navUpdated = 0
  let fxUpdated = 0
  try {
    const instruments = await prisma.instrument.findMany()
    const yahooInstruments = instruments.filter((i) => i.source === 'yahoo')
    const amfiInstruments = instruments.filter((i) => i.source === 'amfi')
    const usdNeeded = instruments.some((i) => i.currency === 'USD')

    if (yahooInstruments.length > 0) {
      const quotes = await fetchQuotes(yahooInstruments.map((i) => i.symbol))
      for (const q of quotes) {
        const inst = yahooInstruments.find((i) => i.symbol === q.symbol)
        if (!inst) continue
        const date = q.time ? new Date(q.time * 1000) : startedAt
        const day = startOfDay(date)
        await prisma.pricePoint.upsert({
          where: { instrumentId_date: { instrumentId: inst.id, date: day } },
          create: { instrumentId: inst.id, date: day, price: q.price, currency: inst.currency },
          update: { price: q.price },
        })
        quotesUpdated++
      }
    }

    if (amfiInstruments.length > 0) {
      const { byCode } = await fetchAmfiNavs()
      for (const inst of amfiInstruments) {
        if (!inst.amfiCode) continue
        const scheme = byCode.get(inst.amfiCode)
        if (!scheme) continue
        const day = new Date(`${scheme.date}T00:00:00Z`)
        if (Number.isNaN(day.getTime())) continue
        await prisma.pricePoint.upsert({
          where: { instrumentId_date: { instrumentId: inst.id, date: day } },
          create: { instrumentId: inst.id, date: day, price: scheme.nav, currency: 'INR' },
          update: { price: scheme.nav },
        })
        navUpdated++
      }
    }

    if (usdNeeded) {
      const rate = await fetchUsdInr()
      if (Number.isFinite(rate) && rate > 0) {
        const day = startOfDay()
        await prisma.fxRate.upsert({
          where: { currency_date: { currency: 'USD', date: day } },
          create: { currency: 'USD', date: day, inrRate: rate },
          update: { inrRate: rate },
        })
        fxUpdated++
      }
    }

    const valuation = await computeValuation()
    const day = startOfDay()
    await prisma.snapshot.upsert({
      where: { date: day },
      create: {
        date: day,
        totalValueInr: valuation.totalValueInr,
        investedInr: valuation.totalInvestedInr,
        breakdown: valuation.byAssetClass as object,
      },
      update: {
        totalValueInr: valuation.totalValueInr,
        investedInr: valuation.totalInvestedInr,
        breakdown: valuation.byAssetClass as object,
      },
    })

    await prisma.refreshLog.update({
      where: { id: log.id },
      data: {
        finishedAt: new Date(),
        status: 'success',
        message: `quotes=${quotesUpdated} nav=${navUpdated} fx=${fxUpdated}`,
      },
    })
    return { ok: true, quotesUpdated, navUpdated, fxUpdated }
  } catch (error) {
    await prisma.refreshLog.update({
      where: { id: log.id },
      data: { finishedAt: new Date(), status: 'failed', message: String(error) },
    })
    return { ok: false, quotesUpdated, navUpdated, fxUpdated, error: String(error) }
  }
}
