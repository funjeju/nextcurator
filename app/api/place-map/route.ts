import { NextRequest, NextResponse } from 'next/server'

// Kakao Static Map 이미지를 서버에서 프록시해서 반환 (API 키 노출 방지)
export async function GET(req: NextRequest) {
  const lat = req.nextUrl.searchParams.get('lat')
  const lng = req.nextUrl.searchParams.get('lng')
  if (!lat || !lng) return new NextResponse('lat, lng required', { status: 400 })

  const apiKey = process.env.KAKAO_REST_API_KEY
  if (!apiKey) return new NextResponse('not configured', { status: 500 })

  const url = `https://dapi.kakao.com/v2/maps/staticmap?center=${lng},${lat}&level=4&size=300x200&markers=pos:${lng}%20${lat}|size:medium`

  const res = await fetch(url, {
    headers: { Authorization: `KakaoAK ${apiKey}` },
    signal: AbortSignal.timeout(6000),
  })

  if (!res.ok) return new NextResponse('map fetch failed', { status: res.status })

  const buf = await res.arrayBuffer()
  return new NextResponse(buf, {
    headers: {
      'Content-Type': res.headers.get('Content-Type') || 'image/png',
      'Cache-Control': 'public, max-age=86400',
    },
  })
}
