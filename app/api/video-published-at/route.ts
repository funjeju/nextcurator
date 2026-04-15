import { NextRequest, NextResponse } from 'next/server'

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!
const API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY!
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY

export async function POST(req: NextRequest) {
  try {
    const { sessionId, videoId } = await req.json()
    if (!sessionId || !videoId) {
      return NextResponse.json({ error: 'sessionId and videoId required' }, { status: 400 })
    }

    if (!YOUTUBE_API_KEY) {
      return NextResponse.json({ error: 'No YouTube API key' }, { status: 500 })
    }

    // YouTube API에서 publishedAt 가져오기
    const ytRes = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=snippet&key=${YOUTUBE_API_KEY}`
    )
    if (!ytRes.ok) {
      return NextResponse.json({ error: 'YouTube API failed' }, { status: 502 })
    }
    const ytData = await ytRes.json()
    const publishedAt: string = ytData?.items?.[0]?.snippet?.publishedAt ?? ''
    if (!publishedAt) {
      return NextResponse.json({ publishedAt: '' })
    }

    // Firestore PATCH (Field mask으로 해당 필드만 업데이트)
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
