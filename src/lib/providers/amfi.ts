export const AMFI_NAV_URL = 'https://portal.amfiindia.com/spages/NAVAll.txt'

const MONTHS: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
}

export function parseNavDate(raw: string): string | null {
  const m = raw.match(/^(\d{1,2})-([A-Za-z]+)-(\d{4})$/)
  if (m) {
    const month = MONTHS[(m[2] ?? '').toLowerCase().slice(0, 3)]
    if (month === undefined) return null
    const dd = Number(m[1])
    const yyyy = Number(m[3])
    if (dd < 1 || dd > 31) return null
    return `${yyyy}-${String(month + 1).padStart(2, '0')}-${String(dd).padStart(2, '0')}`
  }
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (iso) return raw
  return null
}

export interface AmfiScheme {
  schemeCode: string
  isinGrowth: string | null
  isinDivReInv: string | null
  schemeName: string
  nav: number
  date: string
}

/**
 * Downloads and parses the official AMFI NAVAll.txt dump.
 * Returns a map of schemeCode -> scheme, an index of isin -> scheme,
 * plus the raw records.
 */
export async function fetchAmfiNavs(): Promise<{
  byCode: Map<string, AmfiScheme>
  byIsinGrowth: Map<string, AmfiScheme>
  byIsinDivReInv: Map<string, AmfiScheme>
  records: AmfiScheme[]
}> {
  const res = await fetch(AMFI_NAV_URL, {
    cache: 'default',
    headers: { Accept: 'text/plain' },
  })
  if (!res.ok) throw new Error(`AMFI fetch failed: ${res.status}`)
  const text = await res.text()
  const lines = text.split(/\r?\n/)
  const records: AmfiScheme[] = []
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('AMFI;') || trimmed.startsWith('Scheme Code;')) continue
    const parts = trimmed.split(';')
    // Records have at least 6 fields: code, isinGrowth, isinPayout / isin Dividend Reinvestment, name, nav, date
    if (parts.length < 6) continue
    const schemeCode = parts[0]?.trim()
    const isinGrowth = parts[1]?.trim() || null
    const isinDivReInv = parts[2]?.trim() || null
    const schemeName = parts[3]?.trim()
    const nav = Number(parts[4])
    const date = parseNavDate((parts[5]?.trim() ?? '') ) ?? ''
    if (!schemeCode || !schemeName || !Number.isFinite(nav)) continue
    if (!date) continue
    records.push({ schemeCode, isinGrowth, isinDivReInv, schemeName, nav, date })
  }
  const byCode = new Map(records.map((r) => [r.schemeCode, r]))
  // const byIsin = new Map(records.map((r) => [r.isin, r]))
  const byIsinGrowth = new Map<string, AmfiScheme>()
  for (const r of records) {
    if (r.isinGrowth) byIsinGrowth.set(r.isinGrowth, r)
  }
const byIsinDivReInv = new Map<string, AmfiScheme>()
  for (const r of records) {
    if (r.isinDivReInv) byIsinDivReInv.set(r.isinDivReInv, r)
  }
  return { byCode, byIsinGrowth, byIsinDivReInv, records }
}

export function normalizeSchemeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Find the best matching AMFI scheme for a fuzzy scheme name
 * (e.g. from a Zerodha/CAMS export). Returns scheme code + matched name.
 */
export function matchScheme(
  byCode: Map<string, AmfiScheme>,
  name: string,
): AmfiScheme | null {
  const target = normalizeSchemeName(name)
  if (!target) return null
  for (const scheme of byCode.values()) {
    if (normalizeSchemeName(scheme.schemeName) === target) return scheme
  }
  // Contains-match fallback, best by shortest name length
  let best: AmfiScheme | null = null
  for (const scheme of byCode.values()) {
    const candidate = normalizeSchemeName(scheme.schemeName)
    if (candidate.includes(target) || target.includes(candidate)) {
      if (!best || candidate.length < best.schemeName.length) best = scheme
    }
  }
  return best
}

export function matchISIN(
  isin: string,
  byIsinGrowth: Map<string, AmfiScheme>,
  byIsinDivReInv: Map<string, AmfiScheme>,
): AmfiScheme | null {
  if (!isin) return null
  const schemeGrowth = byIsinGrowth.get(isin)
  if (schemeGrowth && schemeGrowth != undefined) return schemeGrowth
  const schemeDiv = byIsinDivReInv.get(isin)
  if (schemeDiv && schemeDiv != undefined) return schemeDiv
  return null
}
