import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!
const API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY!

const CATEGORY_META: Record<string, { label: string; color: string; bg: string; emoji: string; featuredText: string }> = {
  recipe:  { label: '요리',    color: '#fb923c', bg: '#431407', emoji: '🍳', featuredText: '레시피 · 재료 · 단계별 조리법' },
  english: { label: '영어학습', color: '#60a5fa', bg: '#1e1b4b', emoji: '🔤', featuredText: '핵심 표현 · 단어장 · 학습 포인트' },
  learning:{ label: '학습',    color: '#a78bfa', bg: '#2e1065', emoji: '📐', featuredText: '핵심 개념 · 포인트 정리 · 예시' },
  news:    { label: '뉴스',    color: '#d1d5db', bg: '#1f2937', emoji: '🗞️', featuredText: '3줄 요약 · 육하원칙 · 시사점' },
  selfdev: { label: '자기계발', color: '#34d399', bg: '#064e3b', emoji: '💪', featuredText: '핵심 메시지 · 인사이트 · 실천 체크리스트' },
  travel:  { label: '여행',    color: '#22d3ee', bg: '#083344', emoji: '🧳', featuredText: '추천 장소 · 동선 · 실용 정보' },
  story:   { label: '스토리',  color: '#f472b6', bg: '#4a044e', emoji: '🍿', featuredText: '인물 · 타임라인 · 핵심 요약' },
  tips:    { label: '팁',      color: '#fbbf24', bg: '#451a03', emoji: '💡', featuredText: '팁 카드 · Top 3 · 준비물 정리' },
  report:  { label: '보고서',  color: '#818cf8', bg: '#1e1b4b', emoji: '📋', featuredText: '목차 · 섹션별 분석 · 핵심 결론' },
}

