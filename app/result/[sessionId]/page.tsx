import { Metadata } from 'next'
import ResultClient from './ResultClient'

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!
const API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY!

interface FirestoreField {
  stringValue?: string
  mapValue?: { fields: Record<string, FirestoreField> }
  arrayValue?: { values?: FirestoreField[] }
}

function getString(field?: FirestoreField): string {
  return field?.stringValue ?? ''
}

/** summaries/{sessionId} 문서에서 OG용 데이터만 서버사이드로 가져오기 */
async function getOgData(sessionId: string) {
  try {
    const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/summaries/${sessionId}?key=${API_KEY}`
    const res = await fetch(url, { next: { revalidate: 3600 } })
    if (!res.ok) return null
    const doc = await res.json()
    if (!doc.fields) return null

    const fields = doc.fields as Record<string, FirestoreField>
    const title = getString(fields.title)
    const thumbnail = getString(fields.thumbnail)
    const channel = getString(fields.channel)
    const category = getString(fields.category)

    const CATEGORY_FEATURED: Record<string, string> = {
      recipe:  '🍳 요리 AI 요약 | 재료 · 단계별 조리법 · 핵심 팁',
      english: '🔤 영어학습 AI 요약 | 핵심 표현 · 단어장 · 학습 포인트',
      learning:'📐 학습 AI 요약 | 핵심 개념 · 포인트 정리 · 예시',
      news:    '🗞️ 뉴스 AI 요약 | 3줄 요약 · 육하원칙 · 시사점',
      selfdev: '💪 자기계발 AI 요약 | 핵심 메시지 · 인사이트 · 실천 체크리스트',
      travel:  '🧳 여행 AI 요약 | 추천 장소 · 동선 · 실용 정보',
      story:   '🍿 스토리 AI 요약 | 인물 · 타임라인 · 핵심 요약',
      tips:    '💡 팁 AI 요약 | 팁 카드 · Top 3 · 준비물 정리',
    }

    const description = `${CATEGORY_FEATURED[category] ?? 'AI 요약'} | ${channel} · Next Curator`

    return { title, thumbnail, channel, category, description }
  } catch {
    return null
  }
}

export async function generateMetadata(
  { params }: { params: Promise<{ sessionId: string }> }
): Promise<Metadata> {
  const { sessionId } = await params
  const og = await getOgData(sessionId)

  if (!og?.title) {
    return {
      title: 'Next Curator',
      description: '가장 스마트한 유튜브 저장소',
    }
  }

  const pageTitle = `${og.title} | Next Curator`

  return {
    title: pageTitle,
    description: og.description,
    openGraph: {
      title: og.title,
      description: og.description,
      // opengraph-image.tsx 가 자동으로 /result/[sessionId]/opengraph-image 경로에 생성됨
      type: 'article',
      siteName: 'Next Curator',
    },
    twitter: {
      card: 'summary_large_image',
      title: og.title,
      description: og.description,
    },
  }
}

export default async function ResultPage(
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params
  return <ResultClient sessionId={sessionId} />
}
