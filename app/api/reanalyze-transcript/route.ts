import { NextRequest, NextResponse } from 'next/server'
import { generateSummary, generateContextSummary } from '@/lib/claude'
import { randomUUID } from 'crypto'

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!
const API_KEY    = process.env.NEXT_PUBLIC_FIREBASE_API_KEY!
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`

function toFV(v: unknown): unknown {
  if (v === null || v === undefined) return { nullValue: null }
  if (typeof v === 'string')  return { stringValue: v }
  if (typeof v === 'number')  return { integerValue: String(v) }
  if (typeof v === 'boolean') return { booleanValue: v }
  if (Array.isArray(v))       return { arrayValue: { values: v.map(toFV) } }
  if (typeof v === 'object') {
    const fields: Record<string, unknown> = {}
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) fields[k] = toFV(val)
    return { mapValue: { fields } }
  }
  return { stringValue: String(v) }
}
function objToFields(obj: Record<string, unknown>) {
  const f: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) f[k] = toFV(v)
  return f
}

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

function buildThumbnail(category: string, title: string, sourceType: string): string {
  const [c1, c2] = CATEGORY_GRADIENTS[category] ?? ['#27272a', '#52525b']
  const catEmoji = CATEGORY_ICONS[category] ?? '✨'
  const sourceEmoji = sourceType === 'voice' ? '🎙' : '📄'
  const sourceLabel = sourceType === 'voice' ? '음성 녹음' : 'PDF 문서'
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
  <text x="330" y="118" font-size="42" text-anchor="middle" dominant-baseline="middle" opacity="0.75">${sourceEmoji}</text>
  <text x="240" y="185" font-size="20" font-weight="bold" fill="white" text-anchor="middle" font-family="system-ui,sans-serif">${safe}</text>
  <text x="240" y="215" font-size="13" fill="rgba(255,255,255,0.55)" text-anchor="middle" font-family="system-ui,sans-serif">${sourceEmoji} ${sourceLabel}</text>
</svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

export async function POST(req: NextRequest) {
  try {
    const { transcript, title, category, sourceType, noSave } = await req.json()

    if (!transcript || !category) {
      return NextResponse.json({ error: '필수 파라미터가 없습니다.' }, { status: 400 })
    }

    const [summary, contextSummary] = await Promise.all([
      generateSummary(category as any, transcript, sourceType as any),
      generateContextSummary(title || '문서', category as any, {} as any).catch(() => ''),
    ])
    const finalContext = await generateContextSummary(title || '문서', category as any, summary).catch(() => contextSummary)

    const sessionId = randomUUID()
    const thumbnail = buildThumbnail(category, title || '문서', sourceType || 'pdf')

    const responseData = {
      sessionId,
      videoId: '',
      title: title || '문서',
      channel: sourceType === 'voice' ? '음성 녹음' : 'PDF 문서',
      thumbnail,
      duration: 0,
      category,
      summary,
      contextSummary: finalContext,
      transcript,
      transcriptSource: sourceType === 'voice' ? 'voice' : 'pdf',
      summarizedAt: new Date().toISOString(),
      sourceType: sourceType || 'pdf',
    }

    if (!noSave) {
      await fetch(`${FIRESTORE_BASE}/summaries/${sessionId}?key=${API_KEY}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: objToFields(responseData as any) }),
      }).catch(() => {})
    }

    return NextResponse.json(responseData)
  } catch (e) {
    console.error('[reanalyze-transcript]', e)
    return NextResponse.json({ error: '재분석 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
