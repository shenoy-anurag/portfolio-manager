import { prisma } from '@/lib/db'
import type { ImportPreview, ParsedInstrument } from '@/lib/importers/types'
import { slugify } from '@/lib/importers/types'
import type { AccountType } from '@/generated/prisma/client'

export interface CommitResult {
  instrumentsAdded: number
  accountsAdded: number
  holdingsAdded: number
  holdingsUpdated: number
  transactionsAdded: number
  transactionsSkipped: number
}

function txnKey(t: {
  instrument: { symbol: string }
  date: string
  type: string
  quantity?: number | null
  amount?: number | null
  nav?: number | null
  folio?: string | null
}): string {
  return [
    'imp',
    t.instrument.symbol,
    t.date,
    t.type,
    t.quantity ?? '',
    t.amount ?? '',
    t.nav ?? '',
    t.folio ?? '',
  ].join('|')
}

async function upsertInstrument(i: ParsedInstrument): Promise<string> {
  const existing = await prisma.instrument.findUnique({
    where: { source_symbol: { source: i.source, symbol: i.symbol } },
  })
  if (existing) {
    await prisma.instrument.update({
      where: { id: existing.id },
      data: {
        name: i.name,
        assetClass: i.assetClass,
        currency: i.currency,
        amfiCode: i.amfiCode ?? null,
        isin: i.isin ?? null,
        interestRate: i.interestRate ?? null,
      },
    })
    return existing.id
  }
  const created = await prisma.instrument.create({
    data: {
      symbol: i.symbol,
      name: i.name,
      assetClass: i.assetClass,
      source: i.source,
      currency: i.currency,
      amfiCode: i.amfiCode ?? null,
      isin: i.isin ?? null,
      interestRate: i.interestRate ?? null,
    },
  })
  return created.id
}

async function upsertAccount(
  broker: string,
  accountName: string,
  type: AccountType,
): Promise<{ id: string; created: boolean }> {
  let brokerRow = await prisma.broker.findUnique({ where: { name: broker } })
  if (!brokerRow) {
    brokerRow = await prisma.broker.create({ data: { name: broker, kind: 'imported' } })
  }
  const existing = await prisma.account.findUnique({
    where: { brokerId_type_name: { brokerId: brokerRow.id, type, name: accountName } },
  })
  if (existing) return { id: existing.id, created: false }
  const created = await prisma.account.create({
    data: { brokerId: brokerRow.id, name: accountName, type, currency: 'INR', params: {} },
  })
  return { id: created.id, created: true }
}

export async function commitImport(preview: ImportPreview): Promise<CommitResult> {
  const result: CommitResult = {
    instrumentsAdded: 0,
    accountsAdded: 0,
    holdingsAdded: 0,
    holdingsUpdated: 0,
    transactionsAdded: 0,
    transactionsSkipped: 0,
  }

  // Deduplicate instruments
  const uniqueInstruments = new Map<string, ParsedInstrument>()
  for (const h of preview.holdings) {
    const key = `${h.instrument.source}:${h.instrument.symbol}`
    uniqueInstruments.set(key, h.instrument)
  }
  for (const t of preview.transactions) {
    const key = `${t.instrument.source}:${t.instrument.symbol}`
    uniqueInstruments.set(key, t.instrument)
  }

  const instrumentIds = new Map<string, string>()
  for (const inst of uniqueInstruments.values()) {
    const id = await upsertInstrument(inst)
    instrumentIds.set(`${inst.source}:${inst.symbol}`, id)
    if (inst.source !== 'manual') result.instrumentsAdded++
  }

  const accountIds = new Map<string, string>()
  const getAccount = async (broker: string, name: string, type: AccountType) => {
    const key = `${broker}|${type}|${name}`
    if (!accountIds.has(key)) {
      const { id, created } = await upsertAccount(broker, name, type)
      accountIds.set(key, id)
      if (created) result.accountsAdded++
    }
    return accountIds.get(key)!
  }

  for (const h of preview.holdings) {
    const instrumentId = instrumentIds.get(`${h.instrument.source}:${h.instrument.symbol}`)
    if (!instrumentId) continue
    const accountId = await getAccount(h.broker, h.accountName, h.accountType)
    const purchaseDate = h.purchaseDate ? new Date(h.purchaseDate) : null
    const existing = await prisma.holding.findUnique({
      where: { accountId_instrumentId: { accountId, instrumentId } },
    })
    if (existing) {
      await prisma.holding.update({
        where: { id: existing.id },
        data: { quantity: h.quantity, avgCost: h.avgCost, purchaseDate },
      })
      result.holdingsUpdated++
    } else {
      await prisma.holding.create({
        data: {
          accountId,
          instrumentId,
          quantity: h.quantity,
          avgCost: h.avgCost,
          purchaseDate,
          params: {},
        },
      })
      result.holdingsAdded++
    }
  }

  for (const t of preview.transactions) {
    const instrumentId = instrumentIds.get(`${t.instrument.source}:${t.instrument.symbol}`)
    if (!instrumentId || !t.date) {
      result.transactionsSkipped++
      continue
    }
    const broker = t.broker ?? 'CAMS'
    const accountName = t.accountName ?? 'CAMS Mutual Funds'
    const accountType = t.accountType ?? 'mf'
    const accountId = await getAccount(broker, accountName, accountType)
    const externalId = txnKey(t)
    const existing = await prisma.transaction.findUnique({ where: { externalId } })
    if (existing) {
      result.transactionsSkipped++
      continue
    }
    await prisma.transaction.create({
      data: {
        externalId,
        accountId,
        instrumentId,
        type: t.type,
        date: new Date(t.date),
        quantity: t.quantity ?? null,
        amount: t.amount ?? null,
        nav: t.nav ?? null,
        folio: t.folio ?? null,
        notes: t.notes ?? null,
      },
    })
    result.transactionsAdded++
  }

  await prisma.importLog.create({
    data: {
      source: preview.source,
      fileName: preview.fileName,
      status: 'success',
      summary: {
        ...result,
        holdingsInPreview: preview.holdings.length,
        transactionsInPreview: preview.transactions.length,
      } as object,
    },
  })

  return result
}

export { slugify }
