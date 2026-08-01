import { NextResponse } from 'next/server'
import { runRefresh } from '@/lib/refresh'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const result = await runRefresh()
  return NextResponse.json(result, { status: result.ok ? 200 : 500 })
}