async function getOgData(sessionId: string) {
  try {
    const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/summaries/${sessionId}?key=${API_KEY}`
    const res = await fetch(url, { next: { revalidate: 3600 } })
    if (!res.ok) return null
    const doc = await res.json()
    if (!doc.fields) return null
    const f = doc.fields as Record<string, any>
    return {
      title: f.title?.stringValue ?? '',
      channel: f.channel?.stringValue ?? '',
      thumbnail: f.thumbnail?.stringValue ?? '',
      category: f.category?.stringValue ?? 'news',
    }
  } catch {
    return null
  }
}

async function loadFont(): Promise<ArrayBuffer | null> {
  try {
    // Noto Sans KR Regular subset — Google Fonts CSS API
    const cssRes = await fetch(
      'https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;700;900&display=swap',
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    )
    const css = await cssRes.text()
    const urlMatch = css.match(/src: url\((.+?)\) format\('woff2'\)/)
    if (!urlMatch) return null
    const fontRes = await fetch(urlMatch[1])
    return fontRes.arrayBuffer()
  } catch {
    return null
  }
}

export default async function OgImage(
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params
  const [data, fontData] = await Promise.all([getOgData(sessionId), loadFont()])

  const cat = CATEGORY_META[data?.category ?? 'news'] ?? CATEGORY_META.news
  const title = data?.title ?? 'Next Curator 요약'
  const channel = data?.channel ?? ''
  const thumbnail = data?.thumbnail ?? ''

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          background: '#18181b',
          display: 'flex',
          flexDirection: 'column',
          fontFamily: '"Noto Sans KR", sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* 배경 그라데이션 글로우 */}
        <div style={{
          position: 'absolute', top: -100, right: -100,
          width: 600, height: 600,
          background: `radial-gradient(circle, ${cat.color}22 0%, transparent 70%)`,
          display: 'flex',
        }} />

        {/* 좌측: 썸네일 영역 (앱 UI 프레임) */}
        <div style={{
          position: 'absolute', left: 0, top: 0,
          width: 620, height: 630,
          display: 'flex', flexDirection: 'column',
        }}>
          {/* 영상 썸네일 */}
          {thumbnail ? (
            <img
              src={thumbnail}
              width={620}
              height={349}
              style={{ objectFit: 'cover', display: 'block' }}
            />
          ) : (
            <div style={{ width: 620, height: 349, background: '#27272a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 80, opacity: 0.3 }}>▶</span>
            </div>
          )}

          {/* 앱 UI 탭 바 (스크린샷처럼) */}
          <div style={{
            display: 'flex', background: '#27272a',
            borderTop: '1px solid #3f3f46',
            padding: '0 16px',
          }}>
            {['기본 요약', '전체 자막', '다시 분석'].map((tab, i) => (
              <div key={tab} style={{
                padding: '14px 20px',
                fontSize: 13,
                fontWeight: i === 0 ? 700 : 400,
                color: i === 0 ? '#fff' : '#71717a',
                borderBottom: i === 0 ? `2px solid ${cat.color}` : '2px solid transparent',
                display: 'flex',
              }}>
                {tab}
              </div>
            ))}
          </div>

          {/* 채널명 + 카테고리 */}
          <div style={{
            background: '#1c1917',
            padding: '14px 20px',
            display: 'flex', alignItems: 'center', gap: 10,
            flex: 1,
          }}>
            <div style={{
              padding: '4px 12px', borderRadius: 99,
              background: cat.bg, color: cat.color,
              fontSize: 12, fontWeight: 700, display: 'flex',
            }}>
              {cat.emoji} {cat.label}
            </div>
            <span style={{ color: '#71717a', fontSize: 13, display: 'flex' }}>{channel}</span>
          </div>
        </div>

        {/* 수직 구분선 */}
        <div style={{
          position: 'absolute', left: 620, top: 0,
          width: 1, height: 630,
          background: 'linear-gradient(to bottom, transparent, #3f3f4680, transparent)',
          display: 'flex',
        }} />

        {/* 우측: 콘텐츠 */}
        <div style={{
          position: 'absolute', left: 644, top: 0, right: 0, bottom: 0,
          display: 'flex', flexDirection: 'column',
          padding: '44px 44px 36px',
          justifyContent: 'space-between',
        }}>
          {/* 상단: 브랜드 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 15, fontWeight: 900, color: cat.color, display: 'flex' }}>🎬</span>
            <span style={{ fontSize: 15, fontWeight: 900, color: '#fff', display: 'flex' }}>Next Curator</span>
            <div style={{
              marginLeft: 8, padding: '3px 10px', borderRadius: 99,
              background: `${cat.color}22`, border: `1px solid ${cat.color}44`,
              fontSize: 11, color: cat.color, fontWeight: 700, display: 'flex',
            }}>
              AI 요약
            </div>
          </div>

          {/* 제목 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1, justifyContent: 'center' }}>
            <div style={{
              fontSize: title.length > 30 ? 24 : 28,
              fontWeight: 900,
              color: '#fff',
              lineHeight: 1.4,
              display: 'flex',
              flexWrap: 'wrap',
            }}>
              {title}
            </div>

            {/* 구분선 */}
            <div style={{ width: 40, height: 3, background: cat.color, borderRadius: 99, display: 'flex' }} />

            {/* 카테고리별 포함 내용 */}
            <div style={{
              fontSize: 14, color: '#a1a1aa',
              display: 'flex', flexWrap: 'wrap',
            }}>
              {cat.featuredText}
            </div>
          </div>

          {/* 하단: CTA 느낌 */}
          <div style={{
            display: 'flex', flexDirection: 'column', gap: 8,
          }}>
            <div style={{
              display: 'flex', gap: 8,
            }}>
              <div style={{
                padding: '10px 18px', borderRadius: 10,
                background: cat.color, color: '#fff',
                fontSize: 13, fontWeight: 700, display: 'flex',
              }}>
                📚 {cat.label} 요약 보기
              </div>
              <div style={{
                padding: '10px 18px', borderRadius: 10,
                background: '#27272a', color: '#a1a1aa',
                border: '1px solid #3f3f46',
                fontSize: 13, fontWeight: 600, display: 'flex',
              }}>
                📄 전체 자막 보기
              </div>
            </div>
            <div style={{ fontSize: 11, color: '#52525b', display: 'flex', gap: 8 }}>
              <span>가장 스마트한 유튜브 저장소</span>
              <span>·</span>
              <span>nextcurator.vercel.app</span>
            </div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: fontData
        ? [{ name: 'Noto Sans KR', data: fontData, weight: 700 }]
        : [],
    }
  )
}
