import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY!)
const embeddingModel = genAI.getGenerativeModel({ model: 'text-embedding-004' })

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!
const API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY!
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`

// ── Firestore REST 파싱 (벡터 검색용) ────────────────
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

/** 임베딩 벡터만 Firestore에서 가져오기 (벡터 검색 보완용) */
async function fetchEmbeddings(
  filter: { userId?: string; isPublic?: boolean }
): Promise<Map<string, number[]>> {
  const map = new Map<string, number[]>()
  try {
    const url = `${FIRESTORE_BASE}:runQuery?key=${API_KEY}`
    const whereClause = filter.userId
      ? { fieldFilter: { field: { fieldPath: 'userId' }, op: 'EQUAL', value: { stringValue: filter.userId } } }
      : { fieldFilter: { field: { fieldPath: 'isPublic' }, op: 'EQUAL', value: { booleanValue: true } } }

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: 'saved_summaries' }],
          where: whereClause,
          limit: 500,
        },
      }),
    })
    if (!res.ok) return map

    const results = await res.json()
    for (const r of results as any[]) {
      if (!r.document?.fields) continue
      const docId = (r.document.name as string).split('/').pop()!
      const d = fromFirestoreFields(r.document.fields) as Record<string, any>
      if (Array.isArray(d.embedding) && d.embedding.length > 0) {
        map.set(docId, d.embedding as number[])
      }
    }
  } catch (e) {
    console.warn('[Chat] fetchEmbeddings failed:', e)
  }
  return map
}

// ── 유사도 / 키워드 헬퍼 ──────────────────────────────
function cosineSim(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1)
}

const CATEGORY_LABEL: Record<string, string> = {
  recipe: '요리', english: '영어', learning: '학습', news: '뉴스',
  selfdev: '자기계발', travel: '여행', story: '스토리', tips: '팁',
}

function keywordScore(query: string, title: string, tags: string[], category: string, shortText = ''): number {
  const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 1)
  const catLabel = CATEGORY_LABEL[category] ?? category
  const text = `${title} ${tags.join(' ')} ${catLabel} ${shortText}`.toLowerCase()
  return words.filter(w => text.includes(w)).length
}

interface SummaryMeta {
  id: string
  sessionId: string
  title: string
  category: string
  tags: string[]
  shortText?: string  // 카테고리별 핵심 내용 200자
}

interface ChatMessage { role: 'user' | 'model'; content: string }

export async function POST(req: NextRequest) {
  try {
    const { messages, userId, source, summaryMeta }: {
      messages: ChatMessage[]
      userId?: string
      source: 'mypage' | 'square'
      summaryMeta: SummaryMeta[]   // 클라이언트가 보낸 경량 인덱스
    } = await req.json()

    if (!messages?.length) {
      return NextResponse.json({ error: '메시지가 필요합니다.' }, { status: 400 })
    }

    const query = messages[messages.length - 1].content
    const contextLabel = source === 'mypage' ? '사용자의 저장된 콘텐츠' : '스퀘어 공개 콘텐츠'
    const meta = summaryMeta ?? []

    // ── 1. 키워드 검색 (클라이언트 데이터 → 100% 신뢰) ──
    const keywordScored = meta
      .map(s => ({ s, score: keywordScore(query, s.title, s.tags, s.category, s.shortText) }))
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score)
    const keywordTop = keywordScored.slice(0, 5).map(x => x.s)
    const keywordIds = new Set(keywordTop.map(s => s.id))

    // ── 2. 벡터 검색 (키워드 미매칭 항목 보완, 서버 Firestore) ──
    let vectorTop: SummaryMeta[] = []
    const remaining = meta.filter(s => !keywordIds.has(s.id))
    if (remaining.length > 0) {
      try {
        const embeddingMap = await fetchEmbeddings(
          source === 'mypage' && userId ? { userId } : { isPublic: true }
        )
        if (embeddingMap.size > 0) {
          const qVec = (await embeddingModel.embedContent(query)).embedding.values
          vectorTop = remaining
            .filter(s => embeddingMap.has(s.id))
            .map(s => ({ s, score: cosineSim(qVec, embeddingMap.get(s.id)!) }))
            .sort((a, b) => b.score - a.score)
            .slice(0, 5)
            .map(x => x.s)
        }
      } catch (e) {
        console.warn('[Chat] vector search failed:', e)
      }
    }

    // ── 3. 키워드 우선 + 벡터 보완, 최대 10개 ──
    const combined = [...keywordTop]
    const seen = new Set(keywordIds)
    for (const s of vectorTop) {
      if (!seen.has(s.id)) { combined.push(s); seen.add(s.id) }
    }
    const topSummaries = combined.slice(0, 10)

    // ── 4. Gemini 호출 ──────────────────────────────────
    const contextList = topSummaries.map((s, i) => {
      const cat = CATEGORY_LABEL[s.category] ?? s.category
      const tagStr = s.tags.slice(0, 3).join(', ')
      return [
        `[${i + 1}] ID:${s.id} [${cat}] "${s.title}"`,
        tagStr ? `태그: ${tagStr}` : '',
        s.shortText ? `내용: ${s.shortText}` : '',
      ].filter(Boolean).join(' | ')
    }).join('\n')

    const systemInstruction = contextList
      ? `당신은 NextCurator의 AI 어시스턴트입니다.
현재 컨텍스트: ${contextLabel} (전체 ${meta.length}개 중 관련 ${topSummaries.length}개 선별)

---관련 콘텐츠---
${contextList}
---

답변 규칙:
- 한국어로 친근하게 2~4문장으로 답변하세요.
- 관련 콘텐츠를 추천할 때 응답 맨 끝에 "[RELATED:id1,id2]" 형식으로 ID를 붙이세요.
- 목록에 없는 내용은 "저장된 콘텐츠에서 찾지 못했어요"라고 솔직하게 말하세요.
- [RELATED:...] 태그는 사용자에게 보이지 않으므로 반드시 마지막에 단독으로 붙이세요.`
      : `당신은 NextCurator AI 어시스턴트입니다. 현재 "${query}"와 관련된 콘텐츠를 찾지 못했습니다. 한국어로 친근하게 안내해주세요.`

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
