import { fetchAmfiNavs, matchScheme } from '@/lib/providers/amfi'
import type { ParsedInstrument } from '@/lib/importers/types'

export interface AmfiLookup {
  byCode: Map<string, { name: string; isin: string | null }>
}

/**
 * Fetches the AMFI master once and resolves scheme names (fuzzy) to codes.
 */
export async function resolveAmfiSchemes(
  names: string[],
): Promise<Map<string, { amfiCode: string; isin: string | null; name: string }>> {
  const { byCode } = await fetchAmfiNavs()
  const result = new Map<string, { amfiCode: string; isin: string | null; name: string }>()
  const seen = new Set<string>()
  for (const name of names) {
    if (seen.has(name)) continue
    seen.add(name)
    const match = matchScheme(byCode, name)
    if (match) {
      result.set(name, { amfiCode: match.schemeCode, isin: match.isinGrowth, name: match.schemeName })
    }
  }
  return result
}

export function applyAmfiResolution(
  instruments: ParsedInstrument[],
  resolved: Map<string, { amfiCode: string; isin: string | null; name: string }>,
): ParsedInstrument[] {
  return instruments.map((i) => {
    if (i.source !== 'amfi') return i
    const key = i.amfiCode ? undefined : i.symbol
    if (!key) return i
    const match = resolved.get(key)
    if (!match) return i
    return {
      ...i,
      amfiCode: match.amfiCode,
      isin: match.isin,
      name: match.name,
    }
  })
}
