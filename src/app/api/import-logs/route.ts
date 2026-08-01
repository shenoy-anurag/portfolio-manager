import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const logs = await prisma.importLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
  const data = logs.map((l) => ({
    id: l.id,
    source: l.source,
    fileName: l.fileName,
    status: l.status,
    summary: l.summary,
    createdAt: l.createdAt.toISOString(),
  }))
  return NextResponse.json({ logs: data })
}
