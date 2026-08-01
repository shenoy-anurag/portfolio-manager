import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

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
    const body = (await req.json()) as { quantity?: number; avgCost?: number }
    const data: Record<string, unknown> = {}
    if (body.quantity !== undefined && Number.isFinite(body.quantity)) data.quantity = body.quantity
    if (body.avgCost !== undefined && Number.isFinite(body.avgCost)) data.avgCost = body.avgCost
    if (Object.keys(data).length === 0) {
      return NextResponse.json({ ok: false, error: 'Nothing to update.' }, { status: 400 })
    }
    await prisma.holding.update({ where: { id }, data })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 400 })
  }
}
