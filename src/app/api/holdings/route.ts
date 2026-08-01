import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { computeValuation } from '@/lib/valuation'
import type { AssetClass, AccountType, InstrumentSource } from '@/generated/prisma/client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ASSET_CLASSES: AssetClass[] = [
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
const ACCOUNT_TYPES: AccountType[] = ['demat', 'mf', 'ppf', 'epfo', 'fd', 'us', 'cash', 'other']

interface ManualHoldingBody {
  symbol?: string
  name?: string
  assetClass?: AssetClass
  currency?: string
  quantity?: number
  avgCost?: number
  purchaseDate?: string
  broker?: string
  accountName?: string
  accountType?: AccountType
  source?: InstrumentSource
  amfiCode?: string
  isin?: string
  interestRate?: number
}

export async function GET() {
  const valuation = await computeValuation()
  const holdings = valuation.holdings
    .map((h) => ({ ...h, valueInr: Number(h.valueInr.toFixed(2)) }))
    .sort((a, b) => b.valueInr - a.valueInr)
  return NextResponse.json({ holdings, totals: { ...valuation, holdings: undefined } })
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ManualHoldingBody
    const symbol = (body.symbol ?? '').trim()
    const name = (body.name ?? body.symbol ?? '').trim()
    if (!symbol || !name) {
      return NextResponse.json({ ok: false, error: 'Symbol and name are required.' }, { status: 400 })
    }
    const quantity = body.quantity
    const avgCost = body.avgCost
    if (
      typeof quantity !== 'number' ||
      typeof avgCost !== 'number' ||
      !Number.isFinite(quantity) ||
      !Number.isFinite(avgCost)
    ) {
      return NextResponse.json({ ok: false, error: 'Quantity and avg cost are required.' }, { status: 400 })
    }
    const assetClass = body.assetClass ?? 'other'
    if (!ASSET_CLASSES.includes(assetClass)) {
      return NextResponse.json({ ok: false, error: 'Invalid asset class.' }, { status: 400 })
    }
    const accountType = body.accountType ?? 'other'
    if (!ACCOUNT_TYPES.includes(accountType)) {
      return NextResponse.json({ ok: false, error: 'Invalid account type.' }, { status: 400 })
    }
    const source: InstrumentSource = body.source ?? 'manual'

    let instrument = await prisma.instrument.findUnique({
      where: { source_symbol: { source, symbol } },
    })
    if (!instrument) {
      instrument = await prisma.instrument.create({
        data: {
          symbol,
          name,
          assetClass,
          source,
          currency: body.currency ?? 'INR',
          amfiCode: body.amfiCode?.trim() || null,
          isin: body.isin?.trim() || null,
          interestRate: body.interestRate ?? null,
        },
      })
    } else {
      instrument = await prisma.instrument.update({
        where: { id: instrument.id },
        data: { name, assetClass },
      })
    }

    let broker = await prisma.broker.findUnique({ where: { name: body.broker ?? 'Manual' } })
    if (!broker) broker = await prisma.broker.create({ data: { name: body.broker ?? 'Manual', kind: 'manual' } })

    const accountName = body.accountName ?? `${broker.name} ${accountType}`
    const account = await prisma.account.upsert({
      where: {
        brokerId_type_name: { brokerId: broker.id, type: accountType, name: accountName },
      },
      create: {
        brokerId: broker.id,
        name: accountName,
        type: accountType,
        currency: body.currency ?? 'INR',
        params: {},
      },
      update: {},
    })

    const holding = await prisma.holding.upsert({
      where: { accountId_instrumentId: { accountId: account.id, instrumentId: instrument.id } },
      create: {
        accountId: account.id,
        instrumentId: instrument.id,
        quantity,
        avgCost,
        purchaseDate: body.purchaseDate ? new Date(body.purchaseDate) : null,
        params: {},
      },
      update: { quantity, avgCost },
    })

    return NextResponse.json({ ok: true, holdingId: holding.id })
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 400 })
  }
}
