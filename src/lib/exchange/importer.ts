import { prisma } from '@/lib/db'
import { setSetting } from '@/lib/settings'
import { pexSchema, PEX_FORMAT, PEX_VERSION } from '@/lib/exchange/schema'
import type { PexDocument } from '@/lib/exchange/schema'
import type { AssetClass, AccountType, Prisma } from '@/generated/prisma/client'

export interface ImportReport {
  instruments: { added: number; updated: number; skipped: number }
  accounts: { added: number; updated: number; skipped: number }
  holdings: { added: number; updated: number; skipped: number }
  transactions: { added: number; updated: number; skipped: number }
  snapshots: { added: number; updated: number; skipped: number }
}

export interface ImportResult {
  ok: boolean
  report: ImportReport
  errors: string[]
}

const emptyReport = (): ImportReport => ({
  instruments: { added: 0, updated: 0, skipped: 0 },
  accounts: { added: 0, updated: 0, skipped: 0 },
  holdings: { added: 0, updated: 0, skipped: 0 },
  transactions: { added: 0, updated: 0, skipped: 0 },
  snapshots: { added: 0, updated: 0, skipped: 0 },
})

function parseDate(date: string | null | undefined): Date | null {
  if (!date) return null
  const [y, m, d] = date.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(Date.UTC(y, m - 1, d))
}

export function validatePexDocument(input: unknown): PexDocument {
  const parsed = pexSchema.safeParse(input)
  if (!parsed.success) {
    const detail = parsed.error.issues[0]
    throw new Error(
      `Invalid portfolio file (${detail.path.join('.') ?? 'root'}): ${detail.message}`,
    )
  }
  if (parsed.data.version > PEX_VERSION) {
    throw new Error(
      `Portfolio file version ${parsed.data.version} is newer than supported version ${PEX_VERSION}`,
    )
  }
  return parsed.data
}

