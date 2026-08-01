import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const [brokers, accounts, instruments] = await Promise.all([
    prisma.broker.findMany({ orderBy: { name: 'asc' } }),
    prisma.account.findMany({ orderBy: { name: 'asc' } }),
    prisma.instrument.findMany({ orderBy: { name: 'asc' } }),
  ])
  return NextResponse.json({ brokers, accounts, instruments })
}
