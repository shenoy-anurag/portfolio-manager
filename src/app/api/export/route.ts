import { NextResponse } from 'next/server'
import { exportPortfolio } from '@/lib/exchange/exporter'
import { getSettings } from '@/lib/settings'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const { portfolioName } = await getSettings()
  const doc = await exportPortfolio()
  const safeName = (portfolioName ?? 'portfolio').replace(/[^a-zA-Z0-9_-]/g, '_')
  const body = JSON.stringify(doc, null, 2)
  return new NextResponse(body, {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${safeName}.portfolio.json"`,
    },
  })
}
