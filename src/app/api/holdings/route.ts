import { NextResponse } from 'next/server'
import { computeValuation } from '@/lib/valuation'
import { upsertHolding } from '@/lib/holdings'
import type { HoldingInput } from '@/lib/holdings'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const valuation = await computeValuation()
  const holdings = valuation.holdings
    .map((h) => ({ ...h, valueInr: Number(h.valueInr.toFixed(2)) }))
    .sort((a, b) => b.valueInr - a.valueInr)
  return NextResponse.json({ holdings, totals: { ...valuation, holdings: undefined } })
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as HoldingInput
    const result = await upsertHolding(body)
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: result.status })
    }
    return NextResponse.json({ ok: true, holdingId: result.holdingId })
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 400 })
  }
}
