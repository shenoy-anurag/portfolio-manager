import { NextResponse } from 'next/server'
import { parseUploadedFile } from '@/lib/importers/detect'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const form = await req.formData()
    const file = form.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ ok: false, error: 'No file provided.' }, { status: 400 })
    }
    const password = (form.get('password') as string) || undefined
    const buffer = await file.arrayBuffer()
    const parsed = await parseUploadedFile(file.name, buffer, password)
    return NextResponse.json({ ok: true, ...parsed })
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 400 })
  }
}
