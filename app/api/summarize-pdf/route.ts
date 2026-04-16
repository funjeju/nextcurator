import { NextRequest, NextResponse } from 'next/server'
import { classifyCategory, generateSummary, generateReportSummary, generateContextSummary } from '@/lib/claude'
import { randomUUID } from 'crypto'
import { GoogleGenerativeAI } from '@google/generative-ai'

// ── 카테고리별 썸네일 팔레트 ────────────────────────────────────────────────────
const CATEGORY_GRADIENTS: Record<string, [string, string]> = {
  recipe:   ['#7c2d12', '#f97316'],
  english:  ['#1e3a8a', '#3b82f6'],
  learning: ['#3b0764', '#a855f7'],
  news:     ['#27272a', '#71717a'],
  selfdev:  ['#14532d', '#22c55e'],
  travel:   ['#164e63', '#06b6d4'],
  story:    ['#831843', '#ec4899'],
  tips:     ['#78350f', '#f59e0b'],
  report:   ['#1e1b4b', '#6366f1'],
}

const CATEGORY_ICONS: Record<string, string> = {
  recipe: '🍳', english: '🔤', learning: '📐', news: '🗞️',
  selfdev: '💪', travel: '🧳', story: '🍿', tips: '💡', report: '📋',
}

function buildPdfThumbnail(category: string, title: string): string {
  const [c1, c2] = CATEGORY_GRADIENTS[category] ?? ['#1e1b4b', '#6366f1']
  const catEmoji = CATEGORY_ICONS[category] ?? '📋'
  const safe = title.slice(0, 22).replace(/[<>&"']/g,
    c => c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '&' ? '&amp;' : c === '"' ? '&quot;' : '&apos;')

  const svg = `<svg width="480" height="270" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${c1}"/>
      <stop offset="100%" style="stop-color:${c2}"/>
    </linearGradient>
  </defs>
  <rect width="480" height="270" fill="url(#g)" rx="12"/>
  <rect width="480" height="270" fill="rgba(0,0,0,0.18)" rx="12"/>
  <text x="190" y="118" font-size="64" text-anchor="middle" dominant-baseline="middle">${catEmoji}</text>
  <text x="330" y="118" font-size="42" text-anchor="middle" dominant-baseline="middle" opacity="0.75">📄</text>
  <text x="240" y="185" font-size="20" font-weight="bold" fill="white" text-anchor="middle" font-family="system-ui,sans-serif">${safe}</text>
  <text x="240" y="215" font-size="13" fill="rgba(255,255,255,0.55)" text-anchor="middle" font-family="system-ui,sans-serif">📄 PDF 문서</text>
</svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY!)

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

/**
 * Gemini에 PDF를 직접 전달해 텍스트 추출
 * - 텍스트 기반 PDF, 이미지/스캔 PDF 모두 처리
 * - 별도 OCR 서비스 불필요
 */
async function extractPdfWithGemini(buffer: ArrayBuffer): Promise<string> {
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: { temperature: 0, maxOutputTokens: 8192 },
  })

  const base64 = Buffer.from(buffer).toString('base64')

  const result = await model.generateContent([
    {
      inlineData: {
        mimeType: 'application/pdf',
        data: base64,
      },
    },
    `이 PDF의 모든 텍스트 내용을 그대로 추출해주세요.
페이지 순서대로 빠짐없이 추출하고, 표나 목록 구조도 가능한 유지해주세요.
마크다운 형식이나 설명 없이 내용만 출력하세요.`,
  ])

  const text = result.response.text().trim()
  if (!text || text.length < 50) throw new Error('PDF_EMPTY_CONTENT')
  return text
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
    if (file.size > 20 * 1024 * 1024) {
      return NextResponse.json({ error: 'PDF 파일은 20MB 이하만 가능합니다.' }, { status: 400 })
    }

    const buffer = await file.arrayBuffer()

    let pdfText: string
    try {
      pdfText = await extractPdfWithGemini(buffer)
    } catch (e) {
      console.error('[PDF] Gemini extraction failed:', e)
      return NextResponse.json({ error: 'PDF 내용을 읽을 수 없습니다. 손상된 파일이거나 보안이 설정된 PDF일 수 있습니다.' }, { status: 422 })
    }

    const title = file.name.replace(/\.pdf$/i, '')

    let category = userCategory || ''
    if (!category) {
      const classified = await classifyCategory(pdfText)
      category = classified.category
    }

    const [summary, reportSummary] = await Promise.all([
      generateSummary(category as any, pdfText, 'pdf'),
      generateReportSummary(category as any, title, pdfText).catch(() => ''),
    ])
    const contextSummary = await generateContextSummary(title, category as any, summary).catch(() => '')

    const sessionId = randomUUID()
    const thumbnail = buildPdfThumbnail(category, title)
    const result = {
      sessionId,
      videoId: '',
      sourceType: 'pdf',
      title,
      channel: 'PDF 문서',
      thumbnail,
      duration: 0,
      category,
      summary,
      contextSummary,
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
