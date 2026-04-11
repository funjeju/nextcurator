import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY!)
const embeddingModel = genAI.getGenerativeModel({ model: 'text-embedding-004' })

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!
const API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY!
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`

/** 카테고리별 핵심 텍스트 추출 → 임베딩 입력용 */
function extractEmbedText(title: string, category: string, summary: unknown): string {
  const parts = [title, category]
  if (summary && typeof summary === 'object') {
    const s = summary as Record<string, any>
    // square_meta 태그/클러스터/분위기
    if (s.square_meta?.tags)          parts.push(s.square_meta.tags.join(' '))
    if (s.square_meta?.topic_cluster) parts.push(s.square_meta.topic_cluster)
    if (s.square_meta?.vibe)          parts.push(s.square_meta.vibe)
    // 공통 패턴
    if (Array.isArray(s.key_tips))    parts.push(s.key_tips.slice(0, 3).join('. '))
    if (Array.isArray(s.key_points))  parts.push(s.key_points.slice(0, 3).map((k: any) => k.point).join('. '))
    if (Array.isArray(s.insights))    parts.push(s.insights.slice(0, 3).map((i: any) => i.point).join('. '))
    if (Array.isArray(s.tips))        parts.push(s.tips.slice(0, 3).map((t: any) => `${t.title} ${t.desc}`).join('. '))
    if (Array.isArray(s.concepts))    parts.push(s.concepts.slice(0, 3).map((c: any) => `${c.name} ${c.desc}`).join('. '))
    if (Array.isArray(s.expressions)) parts.push(s.expressions.slice(0, 3).map((e: any) => e.text).join('. '))
    // 카테고리별 특수 필드
    if (s.core_message?.text)  parts.push(s.core_message.text)
    if (s.headline)            parts.push(s.headline)
    if (s.three_line_summary)  parts.push(s.three_line_summary)
    if (s.dish_name)           parts.push(s.dish_name)
    if (s.destination)         parts.push(s.destination)
    if (s.topic)               parts.push(s.topic)
    if (s.key_message)         parts.push(s.key_message)
    if (Array.isArray(s.checklist)) parts.push(s.checklist.slice(0, 3).join('. '))
  }
  return parts.filter(Boolean).join(' ').slice(0, 1500)
}

export async function POST(req: NextRequest) {
  try {
    const { docId, title, category, summary, contextSummary } = await req.json() as {
      docId: string
      title: string
      category: string
      summary: unknown
      contextSummary?: string
    }
    if (!docId) return NextResponse.json({ error: 'docId required' }, { status: 400 })

    // contextSummary가 있으면 우선 사용, 없으면 기존 필드 추출로 폴백
    const text = contextSummary?.trim()
      ? `${title} ${contextSummary}`
      : extractEmbedText(title || '', category || '', summary)
    if (!text.trim()) return NextResponse.json({ ok: true, skipped: true })

    // Gemini text-embedding-004 호출
    const result = await embeddingModel.embedContent(text)
    const vector = result.embedding.values  // number[] (768 dims)

    // Firestore saved_summaries/{docId} 에 embedding 필드 업데이트
    const url = `${FIRESTORE_BASE}/saved_summaries/${docId}?updateMask.fieldPaths=embedding&key=${API_KEY}`
    const patchRes = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: {
          embedding: {
            arrayValue: {
              values: vector.map(v => ({ doubleValue: v }))
            }
          }
        }
      }),
    })

    if (!patchRes.ok) {
      const err = await patchRes.text()
      console.error('[Embed] Firestore PATCH failed:', err)
      return NextResponse.json({ error: 'Firestore update failed' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, dims: vector.length })
  } catch (e) {
    console.error('[Embed API] error:', e)
    return NextResponse.json({ error: '임베딩 생성 실패' }, { status: 500 })
  }
}
