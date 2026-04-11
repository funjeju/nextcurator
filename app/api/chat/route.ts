import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY!)

const embeddingModel = genAI.getGenerativeModel({ model: 'text-embedding-004' })


const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!
const API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY!
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`

// ── Firestore REST 파싱 헬퍼 ──────────────────────────
function fromFirestoreFields(fields: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(fields)) {
    out[k] = fromFirestoreValue(v as Record<string, unknown>)
  }
  return out
}
function fromFirestoreValue(v: Record<string, unknown>): unknown {
  if ('stringValue'  in v) return v.stringValue
  if ('integerValue' in v) return Number(v.integerValue)
  if ('doubleValue'  in v) return Number(v.doubleValue)
  if ('booleanValue' in v) return v.booleanValue
  if ('nullValue'    in v) return null
  if ('arrayValue'   in v) {
    const arr = v.arrayValue as { values?: unknown[] }
    return (arr.values ?? []).map(i => fromFirestoreValue(i as Record<string, unknown>))
  }
  if ('mapValue' in v) {
    const map = v.mapValue as { fields?: Record<string, unknown> }
    return map.fields ? fromFirestoreFields(map.fields) : {}
  }
  return null
}

interface SummaryDoc {
  id: string
  sessionId: string
  title: string
  category: string
  channel?: string
  thumbnail?: string
  tags: string[]
  summary?: unknown
  embedding?: number[]
}

/** Firestore에서 saved_summaries 조회 (userId 또는 isPublic 필터) */
async function fetchSummaries(filter: { userId?: string; isPublic?: boolean }): Promise<SummaryDoc[]> {
  const url = `${FIRESTORE_BASE}:runQuery?key=${API_KEY}`

  const whereClause = filter.userId
    ? { fieldFilter: { field: { fieldPath: 'userId' }, op: 'EQUAL', value: { stringValue: filter.userId } } }
    : { fieldFilter: { field: { fieldPath: 'isPublic' }, op: 'EQUAL', value: { booleanValue: true } } }

  const body = {
    structuredQuery: {
      from: [{ collectionId: 'saved_summaries' }],
      where: whereClause,
      limit: 500,
    },
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) return []

  const results = await res.json()
  return (results as any[])
    .filter(r => r.document?.fields)
    .map(r => {
      const docId = (r.document.name as string).split('/').pop()!
      const d = fromFirestoreFields(r.document.fields) as Record<string, any>
      return {
        id: docId,
        sessionId: d.sessionId ?? '',
        title: d.title ?? '',
        category: d.category ?? '',
        channel: d.channel,
        thumbnail: d.thumbnail,
        tags: (d.square_meta as any)?.tags ?? [],
        summary: d.summary,
        embedding: Array.isArray(d.embedding) ? d.embedding as number[] : undefined,
      } satisfies SummaryDoc
    })
}

/** 코사인 유사도 (0~1) */
function cosineSim(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1)
}

/** 키워드 매칭 점수 (임베딩 없는 구 데이터용) */
function keywordScore(query: string, title: string, tags: string[]): number {
  const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 1)
  const text = `${title} ${tags.join(' ')}`.toLowerCase()
  return words.filter(w => text.includes(w)).length
}

const CATEGORY_LABEL: Record<string, string> = {
  recipe: '요리', english: '영어', learning: '학습', news: '뉴스',
  selfdev: '자기계발', travel: '여행', story: '스토리', tips: '팁',
}

interface ChatMessage { role: 'user' | 'model'; content: string }

export async function POST(req: NextRequest) {
  try {
    const { messages, userId, source }: {
      messages: ChatMessage[]
      userId?: string
      source: 'mypage' | 'square'
    } = await req.json()

    if (!messages?.length) {
      return NextResponse.json({ error: '메시지가 필요합니다.' }, { status: 400 })
    }

    const query = messages[messages.length - 1].content
    const contextLabel = source === 'mypage' ? '사용자의 저장된 콘텐츠' : '스퀘어 공개 콘텐츠'

    // ── 1. Firestore에서 콘텐츠 목록 조회 ──────────────
    let allSummaries: SummaryDoc[] = []
    try {
      allSummaries = await fetchSummaries(
        source === 'mypage' && userId ? { userId } : { isPublic: true }
      )
    } catch (e) {
      console.warn('[Chat] Firestore fetch failed:', e)
      // Firestore 실패해도 Gemini는 빈 컨텍스트로 진행
    }

    // ── 2. 벡터 검색 (임베딩 있는 것) + 키워드 매칭 (없는 것) ──
    const withEmbed    = allSummaries.filter(s => s.embedding?.length)
    const withoutEmbed = allSummaries.filter(s => !s.embedding?.length)

    let vectorTop: SummaryDoc[] = []
    if (withEmbed.length > 0) {
      try {
        const qResult = await embeddingModel.embedContent(query)
        const qVec = qResult.embedding.values
        vectorTop = withEmbed
          .map(s => ({ s, score: cosineSim(qVec, s.embedding!) }))
          .sort((a, b) => b.score - a.score)
          .slice(0, 5)
          .map(x => x.s)
      } catch (e) {
        console.warn('[Chat] query embedding failed:', e)
      }
    }

    const keywordTop = withoutEmbed
      .map(s => ({ s, score: keywordScore(query, s.title, s.tags) }))
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(x => x.s)

    // 중복 제거 후 최대 10개
    const seen = new Set(vectorTop.map(s => s.id))
    const combined = [...vectorTop]
    for (const s of keywordTop) {
      if (!seen.has(s.id)) { combined.push(s); seen.add(s.id) }
    }
    const topSummaries = combined.slice(0, 10)

    // ── 3. 컨텍스트 빌드 → Gemini 호출 ──────────────────
    const contextList = topSummaries.map((s, i) => {
      const cat = CATEGORY_LABEL[s.category] ?? s.category
      const tagStr = s.tags.slice(0, 3).join(', ')
      const snippet = s.summary ? JSON.stringify(s.summary).slice(0, 200) : ''
      return [
        `[${i + 1}] ID:${s.id} [${cat}] "${s.title}"${s.channel ? ` (${s.channel})` : ''}`,
        tagStr ? `#${tagStr}` : '',
        snippet,
      ].filter(Boolean).join(' ')
    }).join('\n')

    const systemInstruction = contextList
      ? `당신은 NextCurator의 AI 어시스턴트입니다.
현재 컨텍스트: ${contextLabel} (전체 ${allSummaries.length}개 중 관련 ${topSummaries.length}개 선별)

---관련 콘텐츠---
${contextList}
---

답변 규칙:
- 한국어로 친근하게 2~4문장으로 답변하세요.
- 관련 콘텐츠를 추천할 때 응답 맨 끝에 "[RELATED:id1,id2]" 형식으로 ID를 붙이세요.
- 목록에 없는 내용은 "저장된 콘텐츠에서 찾지 못했어요"라고 솔직하게 말하세요.
- [RELATED:...] 태그는 사용자에게 보이지 않으므로 반드시 마지막에 단독으로 붙이세요.`
      : `당신은 NextCurator AI 어시스턴트입니다. 관련 콘텐츠를 찾지 못했습니다. 한국어로 친근하게 안내해주세요.`

    // systemInstruction을 모델 생성 시점에 설정 (SDK가 Content 객체로 올바르게 포매팅)
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction,
      generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
    })

    const history = messages.slice(0, -1).map(m => ({
      role: m.role as 'user' | 'model',
      parts: [{ text: m.content }],
    }))

    const chat = model.startChat({ history })
    const result = await chat.sendMessage(query)
    const rawText = result.response.text()

    let relatedIds: string[] = []
    const relatedMatch = rawText.match(/\[RELATED:([^\]]+)\]/)
    if (relatedMatch) {
      relatedIds = relatedMatch[1].split(',').map(id => id.trim()).filter(Boolean)
    }
    const text = rawText.replace(/\[RELATED:[^\]]*\]/g, '').trim()

    return NextResponse.json({ text, relatedIds })
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e)
    console.error('[Chat API] error:', errMsg)
    return NextResponse.json({ error: '오류가 발생했습니다.', detail: errMsg }, { status: 500 })
  }
}
