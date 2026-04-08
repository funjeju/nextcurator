import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'

export const runtime = 'edge'

const CATEGORY_INFO: Record<string, { label: string; color: string }> = {
  recipe:  { label: '🍳 요리',    color: '#fb923c' },
  english: { label: '🔤 영어학습', color: '#60a5fa' },
  learning:{ label: '📐 학습',    color: '#a78bfa' },
  news:    { label: '🗞️ 뉴스',   color: '#a1a1aa' },
  selfdev: { label: '💪 자기계발', color: '#34d399' },
  travel:  { label: '🧳 여행',    color: '#22d3ee' },
  story:   { label: '🍿 스토리',  color: '#f472b6' },
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const title     = searchParams.get('title')     || '제목 없음'
  const channel   = searchParams.get('channel')   || ''
  const thumbnail = searchParams.get('thumbnail') || ''
  const category  = searchParams.get('category')  || ''

  const cat = CATEGORY_INFO[category] ?? { label: '분석됨', color: '#fb923c' }

  // 썸네일 이미지를 서버에서 직접 fetch해서 base64로 변환 (CORS 우회)
  let thumbSrc = thumbnail
  if (thumbnail) {
    try {
      const r = await fetch(thumbnail)
      if (r.ok) {
        const buf = await r.arrayBuffer()
        const b64 = Buffer.from(buf).toString('base64')
        const mime = r.headers.get('content-type') || 'image/jpeg'
        thumbSrc = `data:${mime};base64,${b64}`
      }
    } catch {
      // 실패 시 원본 URL 유지
    }
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: '800px',
          height: '800px',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#252423',
          fontFamily: 'sans-serif',
          overflow: 'hidden',
        }}
      >
        {/* 썸네일 */}
        <div style={{ display: 'flex', width: '800px', height: '450px', position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
          {thumbSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumbSrc}
              alt=""
              style={{ width: '800px', height: '450px', objectFit: 'cover' }}
            />
          ) : (
            <div style={{ width: '800px', height: '450px', backgroundColor: '#32302e', display: 'flex' }} />
          )}
          {/* 하단 그라디언트 오버레이 */}
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: '120px',
              background: 'linear-gradient(to bottom, transparent, #252423)',
              display: 'flex',
            }}
          />
        </div>

        {/* 콘텐츠 영역 */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            padding: '28px 40px 32px',
            gap: '16px',
            flex: 1,
          }}
        >
          {/* 카테고리 배지 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <div
              style={{
                display: 'flex',
                padding: '6px 14px',
                borderRadius: '999px',
                border: `1.5px solid ${cat.color}`,
                color: cat.color,
                fontSize: '20px',
                fontWeight: 700,
              }}
            >
              {cat.label}
            </div>
            {channel && (
              <div style={{ color: '#a4a09c', fontSize: '18px', display: 'flex' }}>
                {channel}
              </div>
            )}
          </div>

          {/* 제목 */}
          <div
            style={{
              color: '#f4f4f4',
              fontSize: '30px',
              fontWeight: 700,
              lineHeight: 1.4,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              overflow: 'hidden',
            }}
          >
            {title}
          </div>

          {/* 브랜딩 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginTop: 'auto',
            }}
          >
            <div style={{ fontSize: '22px', display: 'flex' }}>🎬</div>
            <div style={{ color: '#75716e', fontSize: '20px', display: 'flex' }}>
              Next Curator
            </div>
          </div>
        </div>
      </div>
    ),
    { width: 800, height: 800 }
  )
}
