import { NextRequest, NextResponse } from 'next/server'
import { generateContextSummary } from '@/lib/claude'
import { randomUUID } from 'crypto'
import { GoogleGenerativeAI } from '@google/generative-ai'

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
const SUPPORTED_AUDIO = [
  'audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/mp3',
  'audio/wav', 'audio/ogg', 'audio/flac', 'audio/aac',
  'audio/x-m4a', 'audio/m4a',
]

// ── 썸네일 색상 맵 ─────────────────────────────────────────────────────────────
const COLOR_GRADIENTS: Record<string, [string, string]> = {
  blue:   ['#1e3a8a', '#3b82f6'],
  green:  ['#14532d', '#22c55e'],
  orange: ['#7c2d12', '#f97316'],
  purple: ['#3b0764', '#a855f7'],
  pink:   ['#831843', '#ec4899'],
  teal:   ['#134e4a', '#14b8a6'],
  amber:  ['#78350f', '#f59e0b'],
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: '파일이 없습니다.' }, { status: 400 })

    // MIME 타입 검증
    const mimeType = file.type || 'audio/webm'
    const isAudio = SUPPORTED_AUDIO.some(t => mimeType.startsWith(t.split('/')[0]) && mimeType.includes(t.split('/')[1]))
    if (!mimeType.startsWith('audio/')) {
      return NextResponse.json({ error: '오디오 파일만 지원합니다.' }, { status: 400 })
    }

    // 파일 크기 제한 (20MB)
    if (file.size > 20 * 1024 * 1024) {
      return NextResponse.json({ error: '20MB 이하 파일만 지원합니다.' }, { status: 400 })
    }

    const buffer = await file.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')

    // ── Gemini: 전사 + 구조화 요약 한 번에 ────────────────────────────────────
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: { responseMimeType: 'application/json' },
    })

    const prompt = `당신은 음성 녹음 분석 전문가입니다. 주어진 오디오 파일을 분석하여 아래 JSON 형식으로 정확히 응답하세요.

반환 형식 (JSON만, 설명 없이):
{
  "title": "녹음 내용을 잘 표현하는 제목 (20자 이내)",
  "main_topic": "핵심 주제를 한 문장으로 요약",
  "duration_estimate": "약 N분" 또는 "약 N초",
  "key_points": [
    { "point": "핵심 포인트 제목", "detail": "부가 설명 (선택)" }
  ],
  "action_items": ["실행 가능한 항목 1", "실행 가능한 항목 2"],
  "transcript": "전체 녹음 내용을 텍스트로 전사 (최대한 정확하게)",
  "emoji": "내용과 가장 잘 어울리는 이모지 1개",
  "color_theme": "blue | green | orange | purple | pink | teal | amber 중 내용 분위기에 맞는 것",
  "square_meta": {
    "tags": ["관련 키워드 최대 5개"],
    "topic_cluster": "주제 카테고리",
    "vibe": "분위기/톤 한 단어"
  }
}

음성이 없거나 알아들을 수 없으면 transcript에 "(음성 인식 불가)"라고 적으세요.
action_items가 없으면 빈 배열 []로 두세요.`

    const result = await model.generateContent([
      { inlineData: { mimeType, data: base64 } },
      prompt,
    ])

    const raw = result.response.text().trim()
    let parsed: any
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/)
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw)
    } catch {
      return NextResponse.json({ error: '요약 파싱 실패. 다시 시도해주세요.' }, { status: 500 })
    }

    // ── 썸네일 SVG 생성 ────────────────────────────────────────────────────────
    const theme = parsed.color_theme || 'purple'
    const [c1, c2] = COLOR_GRADIENTS[theme] ?? COLOR_GRADIENTS.purple
    const emoji = parsed.emoji || '🎙'
    const titleShort = (parsed.title || '녹음 메모').slice(0, 24)

    const svgThumbnail = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg width="480" height="270" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${c1}"/>
      <stop offset="100%" style="stop-color:${c2}"/>
    </linearGradient>
  </defs>
  <rect width="480" height="270" fill="url(#g)" rx="12"/>
  <rect width="480" height="270" fill="rgba(0,0,0,0.15)" rx="12"/>
  <text x="240" y="110" font-size="72" text-anchor="middle" dominant-baseline="middle">${emoji}</text>
  <text x="240" y="175" font-size="22" font-weight="bold" fill="white" text-anchor="middle" font-family="system-ui,sans-serif">${titleShort}</text>
  <text x="240" y="210" font-size="14" fill="rgba(255,255,255,0.6)" text-anchor="middle" font-family="system-ui,sans-serif">🎙 음성 녹음 메모</text>
</svg>`)}`

    // ── sessionId 생성 및 Firestore 저장 ──────────────────────────────────────
    const sessionId = randomUUID()
    const now = new Date().toISOString()

    const summary = {
      title: parsed.title || '녹음 메모',
      main_topic: parsed.main_topic || '',
      duration_estimate: parsed.duration_estimate || '',
      key_points: parsed.key_points || [],
      action_items: parsed.action_items || [],
      transcript: parsed.transcript || '',
      emoji,
      color_theme: theme,
      square_meta: parsed.square_meta || { tags: [], topic_cluster: '녹음', vibe: '기록' },
    }

    // contextSummary 생성
    const contextSummary = await generateContextSummary(
      summary.title, 'voice' as any, summary as any
    ).catch(() => summary.main_topic)

    const responseData = {
      sessionId,
      videoId: '',          // 유튜브 없음
      title: summary.title,
      channel: '녹음 메모',
      thumbnail: svgThumbnail,
      duration: 0,
      category: 'voice',
      summary,
      contextSummary,
      transcript: summary.transcript,
      transcriptSource: 'voice',
      summarizedAt: now,
      sourceType: 'voice',
    }

    // Firestore에 저장
    await fetch(`${FIRESTORE_BASE}/summaries/${sessionId}?key=${API_KEY}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: objToFields(responseData as any) }),
    })

    return NextResponse.json(responseData)
  } catch (e) {
    console.error('Voice summarize error:', e)
    return NextResponse.json({ error: '처리 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
