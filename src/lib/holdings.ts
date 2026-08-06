import { prisma } from '@/lib/db'
import type { AccountType, AssetClass, InstrumentSource } from '@/generated/prisma/client'

export const ASSET_CLASSES: AssetClass[] = [
  'equity',
  'mf_equity',
  'mf_debt',
  'ppf',
  'epfo',
  'fd',
  'us_equity',
  'gold',
  'cash',
  'other',
]

export const ACCOUNT_TYPES: AccountType[] = ['demat', 'mf', 'ppf', 'epfo', 'fd', 'us', 'cash', 'other']

export interface HoldingInput {
  symbol?: string
  name?: string
  assetClass?: AssetClass
  currency?: string
  quantity?: number
  avgCost?: number
  purchaseDate?: string | null
  broker?: string
  accountName?: string
  accountType?: AccountType
  source?: InstrumentSource
  amfiCode?: string
  isin?: string
  interestRate?: number
}

export interface HoldingRef {
  id: string
  accountId: string
  instrumentId: string
}

export type UpsertResult =
  | { ok: true; holdingId: string }
  | { ok: false; error: string; status: number }

export async function upsertHolding(input: HoldingInput, existing?: HoldingRef): Promise<UpsertResult> {
  const symbol = (input.symbol ?? '').trim()
  const name = (input.name ?? input.symbol ?? '').trim()
  if (!symbol || !name) {
    return { ok: false, error: 'Symbol and name are required.', status: 400 }
  }
  const quantity = input.quantity
  const avgCost = input.avgCost
  if (
    typeof quantity !== 'number' ||
    typeof avgCost !== 'number' ||
    !Number.isFinite(quantity) ||
    !Number.isFinite(avgCost)
  ) {
    return { ok: false, error: 'Quantity and avg cost are required.', status: 400 }
  }
  const assetClass = input.assetClass ?? 'other'
  if (!ASSET_CLASSES.includes(assetClass)) {
    return { ok: false, error: 'Invalid asset class.', status: 400 }
  }
  const accountType = input.accountType ?? 'other'
  if (!ACCOUNT_TYPES.includes(accountType)) {
    return { ok: false, error: 'Invalid account type.', status: 400 }
  }
  const source: InstrumentSource = input.source ?? 'manual'
  const currency = input.currency ?? 'INR'
  const purchaseDate = input.purchaseDate ? new Date(input.purchaseDate) : null

  try {
    return await prisma.$transaction(async (tx) => {
      let instrumentId: string
      const found = await tx.instrument.findUnique({
        where: { source_symbol: { source, symbol } },
      })
      if (existing) {
        if (found && found.id !== existing.instrumentId) {
          const inst = await tx.instrument.update({
            where: { id: found.id },
            data: { name, assetClass, currency },
          })
          instrumentId = inst.id
        } else if (found) {
          const inst = await tx.instrument.update({
            where: { id: found.id },
            data: { name, assetClass, currency },
          })
          instrumentId = inst.id
        } else {
          const inst = await tx.instrument.update({
            where: { id: existing.instrumentId },
            data: { symbol, name, assetClass, currency },
          })
          instrumentId = inst.id
        }
      } else if (found) {
        const inst = await tx.instrument.update({
          where: { id: found.id },
          data: { name, assetClass, currency },
        })
        instrumentId = inst.id
      } else {
        const inst = await tx.instrument.create({
          data: {
            symbol,
            name,
            assetClass,
            source,
            currency,
            amfiCode: input.amfiCode?.trim() || null,
            isin: input.isin?.trim() || null,
            interestRate: input.interestRate ?? null,
          },
        })
        instrumentId = inst.id
      }

      const brokerName = (input.broker ?? 'Manual').trim()
      let broker = await tx.broker.findUnique({ where: { name: brokerName } })
      if (!broker) {
        broker = await tx.broker.create({ data: { name: brokerName, kind: 'manual' } })
      }

      const accountName = (input.accountName ?? `${broker.name} ${accountType}`).trim()
      const account = await tx.account.upsert({
        where: { brokerId_type_name: { brokerId: broker.id, type: accountType, name: accountName } },
        create: { brokerId: broker.id, name: accountName, type: accountType, currency, params: {} },
        update: { currency },
      })

      const updateData = { quantity, avgCost, purchaseDate }

      if (existing) {
        if (existing.accountId === account.id && existing.instrumentId === instrumentId) {
          const holding = await tx.holding.update({ where: { id: existing.id }, data: updateData })
          return { ok: true, holdingId: holding.id }
        }
        const dup = await tx.holding.findUnique({
          where: { accountId_instrumentId: { accountId: account.id, instrumentId } },
        })
        if (dup) {
          const holding = await tx.holding.update({ where: { id: dup.id }, data: updateData })
          await tx.holding.delete({ where: { id: existing.id } })
          return { ok: true, holdingId: holding.id }
        }
        const holding = await tx.holding.update({
          where: { id: existing.id },
          data: { ...updateData, accountId: account.id, instrumentId },
        })
        return { ok: true, holdingId: holding.id }
      }

      const holding = await tx.holding.upsert({
        where: { accountId_instrumentId: { accountId: account.id, instrumentId } },
        create: { accountId: account.id, instrumentId, ...updateData, params: {} },
        update: updateData,
      })
      return { ok: true, holdingId: holding.id }
    })
  } catch (error) {
    return { ok: false, error: String(error), status: 400 }
  }
}
