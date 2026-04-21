import { NextRequest, NextResponse } from 'next/server'
import { classifyCategory, generateSummary, generateContextSummary } from '@/lib/claude'
import { randomUUID } from 'crypto'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { buildContentThumbnail } from '@/lib/thumbnail'

export const maxDuration = 120

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY!)

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!
const API_KEY    = process.env.NEXT_PUBLIC_FIREBASE_API_KEY!
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`

// ── Firestore REST helper ──────────────────────────────────────────────────────
function toFV(v: unknown): unknown {
  if (v === null || v === undefined) return { nullValue: null }
  if (typeof v === 'string')  return { stringValue: v }
  if (typeof v === 'number')  return { integerValue: String(v) }
  if (typeof v === 'boolean') return { booleanValue: v }
  if (Array.isArray(v))       return { arrayValue: { values: v.map(toFV) } }
  if (typeof v === 'object') {
    const fields: Record<string, unknown> = {}
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      fields[k] = toFV(val)
    }
    return { mapValue: { fields } }
  }
  return { stringValue: String(v) }
}

function objToFields(obj: Record<string, unknown>) {
  const fields: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) fields[k] = toFV(v)
  return fields
}

// ── 지원 MIME 타입 ─────────────────────────────────────────────────────────────
const SUPPORTED_AUDIO_PREFIXES = ['audio/']

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: '파일이 없습니다.' }, { status: 400 })

    const mimeType = file.type || 'audio/webm'
    if (!SUPPORTED_AUDIO_PREFIXES.some(p => mimeType.startsWith(p))) {
      return NextResponse.json({ error: '오디오 파일만 지원합니다.' }, { status: 400 })
    }
    // TODO: 요금제 차등화 — 무료: 20MB, 유료Pro: 100MB, 어드민: 무제한
    const idToken = req.headers.get('Authorization')?.replace('Bearer ', '')
    const isAdmin = idToken ? await import('@/lib/admin').then(m => m.checkIsAdminByToken(idToken)) : false
    if (!isAdmin && file.size > 20 * 1024 * 1024) {
      return NextResponse.json({ error: '20MB 이하 파일만 지원합니다.' }, { status: 400 })
    }

    const buffer = await file.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')

    // ── Step 1: Gemini로 전사 + 제목 추출 ─────────────────────────────────────
    const gemini = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: { responseMimeType: 'application/json', temperature: 0 },
    })

    const transcribeResult = await gemini.generateContent([
      { inlineData: { mimeType, data: base64 } },
      `이 오디오를 분석하세요. JSON으로만 응답하세요 (설명 없음):
{
  "title": "녹음 내용을 잘 표현하는 제목 (한국어, 20자 이내)",
  "transcript": "전체 녹음 내용을 텍스트로 전사. 알아들을 수 없으면 빈 문자열."
}`,
    ])

    let transcribed: { title: string; transcript: string }
    try {
      const raw = transcribeResult.response.text().trim()
      const match = raw.match(/\{[\s\S]*\}/)
      transcribed = JSON.parse(match ? match[0] : raw)
    } catch {
      return NextResponse.json({ error: '음성 인식에 실패했습니다. 다시 시도해주세요.' }, { status: 500 })
    }

    const { title: rawTitle, transcript } = transcribed

    if (!transcript || transcript.length < 20) {
      return NextResponse.json({ error: '음성을 인식할 수 없습니다. 더 선명하게 녹음해주세요.' }, { status: 422 })
    }

    const title = rawTitle || '음성 녹음 메모'

    // ── Step 2: 카테고리 자동 분류 ────────────────────────────────────────────
    const classified = await classifyCategory(transcript)
    const category = classified.category

    // ── Step 3: 카테고리별 요약 생성 ──────────────────────────────────────────
    const [summary, contextSummary] = await Promise.all([
      generateSummary(category as any, transcript, 'voice' as any),
      generateContextSummary(title, category as any, {} as any).catch(() => ''),
    ])

    // contextSummary를 transcript 기반으로 재생성 (summary 완성 후)
    const finalContextSummary = await generateContextSummary(title, category as any, summary).catch(() => contextSummary)

    // ── Step 4: 썸네일 SVG 생성 ───────────────────────────────────────────────
    const thumbnail = buildContentThumbnail(category, title, 'voice')

    // ── Step 5: sessionId 생성 및 Firestore 저장 ──────────────────────────────
    const sessionId = randomUUID()
    const now = new Date().toISOString()

    const responseData = {
      sessionId,
      videoId: '',
      title,
      channel: '음성 녹음',
      thumbnail,
      duration: 0,
      category,
      summary,
      contextSummary: finalContextSummary,
      transcript,
      transcriptSource: 'voice',
      summarizedAt: now,
      sourceType: 'voice',
    }

    await fetch(`${FIRESTORE_BASE}/summaries/${sessionId}?key=${API_KEY}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: objToFields(responseData as any) }),
    }).catch(() => {})

    return NextResponse.json(responseData)
  } catch (e) {
    console.error('Voice summarize error:', e)
    return NextResponse.json({ error: '처리 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
