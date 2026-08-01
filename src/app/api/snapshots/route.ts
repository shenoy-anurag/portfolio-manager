import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const snapshots = await prisma.snapshot.findMany({
    orderBy: { date: 'asc' },
  })
  const data = snapshots.map((s) => ({
    date: s.date.toISOString().slice(0, 10),
    totalValueInr: Number(s.totalValueInr),
    investedInr: Number(s.investedInr),
    breakdown: s.breakdown,
  }))
  return NextResponse.json({ snapshots: data })
}
