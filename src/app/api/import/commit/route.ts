import { NextResponse } from 'next/server'
import { commitImport } from '@/lib/importers/commit'
import { importPortfolio } from '@/lib/exchange/importer'
import type { ImportPreview } from '@/lib/importers/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface CommitBody {
  type?: 'pex' | 'preview'
  document?: unknown
  preview?: ImportPreview
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as CommitBody
    if (body.type === 'pex' && body.document) {
      const report = await importPortfolio(body.document)
      return NextResponse.json({ ok: true, report, type: 'pex' })
    }
    if (body.type === 'preview' && body.preview) {
      const result = await commitImport(body.preview)
      return NextResponse.json({ ok: true, result, type: 'preview' })
    }
    return NextResponse.json({ ok: false, error: 'Missing document or preview.' }, { status: 400 })
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 400 })
  }
}
