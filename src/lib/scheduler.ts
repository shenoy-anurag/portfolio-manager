import cron from 'node-cron'
import { prisma } from '@/lib/db'
import { getSettings } from '@/lib/settings'
import { CADENCE_MS } from '@/lib/constants'
import { runRefresh } from '@/lib/refresh'

let started = false
let lastIntradayRun = 0

function istNow(): { h: number; m: number } {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date())
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? 0)
  const m = Number(parts.find((p) => p.type === 'minute')?.value ?? 0)
  return { h, m }
}

function isSameIstDay(a: Date, b: Date): boolean {
  return (
    a.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) ===
    b.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
  )
}

async function alreadyRefreshedToday(): Promise<boolean> {
  const day = new Date()
  const logs = await prisma.refreshLog.findMany({
    where: { status: 'success' },
    orderBy: { startedAt: 'desc' },
    take: 1,
  })
  const last = logs[0]
  if (!last) return false
  return isSameIstDay(last.startedAt, day)
}

async function tick(): Promise<void> {
  try {
    const settings = await getSettings()
    if (settings.refreshCadence === 'daily') {
      const { h, m } = istNow()
      const [targetH, targetM] = settings.refreshTime.split(':').map(Number)
      if (h === targetH && m === targetM && !(await alreadyRefreshedToday())) {
        await runRefresh()
      }
    } else {
      const intervalMs = CADENCE_MS[settings.refreshCadence]
      if (intervalMs && Date.now() - lastIntradayRun >= intervalMs) {
        lastIntradayRun = Date.now()
        await runRefresh()
      }
    }
  } catch (error) {
    console.error('[scheduler] tick failed:', error)
  }
}

export function startScheduler(): void {
  if (started) return
  started = true
  cron.schedule('* * * * *', () => void tick(), { timezone: 'Asia/Kolkata' })
  console.log('[scheduler] started (Asia/Kolkata)')
}
