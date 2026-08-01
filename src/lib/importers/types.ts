import type { AssetClass, AccountType } from '@/generated/prisma/client'

export interface ParsedInstrument {
  symbol: string
  name: string
  assetClass: AssetClass
  source: 'yahoo' | 'amfi' | 'manual'
  currency: string
  amfiCode?: string | null
  isin?: string | null
  interestRate?: number | null
}

export interface ParsedHolding {
  instrument: ParsedInstrument
  quantity: number
  avgCost: number
  purchaseDate?: string | null
  accountName: string
  broker: string
  accountType: AccountType
}

export interface ParsedTransaction {
  instrument: ParsedInstrument
  type: 'buy' | 'sell' | 'sip' | 'dividend'
  date: string
  quantity?: number | null
  amount?: number | null
  nav?: number | null
  folio?: string | null
  notes?: string | null
  accountName?: string
  broker?: string
  accountType?: AccountType
}

export interface ImportPreview {
  source: string
  fileName: string
  holdings: ParsedHolding[]
  transactions: ParsedTransaction[]
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}
