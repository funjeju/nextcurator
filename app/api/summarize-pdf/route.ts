import { NextRequest, NextResponse } from 'next/server'
import { classifyCategory, generateSummary, generateReportSummary } from '@/lib/claude'
import { randomUUID } from 'crypto'

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!
const API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY!
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`

function toFirestoreValue(v: unknown): unknown {
  if (v === null || v === undefined) return { nullValue: null }
  if (typeof v === 'string') return { stringValue: v }
  if (typeof v === 'number') return { integerValue: String(v) }
  if (typeof v === 'boolean') return { booleanValue: v }
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toFirestoreValue) } }
  if (typeof v === 'object') {
    const fields: Record<string, unknown> = {}
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      fields[k] = toFirestoreValue(val)
    }
    return { mapValue: { fields } }
  }
  return { stringValue: String(v) }
}

function toFirestoreFields(obj: Record<string, unknown>): Record<string, unknown> {
  const fields: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) {
    fields[k] = toFirestoreValue(v)
  }
  return fields
}

// PDF 텍스트 추출: Gemini File API 또는 텍스트 레이어 파싱
async function extractPdfText(buffer: ArrayBuffer, filename: string): Promise<string> {
  // PDF 바이너리에서 텍스트 레이어 추출 (간단한 파싱)
  const bytes = new Uint8Array(buffer)
  const text = new TextDecoder('latin1').decode(bytes)

  // PDF 스트림에서 텍스트 추출
  const extracted: string[] = []
  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g
  let match

  while ((match = streamRegex.exec(text)) !== null) {
    const stream = match[1]
    // BT/ET 블록에서 텍스트 연산자 추출
    const textBlocks = stream.match(/\(([^)]{1,200})\)\s*Tj/g)
    if (textBlocks) {
      for (const block of textBlocks) {
        const inner = block.match(/\(([^)]+)\)/)
        if (inner) extracted.push(inner[1])
      }
    }
  }

  const result = extracted.join(' ').replace(/\s+/g, ' ').trim()
  if (result.length > 200) return result.slice(0, 10000)

  // 텍스트 레이어 없으면 파일명으로 힌트만 제공
  return `PDF 파일: ${filename}\n[텍스트 레이어를 추출할 수 없습니다. 스캔된 PDF이거나 이미지 기반 PDF일 수 있습니다.]`
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const userCategory = formData.get('category') as string | null

    if (!file) return NextResponse.json({ error: 'PDF 파일이 필요합니다.' }, { status: 400 })
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json({ error: 'PDF 파일만 업로드할 수 있습니다.' }, { status: 400 })
    }
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'PDF 파일은 10MB 이하만 가능합니다.' }, { status: 400 })
    }

    const buffer = await file.arrayBuffer()
    const pdfText = await extractPdfText(buffer, file.name)

    if (!pdfText.trim()) {
      return NextResponse.json({ error: 'PDF에서 텍스트를 추출할 수 없습니다.' }, { status: 422 })
    }

    const title = file.name.replace(/\.pdf$/i, '')

    let category = userCategory || ''
    if (!category) {
      const classified = await classifyCategory(pdfText)
      category = classified.category
    }

    const [summary, reportSummary] = await Promise.all([
      generateSummary(category as any, pdfText),
      generateReportSummary(category as any, title, pdfText).catch(() => ''),
    ])

    const sessionId = randomUUID()
    const result = {
      sessionId,
      videoId: '',
      sourceType: 'pdf',
      title,
      channel: 'PDF 문서',
      thumbnail: '',
      duration: 0,
      category,
      summary,
      transcript: pdfText.slice(0, 3000),
      transcriptSource: 'pdf',
      videoPublishedAt: '',
      summarizedAt: new Date().toISOString(),
      reportSummary: reportSummary || '',
    }

    // Firestore에 저장
    try {
      const fields = toFirestoreFields(result as unknown as Record<string, unknown>)
      const url = `${FIRESTORE_BASE}/summaries/${sessionId}?key=${API_KEY}`
      await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields }),
      })
    } catch (e) {
      console.warn('[PDF] Firestore save failed:', e)
    }

    return NextResponse.json(result)
  } catch (e) {
    console.error('PDF summarize error:', e)
    return NextResponse.json({ error: 'PDF 처리 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
