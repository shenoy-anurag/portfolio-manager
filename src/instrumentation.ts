export async function register() {
  if (process.env.NEXT_PHASE === 'phase-production-build') return
  if (process.env.NEXT_RUNTIME && process.env.NEXT_RUNTIME !== 'nodejs') return
  const { startScheduler } = await import('@/lib/scheduler')
  startScheduler()
}
