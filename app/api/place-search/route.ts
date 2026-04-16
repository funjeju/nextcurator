import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')
  if (!q) return NextResponse.json({ error: 'query required' }, { status: 400 })

  const apiKey = process.env.KAKAO_REST_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'KAKAO_REST_API_KEY not configured' }, { status: 500 })

  const res = await fetch(
    `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(q)}&size=10`,
    {
      headers: { Authorization: `KakaoAK ${apiKey}` },
      signal: AbortSignal.timeout(5000),
    },
  )

  if (!res.ok) {
    const err = await res.text().catch(() => '')
    return NextResponse.json({ error: `Kakao API error: ${res.status}`, detail: err }, { status: res.status })
  }

  const data = await res.json()
  return NextResponse.json(data)
}
