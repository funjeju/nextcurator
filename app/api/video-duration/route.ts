import { NextRequest, NextResponse } from 'next/server'
import { extractVideoId } from '@/lib/transcript'

function parseIso8601Duration(duration: string): number {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!match) return 0
  const h = parseInt(match[1] ?? '0')
  const m = parseInt(match[2] ?? '0')
  const s = parseInt(match[3] ?? '0')
  return h * 3600 + m * 60 + s
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const urlParam = searchParams.get('url') || ''
  const videoId = extractVideoId(urlParam) || searchParams.get('videoId') || ''

  if (!videoId) {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
  }

  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) {
    // API 키 없으면 허용으로 처리 (로컬 개발)
    return NextResponse.json({ durationSeconds: 0, allowed: true })
  }

  try {
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=contentDetails&key=${apiKey}`
    )
    const data = await res.json()
    const iso = data.items?.[0]?.contentDetails?.duration ?? ''
    const durationSeconds = parseIso8601Duration(iso)
    return NextResponse.json({ durationSeconds, allowed: durationSeconds <= 600 || durationSeconds === 0 })
  } catch {
    return NextResponse.json({ durationSeconds: 0, allowed: true })
  }
}
