import { NextRequest, NextResponse } from 'next/server'

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!
const API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY!
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY

async function getPublishedAt(videoId: string): Promise<string> {
  // 1차: YouTube Data API v3
  if (YOUTUBE_API_KEY) {
    try {
      const ytRes = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=snippet&key=${YOUTUBE_API_KEY}`,
        { signal: AbortSignal.timeout(5000) }
      )
      if (ytRes.ok) {
        const ytData = await ytRes.json()
        const publishedAt: string = ytData?.items?.[0]?.snippet?.publishedAt ?? ''
        if (publishedAt) return publishedAt
      } else {
        const errBody = await ytRes.text().catch(() => '')
        console.error(`[video-published-at] YouTube API HTTP ${ytRes.status}:`, errBody.slice(0, 200))
      }
    } catch (e) {
      console.warn('[video-published-at] YouTube API fetch failed, trying HTML fallback:', e)
    }
  } else {
    console.warn('[video-published-at] YOUTUBE_API_KEY not set, trying HTML fallback')
  }

  // 2차 fallback: YouTube 페이지 HTML에서 파싱
  try {
    const pageRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)' },
      signal: AbortSignal.timeout(7000),
    })
    if (pageRes.ok) {
      const html = await pageRes.text()
      const metaMatch = html.match(/"datePublished"\s*:\s*"([^"]+)"/)
      if (metaMatch) return new Date(metaMatch[1]).toISOString()
      const publishMatch = html.match(/"publishDate"\s*:\s*"([^"]+)"/)
      if (publishMatch) return new Date(publishMatch[1]).toISOString()
    }
  } catch (e) {
    console.warn('[video-published-at] HTML fallback also failed:', e)
  }

  return ''
}

export async function POST(req: NextRequest) {
  try {
    const { sessionId, videoId } = await req.json()
    if (!sessionId || !videoId) {
      return NextResponse.json({ error: 'sessionId and videoId required' }, { status: 400 })
    }

    const publishedAt = await getPublishedAt(videoId)
    if (!publishedAt) {
      return NextResponse.json({ publishedAt: '' })
    }

    // Firestore PATCH
    const patchUrl = `${FIRESTORE_BASE}/summaries/${sessionId}?updateMask.fieldPaths=videoPublishedAt&key=${API_KEY}`
    await fetch(patchUrl, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: { videoPublishedAt: { stringValue: publishedAt } },
      }),
    })

    return NextResponse.json({ publishedAt })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
