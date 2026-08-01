import { parseZerodhaHoldings } from '@/lib/importers/zerodha'
import { parseCamsExcel } from '@/lib/importers/camsExcel'
import { parseCamsPdf } from '@/lib/importers/camsPdf'
import { applyAmfiResolution, resolveAmfiSchemes } from '@/lib/importers/resolve'
import type { ImportPreview } from '@/lib/importers/types'

export type ImportFileKind = 'zerodha' | 'cams-excel' | 'cams-pdf' | 'pex'

export interface ParsedFile {
  kind: ImportFileKind
  preview?: ImportPreview
  pex?: unknown
  fileName: string
}

async function detectXlsxKind(buffer: ArrayBuffer): Promise<'zerodha' | 'cams-excel'> {
  const { default: ExcelJS } = await import('exceljs')
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buffer)
  const sheetNames = wb.worksheets.map((w) => w.name.toLowerCase()).join(' ')
  const hasEquity = /equity|holding/.test(sheetNames)
  const hasSchemeTxn = /transaction|statement/.test(sheetNames)
  if (hasEquity) return 'zerodha'
  if (hasSchemeTxn) return 'cams-excel'
  // Inspect header of first sheet
  const ws = wb.worksheets[0]
  const rows = ws.getSheetValues() as unknown[][]
  const firstText = rows
    .slice(0, 10)
    .flat()
    .map((c) => String(c ?? ''))
    .join(' ')
    .toLowerCase()
  if (/scheme name/.test(firstText) && /trans type/.test(firstText)) return 'cams-excel'
  return 'zerodha'
}

export async function parseUploadedFile(
  fileName: string,
  buffer: ArrayBuffer,
  password?: string,
): Promise<ParsedFile> {
  const lower = fileName.toLowerCase()

  if (lower.endsWith('.json') || lower.endsWith('.portfolio.json')) {
    const text = new TextDecoder().decode(buffer)
    let doc: unknown
    try {
      doc = JSON.parse(text)
    } catch {
      throw new Error('Invalid JSON file.')
    }
    return { kind: 'pex', pex: doc, fileName }
  }

  if (lower.endsWith('.pdf')) {
    const preview = await parseCamsPdf(buffer, password)
    return { kind: 'cams-pdf', preview, fileName }
  }

  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
    const kind = await detectXlsxKind(buffer)
    if (kind === 'zerodha') {
      let preview = await parseZerodhaHoldings(buffer)
      const mfNames = preview.holdings
        .filter((h) => h.instrument.source === 'amfi')
        .map((h) => h.instrument.symbol)
      if (mfNames.length > 0) {
        const resolved = await resolveAmfiSchemes(mfNames)
        preview = {
          ...preview,
          holdings: preview.holdings.map((h) => ({
            ...h,
            instrument: applyAmfiResolution([h.instrument], resolved)[0] ?? h.instrument,
          })),
        }
      }
      return { kind: 'zerodha', preview, fileName }
    }
    const preview = await parseCamsExcel(buffer)
    return { kind: 'cams-excel', preview, fileName }
  }

  throw new Error('Unsupported file type. Use .xlsx, .pdf, or .json')
}
