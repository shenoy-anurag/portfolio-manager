import { fetchQuote } from '@/lib/providers/yahoo'
import { prisma } from '@/lib/db'

const FX_SYMBOL = 'INR=X'

export async function getInrRate(currency: string, date = new Date()): Promise<number> {
  if (currency === 'INR') return 1
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)
  const existing = await prisma.fxRate.findFirst({
    where: { currency, date: { lte: start } },
    orderBy: { date: 'desc' },
  })
  if (existing) return Number(existing.inrRate)

  const quote = await fetchQuote(FX_SYMBOL)
  if (!quote || !Number.isFinite(quote.price)) return 1
  const rate = quote.price
  await prisma.fxRate.create({ data: { currency, date: start, inrRate: rate } })
  return rate
}

export async function fetchUsdInr(): Promise<number> {
  const quote = await fetchQuote(FX_SYMBOL)
  return quote && Number.isFinite(quote.price) ? quote.price : 1
}
