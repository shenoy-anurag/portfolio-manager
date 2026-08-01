import { NextResponse } from 'next/server'
import { getSettings, setSetting } from '@/lib/settings'
import { SETTING_KEYS } from '@/lib/constants'
import type { RefreshCadence } from '@/lib/constants'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const CADENCES: RefreshCadence[] = ['1m', '5m', '15m', 'hourly', 'daily']
const BOOLEAN_KEYS = ['yahooEnabled', 'amfiEnabled', 'aiEnabled'] as const

export async function GET() {
  const settings = await getSettings()
  return NextResponse.json(settings)
}

export async function PUT(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>

    const cadence = body.refreshCadence as RefreshCadence
    if (cadence && !CADENCES.includes(cadence)) {
      return NextResponse.json({ ok: false, error: 'Invalid refresh cadence.' }, { status: 400 })
    }
    if (cadence) await setSetting(SETTING_KEYS.refreshCadence, cadence)

    if (typeof body.refreshTime === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(body.refreshTime)) {
      await setSetting(SETTING_KEYS.refreshTime, body.refreshTime)
    }
    if (
      body.concentrationThreshold !== undefined &&
      Number.isFinite(Number(body.concentrationThreshold))
    ) {
      const value = Number(body.concentrationThreshold)
      if (value <= 0 || value > 1) {
        return NextResponse.json(
          { ok: false, error: 'Concentration threshold must be between 0 and 1.' },
          { status: 400 },
        )
      }
      await setSetting(SETTING_KEYS.concentrationThreshold, value)
    }
    if (typeof body.targetAllocation === 'object' && body.targetAllocation !== null) {
      await setSetting(SETTING_KEYS.targetAllocation, body.targetAllocation)
    }
    for (const key of BOOLEAN_KEYS) {
      if (typeof body[key] === 'boolean') await setSetting(SETTING_KEYS[key], body[key])
    }

    const settings = await getSettings()
    return NextResponse.json({ ok: true, settings })
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 400 })
  }
}
