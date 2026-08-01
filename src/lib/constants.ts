import type { AssetClass } from '@/generated/prisma/client'

export const ASSET_CLASS_LABELS: Record<AssetClass, string> = {
  equity: 'Indian Equity',
  mf_equity: 'Equity Mutual Funds',
  mf_debt: 'Debt Mutual Funds',
  ppf: 'PPF',
  epfo: 'EPFO',
  fd: 'Fixed Deposits',
  us_equity: 'US Stocks',
  gold: 'Gold',
  cash: 'Cash',
  other: 'Other',
}

export const ASSET_CLASS_ORDER: AssetClass[] = [
  'equity',
  'mf_equity',
  'mf_debt',
  'us_equity',
  'ppf',
  'epfo',
  'fd',
  'gold',
  'cash',
  'other',
]

export const REFRESH_CADENCES = [
  { value: '1m', label: 'Every 1 minute' },
  { value: '5m', label: 'Every 5 minutes' },
  { value: '15m', label: 'Every 15 minutes' },
  { value: 'hourly', label: 'Hourly' },
  { value: 'daily', label: 'Daily (after market close)' },
] as const

export type RefreshCadence = (typeof REFRESH_CADENCES)[number]['value']

export const DEFAULT_REFRESH_TIME = '18:00'

export const DEFAULT_TARGET_ALLOCATION: Partial<Record<AssetClass, number>> = {
  equity: 40,
  mf_equity: 20,
  mf_debt: 15,
  ppf: 10,
  epfo: 10,
  fd: 5,
}

export const SETTING_KEYS = {
  refreshCadence: 'refreshCadence',
  refreshTime: 'refreshTime',
  targetAllocation: 'targetAllocation',
  concentrationThreshold: 'concentrationThreshold',
  yahooEnabled: 'yahooEnabled',
  amfiEnabled: 'amfiEnabled',
  aiEnabled: 'aiEnabled',
  aiProvider: 'aiProvider',
  aiModel: 'aiModel',
  installedAt: 'installedAt',
  portfolioName: 'portfolioName',
} as const

export const CADENCE_MS: Record<RefreshCadence, number | null> = {
  '1m': 60_000,
  '5m': 300_000,
  '15m': 900_000,
  hourly: 3_600_000,
  daily: null,
}
