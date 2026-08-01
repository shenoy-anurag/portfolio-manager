import { NextResponse } from 'next/server'
import { buildAnalytics } from '@/lib/analytics/portfolio'
import { getAnalyzer } from '@/lib/ai/portfolioAnalyzer'
import { getSettings } from '@/lib/settings'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const include = new URL(req.url).searchParams.get('include')
  const analytics = await buildAnalytics()
  const settings = await getSettings()

  const ai: { enabled: boolean; analysis?: unknown; disclaimer?: string } = {
    enabled: settings.aiEnabled,
  }
  if (include === 'ai' && settings.aiEnabled) {
    try {
      const analyzer = getAnalyzer(true)
      ai.analysis = await analyzer.analyze(analytics)
    } catch (error) {
      ai.disclaimer = String(error)
    }
  }

  return NextResponse.json({ analytics, ai })
}