export async function importPortfolio(input: unknown): Promise<ImportResult> {
  const report = emptyReport()
  const errors: string[] = []
  const doc = validatePexDocument(input)

  const instrumentIdMap = new Map<string, string>()
  const accountIdMap = new Map<string, string>()

  // ---- Instruments (upsert by natural key source+symbol) ----
  for (const instr of doc.instruments) {
    const assetClass = instr.assetClass as AssetClass
    const existing = await prisma.instrument.findUnique({
      where: { source_symbol: { source: instr.source, symbol: instr.symbol } },
    })
    if (existing) {
      await prisma.instrument.update({
        where: { id: existing.id },
        data: {
          name: instr.name,
          assetClass,
          currency: instr.currency,
          amfiCode: instr.amfiCode ?? null,
          isin: instr.isin ?? null,
          interestRate: instr.interestRate ?? null,
        },
      })
      instrumentIdMap.set(instr.id, existing.id)
      report.instruments.updated++
    } else {
      const created = await prisma.instrument.create({
        data: {
          symbol: instr.symbol,
          name: instr.name,
          assetClass,
          source: instr.source,
          currency: instr.currency,
          amfiCode: instr.amfiCode ?? null,
          isin: instr.isin ?? null,
          interestRate: instr.interestRate ?? null,
        },
      })
      instrumentIdMap.set(instr.id, created.id)
      report.instruments.added++
    }
  }

  // ---- Accounts (upsert by broker name + type + name) ----
  for (const acct of doc.accounts) {
    let broker = await prisma.broker.findUnique({ where: { name: acct.broker } })
    if (!broker) {
      broker = await prisma.broker.create({ data: { name: acct.broker, kind: 'imported' } })
    }
    const type = acct.type as AccountType
    const existing = await prisma.account.findUnique({
      where: { brokerId_type_name: { brokerId: broker.id, type, name: acct.name } },
    })
    if (existing) {
      await prisma.account.update({
        where: { id: existing.id },
        data: { currency: acct.currency, params: acct.params as Prisma.InputJsonValue },
      })
      accountIdMap.set(acct.id, existing.id)
      report.accounts.updated++
    } else {
      const created = await prisma.account.create({
        data: { brokerId: broker.id, name: acct.name, type, currency: acct.currency, params: acct.params as Prisma.InputJsonValue },
      })
      accountIdMap.set(acct.id, created.id)
      report.accounts.added++
    }
  }

  // ---- Holdings (upsert by accountId + instrumentId) ----
  for (const holding of doc.holdings) {
    const accountId = accountIdMap.get(holding.accountId)
    const instrumentId = instrumentIdMap.get(holding.instrumentId)
    if (!accountId || !instrumentId) {
      errors.push(`Holding ${holding.id}: referenced account/instrument not found, skipped`)
      report.holdings.skipped++
      continue
    }
    const purchaseDate = parseDate(holding.purchaseDate)
    const existing = await prisma.holding.findUnique({
      where: { accountId_instrumentId: { accountId, instrumentId } },
    })
    if (existing) {
      await prisma.holding.update({
        where: { id: existing.id },
        data: {
          quantity: holding.quantity,
          avgCost: holding.avgCost,
          purchaseDate,
          params: holding.params as Prisma.InputJsonValue,
        },
      })
      report.holdings.updated++
    } else {
      await prisma.holding.create({
        data: {
          accountId,
          instrumentId,
          quantity: holding.quantity,
          avgCost: holding.avgCost,
          purchaseDate,
          params: holding.params as Prisma.InputJsonValue,
        },
      })
      report.holdings.added++
    }
  }

  // ---- Transactions (idempotent via externalId) ----
  for (const txn of doc.transactions) {
    const accountId = accountIdMap.get(txn.accountId)
    const instrumentId = instrumentIdMap.get(txn.instrumentId)
    if (!accountId || !instrumentId) {
      errors.push(`Transaction ${txn.id}: referenced account/instrument not found, skipped`)
      report.transactions.skipped++
      continue
    }
    const existing = await prisma.transaction.findUnique({
      where: { externalId: txn.id },
    })
    if (existing) {
      await prisma.transaction.update({
        where: { id: existing.id },
        data: {
          type: txn.type,
          date: parseDate(txn.date) ?? new Date(),
          quantity: txn.quantity ?? null,
          amount: txn.amount ?? null,
          nav: txn.nav ?? null,
          folio: txn.folio ?? null,
          notes: txn.notes ?? null,
        },
      })
      report.transactions.updated++
    } else {
      await prisma.transaction.create({
        data: {
          externalId: txn.id,
          accountId,
          instrumentId,
          type: txn.type,
          date: parseDate(txn.date) ?? new Date(),
          quantity: txn.quantity ?? null,
          amount: txn.amount ?? null,
          nav: txn.nav ?? null,
          folio: txn.folio ?? null,
          notes: txn.notes ?? null,
        },
      })
      report.transactions.added++
    }
  }

  // ---- Snapshots (upsert by date) ----
  for (const snap of doc.snapshots) {
    const date = parseDate(snap.date)
    if (!date) {
      report.snapshots.skipped++
      continue
    }
    const existing = await prisma.snapshot.findUnique({ where: { date } })
    if (existing) {
      await prisma.snapshot.update({
        where: { id: existing.id },
        data: { totalValueInr: snap.totalValueInr, investedInr: snap.investedInr },
      })
      report.snapshots.updated++
    } else {
      await prisma.snapshot.create({
        data: { date, totalValueInr: snap.totalValueInr, investedInr: snap.investedInr, breakdown: {} },
      })
      report.snapshots.added++
    }
  }

  // ---- Settings ----
  if (doc.settings) {
    await applySettings(doc.settings)
  }

  return { ok: true, report, errors }
}

async function applySettings(settings: PexDocument['settings']): Promise<void> {
  if (!settings) return
  const updates: PexDocument['settings'] = {
    refreshCadence: settings.refreshCadence ?? 'daily',
    refreshTime: settings.refreshTime ?? '18:00',
    targetAllocation: settings.targetAllocation ?? {},
    concentrationThreshold: settings.concentrationThreshold ?? 0.15,
  }
  await setSetting('refreshCadence', updates.refreshCadence)
  await setSetting('refreshTime', updates.refreshTime)
  await setSetting('targetAllocation', updates.targetAllocation)
  await setSetting('concentrationThreshold', updates.concentrationThreshold)
}

export { PEX_FORMAT, PEX_VERSION }
