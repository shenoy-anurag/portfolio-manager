import { prisma } from '@/lib/db'
import { SETTING_KEYS, DEFAULT_TARGET_ALLOCATION, DEFAULT_REFRESH_TIME } from '@/lib/constants'
import type { RefreshCadence } from '@/lib/constants'

export interface AppSettings {
  refreshCadence: RefreshCadence
  refreshTime: string
  targetAllocation: Record<string, number>
  concentrationThreshold: number
  yahooEnabled: boolean
  amfiEnabled: boolean
  aiEnabled: boolean
  aiProvider: string
  aiModel: string
  installedAt: string | null
  portfolioName: string
}

const DEFAULTS: AppSettings = {
  refreshCadence: 'daily',
  refreshTime: DEFAULT_REFRESH_TIME,
  targetAllocation: { ...DEFAULT_TARGET_ALLOCATION },
  concentrationThreshold: 0.15,
  yahooEnabled: true,
  amfiEnabled: true,
  aiEnabled: false,
  aiProvider: 'openai',
  aiModel: 'gpt-4o-mini',
  installedAt: null,
  portfolioName: 'my-portfolio',
}

async function rawGet(key: string): Promise<unknown | undefined> {
  const row = await prisma.appSetting.findUnique({ where: { key } })
  return row ? (row.value as unknown) : undefined
}

export async function getSettings(): Promise<AppSettings> {
  const [cadence, time, allocation, conc, yahoo, amfi, ai, provider, model, installedAt, name] =
    await Promise.all([
      rawGet(SETTING_KEYS.refreshCadence),
      rawGet(SETTING_KEYS.refreshTime),
      rawGet(SETTING_KEYS.targetAllocation),
      rawGet(SETTING_KEYS.concentrationThreshold),
      rawGet(SETTING_KEYS.yahooEnabled),
      rawGet(SETTING_KEYS.amfiEnabled),
      rawGet(SETTING_KEYS.aiEnabled),
      rawGet(SETTING_KEYS.aiProvider),
      rawGet(SETTING_KEYS.aiModel),
      rawGet(SETTING_KEYS.installedAt),
      rawGet(SETTING_KEYS.portfolioName),
    ])

  return {
    refreshCadence: (cadence as RefreshCadence) ?? DEFAULTS.refreshCadence,
    refreshTime: (time as string) ?? DEFAULTS.refreshTime,
    targetAllocation: {
      ...DEFAULTS.targetAllocation,
      ...((allocation as Record<string, number>) ?? {}),
    },
    concentrationThreshold:
      (conc as number) ?? DEFAULTS.concentrationThreshold,
    yahooEnabled: (yahoo as boolean) ?? DEFAULTS.yahooEnabled,
    amfiEnabled: (amfi as boolean) ?? DEFAULTS.amfiEnabled,
    aiEnabled: (ai as boolean) ?? DEFAULTS.aiEnabled,
    aiProvider: (provider as string) ?? DEFAULTS.aiProvider,
    aiModel: (model as string) ?? DEFAULTS.aiModel,
    installedAt: (installedAt as string) ?? null,
    portfolioName: (name as string) ?? DEFAULTS.portfolioName,
  }
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await prisma.appSetting.upsert({
    where: { key },
    create: { key, value: value as object },
    update: { value: value as object },
  })
}

export async function ensureInstalled(): Promise<boolean> {
  const installed = await rawGet(SETTING_KEYS.installedAt)
  if (!installed) {
    await setSetting(SETTING_KEYS.installedAt, new Date().toISOString())
    return true
  }
  return false
}
