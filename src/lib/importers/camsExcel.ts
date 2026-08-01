import ExcelJS from 'exceljs'
import type { ImportPreview, ParsedHolding, ParsedTransaction } from '@/lib/importers/types'

function cellText(v: unknown): string {
  if (v == null) return ''
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  if (typeof v === 'object') {
    const o = v as { richText?: { text: string }[]; text?: unknown; result?: unknown }
    if (o.richText) return o.richText.map((r) => String(r.text)).join('')
    if (o.result != null) return String(o.result)
    if (o.text != null) return String(o.text)
  }
  return String(v).trim()
}

const norm = (s: string) => s.toLowerCase().replace(/[\s_-]+/g, ' ').trim()

function findHeaderIndex(rows: unknown[][]): number {
  for (let i = 0; i < rows.length; i++) {
    const text = rows[i].map(cellText).map(norm).join(' ')
    if (/scheme/.test(text) && /trans type|transaction/.test(text)) return i
  }
  return -1
}

function parseDateStr(v: string): string | null {
  if (!v) return null
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
}

function mapTxnType(raw: string): { type: 'buy' | 'sell' | 'sip' | 'dividend'; isSip: boolean } {
  const t = norm(raw)
  const isSip = t.includes('sip')
  if (t.includes('redemption') || t.includes('repurchase')) return { type: 'sell', isSip }
  if (t.includes('dividend')) return { type: isSip ? 'buy' : 'dividend', isSip }
  if (t.includes('switch') && t.includes('out')) return { type: 'sell', isSip }
  if (t.includes('switch') && t.includes('in')) return { type: 'buy', isSip }
  return { type: isSip ? 'sip' : 'buy', isSip }
}

export async function parseCamsExcel(buffer: ArrayBuffer): Promise<ImportPreview> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer)
  const ws = workbook.worksheets[0]
  const rows = (ws.getSheetValues() as unknown[][])
    .map((r) => r ?? [])
    .filter((r) => r.length > 0)
  const headerIndex = findHeaderIndex(rows)
  if (headerIndex === -1) throw new Error('Could not find a CAMS header row (Scheme Name / Trans Type)')

  const header = rows[headerIndex].map(cellText)
  const idx = (re: RegExp) => header.findIndex((h) => re.test(norm(h)))
  const iScheme = idx(/scheme/)
  const iFolio = idx(/folio/)
  const iType = idx(/trans type|transaction type/)
  const iDate = idx(/trans date/)
  const iAmount = idx(/trans amt|amount/)
  const iUnits = idx(/units/)
  const iNav = idx(/nav/)
  const iCode = idx(/scheme code|amfi/)
  const iIsin = idx(/^isin$/)

  const holdings = new Map<string, ParsedHolding>()
  const transactions: ParsedTransaction[] = []

  for (let r = headerIndex + 1; r < rows.length; r++) {
    const row = rows[r]
    const schemeName = cellText(row[iScheme])
    if (!schemeName || /^(grand total|total|scheme name)/i.test(schemeName)) continue
    const amfiCode = iCode >= 0 ? cellText(row[iCode]) || null : null
    const isin = iIsin >= 0 ? cellText(row[iIsin]) || null : null
    const folio = iFolio >= 0 ? cellText(row[iFolio]) || null : null
    const txnRaw = iType >= 0 ? cellText(row[iType]) : ''
    const dateRaw = iDate >= 0 ? cellText(row[iDate]) : ''
    const units = iUnits >= 0 ? Number(cellText(row[iUnits])) : NaN
    const nav = iNav >= 0 ? Number(cellText(row[iNav])) : NaN
    const amount = iAmount >= 0 ? Number(cellText(row[iAmount])) : NaN

    const instrument = {
      symbol: schemeName,
      name: schemeName,
      assetClass: 'mf_equity' as const,
      source: 'amfi' as const,
      currency: 'INR',
      amfiCode,
      isin,
    }

    if (!holdings.has(schemeName)) {
      holdings.set(schemeName, {
        instrument,
        quantity: 0,
        avgCost: 0,
        accountName: 'CAMS Mutual Funds',
        broker: 'CAMS',
        accountType: 'mf' as const,
      })
    }

    if (txnRaw) {
      const { type, isSip } = mapTxnType(txnRaw)
      transactions.push({
        instrument,
        type: isSip ? 'sip' : type,
        date: parseDateStr(dateRaw) ?? '',
        quantity: Number.isFinite(units) ? units : null,
        amount: Number.isFinite(amount) ? amount : null,
        nav: Number.isFinite(nav) ? nav : null,
        folio,
        notes: txnRaw,
        accountName: 'CAMS Mutual Funds',
        broker: 'CAMS',
        accountType: 'mf' as const,
      })
    }
  }

  return {
    source: 'cams',
    fileName: 'CAMS Transaction Statement',
    holdings: [...holdings.values()],
    transactions,
  }
}
