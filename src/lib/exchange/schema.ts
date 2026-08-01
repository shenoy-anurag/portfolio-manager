import { z } from 'zod'
import type { AssetClass, AccountType, InstrumentSource } from '@/generated/prisma/client'

export const PEX_FORMAT = 'portfolio-manager-portfolio'
export const PEX_VERSION = 1

const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD')

const instrumentSchema = z.object({
  id: z.string().min(1),
  symbol: z.string().min(1),
  name: z.string(),
  assetClass: z.enum([
    'equity',
    'mf_equity',
    'mf_debt',
    'ppf',
    'epfo',
    'fd',
    'us_equity',
    'gold',
    'cash',
    'other',
  ] as const),
  source: z.enum(['yahoo', 'amfi', 'manual'] as const),
  currency: z.string().min(3).default('INR'),
  amfiCode: z.string().nullable().optional(),
  isin: z.string().nullable().optional(),
  interestRate: z.number().nullable().optional(),
})

const accountSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  broker: z.string().min(1),
  type: z.enum(['demat', 'mf', 'ppf', 'epfo', 'fd', 'us', 'cash', 'other'] as const),
  currency: z.string().min(3).default('INR'),
  params: z.record(z.string(), z.unknown()).default({}),
})

const holdingSchema = z.object({
  id: z.string().min(1),
  accountId: z.string().min(1),
  instrumentId: z.string().min(1),
  quantity: z.number(),
  avgCost: z.number(),
  purchaseDate: dateKey.nullable().optional(),
  params: z.record(z.string(), z.unknown()).default({}),
})

const transactionSchema = z.object({
  id: z.string().min(1),
  accountId: z.string().min(1),
  instrumentId: z.string().min(1),
  type: z.enum(['buy', 'sell', 'sip', 'dividend']),
  date: dateKey,
  quantity: z.number().nullable().optional(),
  amount: z.number().nullable().optional(),
  nav: z.number().nullable().optional(),
  folio: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
})

const snapshotSchema = z.object({
  date: dateKey,
  totalValueInr: z.number(),
  investedInr: z.number(),
})

const settingsSchema = z.object({
  refreshCadence: z.enum(['daily', '1m', '5m', '15m', 'hourly']).optional(),
  refreshTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  targetAllocation: z.record(z.string(), z.number()).optional(),
  concentrationThreshold: z.number().optional(),
})

export const pexSchema = z.object({
  format: z.literal(PEX_FORMAT),
  version: z.literal(PEX_VERSION),
  exportedAt: z.string().datetime().optional(),
  appVersion: z.string().optional(),
  baseCurrency: z.string().default('INR'),
  instruments: z.array(instrumentSchema).default([]),
  accounts: z.array(accountSchema).default([]),
  holdings: z.array(holdingSchema).default([]),
  transactions: z.array(transactionSchema).default([]),
  snapshots: z.array(snapshotSchema).default([]),
  settings: settingsSchema.nullable().optional(),
})

export type PexDocument = z.infer<typeof pexSchema>
export type PexInstrument = z.infer<typeof instrumentSchema>
export type PexAccount = z.infer<typeof accountSchema>
export type PexHolding = z.infer<typeof holdingSchema>
export type PexTransaction = z.infer<typeof transactionSchema>
export type PexSnapshot = z.infer<typeof snapshotSchema>
export type PexSettings = z.infer<typeof settingsSchema>

export type { AssetClass, AccountType, InstrumentSource }

export const ASSET_CLASS_TO_PEX = (a: AssetClass): PexInstrument['assetClass'] => a
export const PEX_TO_ASSET_CLASS = (a: string): AssetClass => a as AssetClass
