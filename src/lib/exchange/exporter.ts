import { prisma } from '@/lib/db'
import { getSettings } from '@/lib/settings'
import { PEX_FORMAT, PEX_VERSION } from '@/lib/exchange/schema'
import type { PexDocument } from '@/lib/exchange/schema'

const toDate = (d: Date | null | undefined): string | null =>
  d ? d.toISOString().slice(0, 10) : null

const num = (v: unknown): number => Number(v)

export async function exportPortfolio(): Promise<PexDocument> {
  const [instruments, accounts, holdings, transactions, snapshots, settings] =
    await Promise.all([
      prisma.instrument.findMany(),
      prisma.account.findMany({ include: { broker: true } }),
      prisma.holding.findMany(),
      prisma.transaction.findMany(),
      prisma.snapshot.findMany({ orderBy: { date: 'asc' } }),
      getSettings(),
    ])

  return {
    format: PEX_FORMAT,
    version: PEX_VERSION,
    exportedAt: new Date().toISOString(),
    appVersion: '0.1.0',
    baseCurrency: 'INR',
    instruments: instruments.map((i) => ({
      id: i.id,
      symbol: i.symbol,
      name: i.name,
      assetClass: i.assetClass,
      source: i.source,
      currency: i.currency,
      amfiCode: i.amfiCode,
      isin: i.isin,
      interestRate: i.interestRate !== null ? num(i.interestRate) : null,
    })),
    accounts: accounts.map((a) => ({
      id: a.id,
      name: a.name,
      broker: a.broker.name,
      type: a.type,
      currency: a.currency,
      params: a.params as Record<string, unknown>,
    })),
    holdings: holdings.map((h) => ({
      id: h.id,
      accountId: h.accountId,
      instrumentId: h.instrumentId,
      quantity: num(h.quantity),
      avgCost: num(h.avgCost),
      purchaseDate: toDate(h.purchaseDate),
      params: h.params as Record<string, unknown>,
    })),
    transactions: transactions.map((t) => ({
      id: t.id,
      accountId: t.accountId,
      instrumentId: t.instrumentId,
      type: t.type as 'buy' | 'sell' | 'sip' | 'dividend',
      date: toDate(t.date) ?? '',
      quantity: t.quantity !== null ? num(t.quantity) : null,
      amount: t.amount !== null ? num(t.amount) : null,
      nav: t.nav !== null ? num(t.nav) : null,
      folio: t.folio,
      notes: t.notes,
    })),
    snapshots: snapshots.map((s) => ({
      date: toDate(s.date) ?? '',
      totalValueInr: num(s.totalValueInr),
      investedInr: num(s.investedInr),
    })),
    settings: {
      refreshCadence: settings.refreshCadence,
      refreshTime: settings.refreshTime,
      targetAllocation: settings.targetAllocation,
      concentrationThreshold: settings.concentrationThreshold,
    },
  }
}
