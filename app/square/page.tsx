// 서버 컴포넌트 — 크롤러/봇이 받는 HTML에 실제 콘텐츠를 포함시킴
import { SavedSummary } from '@/lib/db'
import { getPublishedPosts } from '@/lib/magazine'
import SquareClient from './SquareClient'

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!
const API_KEY    = process.env.NEXT_PUBLIC_FIREBASE_API_KEY!
const BASE       = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`

type FSField = {
  stringValue?: string; integerValue?: string; booleanValue?: boolean
  nullValue?: null; doubleValue?: number; timestampValue?: string
  arrayValue?: { values?: FSField[] }
  mapValue?: { fields?: Record<string, FSField> }
}

function fromFV(v: FSField): unknown {
  if ('stringValue'    in v) return v.stringValue
  if ('integerValue'   in v) return Number(v.integerValue)
  if ('doubleValue'    in v) return v.doubleValue
  if ('booleanValue'   in v) return v.booleanValue
  if ('nullValue'      in v) return null
  // Firestore Timestamp → 밀리초 숫자로 직렬화 (클라이언트로 넘길 수 있음)
  if ('timestampValue' in v) return v.timestampValue ? new Date(v.timestampValue).getTime() : 0
  if ('arrayValue'     in v) return (v.arrayValue?.values ?? []).map(fromFV)
  if ('mapValue'       in v) {
    const out: Record<string, unknown> = {}
    for (const [k, val] of Object.entries(v.mapValue?.fields ?? {})) out[k] = fromFV(val)
    return out
  }
  return null
}

async function fetchPublicSummariesServer(): Promise<SavedSummary[]> {
  try {
    const res = await fetch(`${BASE}:runQuery?key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: 'saved_summaries' }],
          where: {
            fieldFilter: {
              field: { fieldPath: 'isPublic' },
              op: 'EQUAL',
              value: { booleanValue: true },
            },
          },
          orderBy: [{ field: { fieldPath: 'createdAt' }, direction: 'DESCENDING' }],
          limit: 300,
        },
      }),
      // 5분 캐싱: 크롤러엔 충분한 freshness, 사용자는 클라이언트 재갱신으로 보완
      next: { revalidate: 300 },
    })

    if (!res.ok) return []

    const docs = await res.json() as {
      document?: { name?: string; fields?: Record<string, FSField> }
    }[]

    return docs
      .filter(d => d.document?.fields)
      .map(d => {
        const out: Record<string, unknown> = {}
        for (const [k, v] of Object.entries(d.document!.fields!)) {
          out[k] = fromFV(v)
        }
        out.id = d.document!.name!.split('/').pop()!
        return out as unknown as SavedSummary
      })
  } catch {
    return []
  }
}

export default async function SquarePage() {
  const [initialSummaries, initialMagazinePosts] = await Promise.all([
    fetchPublicSummariesServer(),
    getPublishedPosts(50),
  ])

  return (
    <SquareClient
      initialSummaries={initialSummaries}
      initialMagazinePosts={initialMagazinePosts}
    />
  )
}
