import ExcelJS from 'exceljs'
import type { ImportPreview, ParsedHolding } from '@/lib/importers/types'
import { slugify } from '@/lib/importers/types'

function cellText(v: unknown): string {
  if (v == null) return ''
  if (v instanceof Date) return v.toISOString()
  if (typeof v === 'object') {
    const o = v as { richText?: { text: string }[]; text?: unknown; result?: unknown }
    if (o.richText) return o.richText.map((r) => String(r.text)).join('')
    if (o.result != null) return String(o.result)
    if (o.text != null) return String(o.text)
  }
  return String(v).trim()
}

const norm = (s: string) => s.toLowerCase().replace(/[\s_-]+/g, ' ').trim()

function toNseYahooSymbol(symbol: string): string {
  let s = symbol.trim()
  const suffix = s.match(/-([A-Z]+)$/)?.[1]
  if (suffix === 'EQ' || suffix === 'BE' || suffix === 'SM' || suffix === 'BL') {
    s = s.replace(/-[A-Z]+$/, '')
    return `${s}.NS`
  }
  if (suffix === 'BO') {
    s = s.replace(/-[A-Z]+$/, '')
    return `${s}.BO`
  }
  if (!s.includes('.')) return `${s}.NS`
  return s
}

interface SheetConfig {
  isMf: boolean
}

function parseSheet(rows: unknown[][], cfg: SheetConfig): ParsedHolding[] {
  const out: ParsedHolding[] = []
  let headerIndex = -1
  let from = 0
  while (from < rows.length) {
    // find next header row that has Symbol + quantity-ish columns
    let found = -1
    for (let i = from; i < rows.length; i++) {
      const row = rows[i]
      const symbols = row.some((c) => norm(cellText(c)) === 'symbol')
      const qty = row.some((c) => /^(quantity|qty)/.test(norm(cellText(c))) && norm(cellText(c)).includes('avail'))
      if (symbols && qty) {
        found = i
        break
      }
    }
    if (found === -1) break
    headerIndex = found
    const header = rows[headerIndex].map(cellText)
    const idxSymbol = header.findIndex((h) => norm(h) === 'symbol')
    const idxQty = header.findIndex((h) => norm(h).includes('quantity') && norm(h).includes('avail'))
    const idxAvg = header.findIndex(
      (h) => /average/.test(norm(h)) || /avg/.test(norm(h)),
    )
    const idxIsin = header.findIndex((h) => /^isin$/.test(norm(h)))

    for (let i = headerIndex + 1; i < rows.length; i++) {
      const row = rows[i]
      const symbolRaw = cellText(row[idxSymbol])
      const qtyRaw = cellText(row[idxQty])
      if (!symbolRaw || symbolRaw === 'Total') break
      const quantity = Number(qtyRaw)
      if (!Number.isFinite(quantity) || quantity === 0) continue
      const avgCost = Number(cellText(row[idxAvg]))
      if (!Number.isFinite(avgCost)) continue
      const isin = idxIsin >= 0 ? cellText(row[idxIsin]) || null : null

      if (cfg.isMf) {
        out.push({
          instrument: {
            symbol: symbolRaw,
            name: symbolRaw,
            assetClass: 'mf_equity',
            source: 'amfi',
            currency: 'INR',
            isin,
          },
          quantity,
          avgCost,
          purchaseDate: null,
          accountName: 'Zerodha Coin',
          broker: 'Zerodha',
          accountType: 'mf',
        })
      } else {
        out.push({
          instrument: {
            symbol: toNseYahooSymbol(symbolRaw),
            name: symbolRaw,
            assetClass: 'equity',
            source: 'yahoo',
            currency: 'INR',
            isin,
          },
          quantity,
          avgCost,
          purchaseDate: null,
          accountName: 'Zerodha Demat',
          broker: 'Zerodha',
          accountType: 'demat',
        })
      }
    }
    from = found + 1
  }
  return out
}

export async function parseZerodhaHoldings(buffer: ArrayBuffer): Promise<ImportPreview> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer)
  const holdings: ParsedHolding[] = []
  for (const ws of workbook.worksheets) {
    const sheetName = ws.name.toLowerCase()
    const isMf = sheetName.includes('mutual')
    const rows = (ws.getSheetValues() as unknown[][])
      .map((r) => r ?? [])
      .filter((r) => r.length > 0)
    holdings.push(...parseSheet(rows, { isMf }))
  }
  return {
    source: 'zerodha',
    fileName: 'Zerodha Holdings',
    holdings,
    transactions: [],
  }
}

export { slugify }
