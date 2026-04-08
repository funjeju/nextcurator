import { NextRequest, NextResponse } from 'next/server'

// YouTube 썸네일 등 외부 이미지를 CORS 없이 로드하기 위한 프록시
export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url')
  if (!url) return new NextResponse('url required', { status: 400 })

  try {
    const res = await fetch(url)
    if (!res.ok) return new NextResponse('fetch failed', { status: 502 })

    const buffer = await res.arrayBuffer()
    const contentType = res.headers.get('content-type') || 'image/jpeg'

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
      },
    })
  } catch {
    return new NextResponse('error', { status: 500 })
  }
}
