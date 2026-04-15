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
    const videoPublishedAt = getString(fields.videoPublishedAt)

    const CATEGORY_FEATURED: Record<string, string> = {
      recipe:  '요리 AI 요약 | 재료 · 단계별 조리법 · 핵심 팁',
      english: '영어학습 AI 요약 | 핵심 표현 · 단어장 · 학습 포인트',
      learning:'학습 AI 요약 | 핵심 개념 · 포인트 정리 · 예시',
      news:    '뉴스 AI 요약 | 3줄 요약 · 육하원칙 · 시사점',
      selfdev: '자기계발 AI 요약 | 핵심 메시지 · 인사이트 · 실천 체크리스트',
      travel:  '여행 AI 요약 | 추천 장소 · 동선 · 실용 정보',
      story:   '스토리 AI 요약 | 인물 · 타임라인 · 핵심 요약',
      tips:    '팁 AI 요약 | 팁 카드 · Top 3 · 준비물 정리',
      report:  '보고서 AI 요약 | 목차 · 섹션별 분석 · 핵심 결론',
    }

    const CATEGORY_KEYWORDS: Record<string, string[]> = {
      recipe:  ['요리 레시피', '요리 방법', '쿠킹'],
      english: ['영어 학습', '영어 표현', '영어 공부'],
      learning:['학습', '공부', '개념 정리'],
      news:    ['뉴스 요약', '시사', '최신 뉴스'],
      selfdev: ['자기계발', '동기부여', '성장'],
      travel:  ['여행', '여행지 추천', '여행 정보'],
      story:   ['스토리', '영화', '드라마'],
      tips:    ['꿀팁', '생활 팁', 'How-to'],
      report:  ['보고서', '분석', '리서치'],
    }

    const description = `${CATEGORY_FEATURED[category] ?? 'AI 요약'} — ${title} (${channel}) | SSOKTUBE`
    const keywords = [...(CATEGORY_KEYWORDS[category] ?? []), 'AI 요약', '유튜브 요약', '유튜브', title, channel]

    return { title, thumbnail, channel, category, videoPublishedAt, description, keywords }
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
      title: 'SSOKTUBE',
      description: '유튜브를 쏙, 내 지식은 쑥',
    }
  }

  const pageTitle = og.title

  return {
    title: pageTitle,
    description: og.description,
    keywords: og.keywords,
    alternates: {
      canonical: `https://ssoktube.com/result/${sessionId}`,
    },
    openGraph: {
      title: og.title,
      description: og.description,
      type: 'article',
      url: `https://ssoktube.com/result/${sessionId}`,
      siteName: 'SSOKTUBE',
      // images는 opengraph-image.tsx가 자동으로 제공하므로 별도 지정 안 함
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
  const og = await getOgData(sessionId)

  // JSON-LD 구조화 데이터 (SEO 핵심)
  const jsonLd = og ? {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": og.title,
    "description": og.description,
    "image": og.thumbnail,
    "url": `https://ssoktube.com/result/${sessionId}`,
    "author": {
      "@type": "Organization",
      "name": "SSOKTUBE",
      "url": "https://ssoktube.com"
    },
    "publisher": {
      "@type": "Organization",
      "name": "SSOKTUBE",
      "url": "https://ssoktube.com",
      "logo": {
        "@type": "ImageObject",
        "url": "https://ssoktube.com/icon.png"
      }
    },
    ...(og.videoPublishedAt && {
      "datePublished": og.videoPublishedAt,
    }),
    "mainEntity": {
      "@type": "VideoObject",
      "name": og.title,
      "description": og.description,
      "thumbnailUrl": og.thumbnail,
      ...(og.videoPublishedAt && { "uploadDate": og.videoPublishedAt }),
    }
  } : null

  return (
    <>
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
      <ResultClient sessionId={sessionId} />
    </>
  )
}
