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

    // 카테고리별 짧은 설명 추출
    let description = `${channel} · Next Curator 요약`
    const summaryFields = fields.summary?.mapValue?.fields
    if (summaryFields) {
      // 공통: overview, one_line_summary, essence 등 짧은 텍스트 필드 탐색
      const shortField = summaryFields.one_line_summary
        ?? summaryFields.overview
        ?? summaryFields.essence
        ?? summaryFields.theme
      if (shortField?.stringValue) {
        description = shortField.stringValue.slice(0, 120)
      }
    }

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
      images: og.thumbnail
        ? [{ url: og.thumbnail, width: 1280, height: 720, alt: og.title }]
        : [],
      type: 'article',
      siteName: 'Next Curator',
    },
    twitter: {
      card: 'summary_large_image',
      title: og.title,
      description: og.description,
      images: og.thumbnail ? [og.thumbnail] : [],
    },
  }
}

export default async function ResultPage(
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params
  return <ResultClient sessionId={sessionId} />
}
