import path from 'node:path'
import type { ImportPreview, ParsedHolding, ParsedTransaction } from '@/lib/importers/types'

const num = (s: string): number | null => {
  const n = Number(s.replace(/,/g, ''))
  return Number.isFinite(n) ? n : null
}

function toIsoDate(ddmmyy: string): string {
  const m = ddmmyy.match(/^(\d{2})-(\d{2})-(\d{4})$/)
  if (!m) return ''
  return `${m[3]}-${m[2]}-${m[1]}`
}

interface FolioBlock {
  schemeName: string
  folio: string
  closingUnits: number | null
  rows: { raw: string; date: string; type: string }[]
}

function extractFolioBlocks(text: string): FolioBlock[] {
  const blocks: FolioBlock[] = []
  const schemeRe = /Scheme\s*[Nn]ame\s*:?\s*([^\r\n]+)/g
  let match: RegExpExecArray | null
  while ((match = schemeRe.exec(text)) !== null) {
    const schemeName = match[1].replace(/^[-:\s]+|[-:\s]+$/g, '')
    // Capture the following block until the next "Scheme Name"
    const nextIndex = text.indexOf('Scheme', match.index + match[0].length)
    const chunk = nextIndex === -1 ? text.slice(match.index) : text.slice(match.index, nextIndex)

    const folioMatch = chunk.match(/Folio\s*(?:Number|No)\s*:?\s*([A-Za-z0-9/]+)/i)
    const closeMatch = chunk.match(/Closing\s*Unit\s*Balance\s*:?\s*([\d,.]+)/i)

    const rows: FolioBlock['rows'] = []
    const txnRe = /(\d{2}-\d{2}-\d{4})\s+([A-Z\s]+?)\s+(?=\d)/g
    let txn: RegExpExecArray | null
    while ((txn = txnRe.exec(chunk)) !== null) {
      rows.push({ raw: txn[0], date: toIsoDate(txn[1]), type: txn[2].trim() })
    }
    blocks.push({
      schemeName,
      folio: folioMatch?.[1] ?? '',
      closingUnits: closeMatch ? num(closeMatch[1]) : null,
      rows,
    })
  }
  return blocks
}

function txnType(raw: string): { type: 'buy' | 'sell' | 'sip' | 'dividend'; isSip: boolean } {
  const t = raw.toLowerCase()
  const isSip = t.includes('sip')
  if (t.includes('redemption') || t.includes('repurchase') || t.includes('switch') && t.includes('out')) {
    return { type: 'sell', isSip }
  }
  if (t.includes('dividend')) return { type: 'buy', isSip }
  if (t.includes('switch') && t.includes('in')) return { type: 'buy', isSip }
  return { type: isSip ? 'sip' : 'buy', isSip }
}

export async function parseCamsPdf(
  buffer: ArrayBuffer,
  password?: string,
): Promise<ImportPreview> {
  let pdfjs: typeof import('pdfjs-dist/legacy/build/pdf.mjs')
  try {
    pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  } catch {
    pdfjs = await import('pdfjs-dist')
  }
  pdfjs.GlobalWorkerOptions.workerSrc = `file://${path.join(
    process.cwd(),
    'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs',
  )}`

  const doc = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    password: password || undefined,
    useWorkerFetch: false,
    useSystemFonts: true,
  }).promise

  let text = ''
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    let lastY: number | null = null
    let line = ''
    for (const item of content.items as { str?: string; transform?: number[] }[]) {
      const y = item.transform?.[5]
      if (lastY !== null && y !== undefined && Math.abs(y - lastY) > 2 && line) {
        text += line.trim() + '\n'
        line = ''
      }
      line += ` ${item.str ?? ''}`
      if (y !== undefined) lastY = y
    }
    if (line.trim()) text += line.trim() + '\n'
  }

  const holdings = new Map<string, ParsedHolding>()
  const transactions: ParsedTransaction[] = []
  for (const block of extractFolioBlocks(text)) {
    if (!block.schemeName) continue
    const instrument = {
      symbol: block.schemeName,
      name: block.schemeName,
      assetClass: 'mf_equity' as const,
      source: 'amfi' as const,
      currency: 'INR',
      amfiCode: null,
      isin: null,
    }
    if (!holdings.has(block.schemeName)) {
      holdings.set(block.schemeName, {
        instrument,
        quantity: block.closingUnits ?? 0,
        avgCost: 0,
        accountName: 'CAMS Mutual Funds',
        broker: 'CAMS',
        accountType: 'mf' as const,
      })
    }
    for (const row of block.rows) {
      if (!row.date) continue
      const { type, isSip } = txnType(row.type)
      transactions.push({
        instrument,
        type: isSip ? 'sip' : type,
        date: row.date,
        quantity: null,
        amount: null,
        nav: null,
        folio: block.folio || null,
        notes: row.raw,
        accountName: 'CAMS Mutual Funds',
        broker: 'CAMS',
        accountType: 'mf' as const,
      })
    }
  }

  if (holdings.size === 0 && transactions.length === 0) {
    throw new Error('Could not parse this CAS PDF. Try the CAMS Excel statement instead.')
  }

  return {
    source: 'cams-pdf',
    fileName: 'CAMS CAS PDF',
    holdings: [...holdings.values()],
    transactions,
  }
}
