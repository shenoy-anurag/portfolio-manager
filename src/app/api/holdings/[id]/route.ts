import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { upsertHolding } from '@/lib/holdings'
import type { HoldingInput } from '@/lib/holdings'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ id: string }> }

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { id } = await params
    const holding = await prisma.holding.findUnique({ where: { id } })
    if (!holding) {
      return NextResponse.json({ ok: false, error: 'Holding not found.' }, { status: 404 })
    }
    await prisma.holding.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 400 })
  }
}

export async function PUT(req: Request, { params }: Params) {
  try {
    const { id } = await params
    const body = (await req.json()) as HoldingInput
    const holding = await prisma.holding.findUnique({
      where: { id },
      include: { instrument: true, account: { include: { broker: true } } },
    })
    if (!holding) {
      return NextResponse.json({ ok: false, error: 'Holding not found.' }, { status: 404 })
    }

    const result = await upsertHolding(
      {
        symbol: body.symbol ?? holding.instrument.symbol,
        name: body.name ?? holding.instrument.name,
        assetClass: body.assetClass ?? holding.instrument.assetClass,
        currency: body.currency ?? holding.instrument.currency,
        quantity: body.quantity ?? Number(holding.quantity),
        avgCost: body.avgCost ?? Number(holding.avgCost),
        purchaseDate:
          body.purchaseDate !== undefined
            ? body.purchaseDate || null
            : holding.purchaseDate
              ? holding.purchaseDate.toISOString().slice(0, 10)
              : null,
        broker: body.broker ?? holding.account.broker.name,
        accountName: body.accountName ?? holding.account.name,
        accountType: body.accountType ?? holding.account.type,
        source: holding.instrument.source,
      },
      { id: holding.id, accountId: holding.accountId, instrumentId: holding.instrumentId },
    )

    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: result.status })
    }
    return NextResponse.json({ ok: true, holdingId: result.holdingId })
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 400 })
  }
}
