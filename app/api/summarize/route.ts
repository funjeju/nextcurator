import { NextRequest, NextResponse } from 'next/server'
import { extractVideoId, getTranscript, getVideoMeta } from '@/lib/transcript'
import { classifyCategory, generateSummary } from '@/lib/claude'
import { db } from '@/lib/firebase'
import { collection, doc, setDoc, Timestamp } from 'firebase/firestore'
import { randomUUID } from 'crypto'

async function getVideoInfo(videoId: string) {
  const res = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`)
  if (!res.ok) throw new Error('VIDEO_NOT_FOUND')
  const data = await res.json()
  return {
    title: data.title as string,
    channel: data.author_name as string,
    thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
  }
}

export async function POST(req: NextRequest) {
  try {
    const { url, category: userCategory } = await req.json()

    if (!url) {
      return NextResponse.json({ error: 'URL이 필요합니다.' }, { status: 400 })
    }

    const videoId = extractVideoId(url)
    if (!videoId) {
      return NextResponse.json({ error: '올바른 YouTube URL을 입력해주세요.' }, { status: 400 })
    }

    // Get video metadata
    const videoInfo = await getVideoInfo(videoId)

    // Get transcript
    let transcript: string
    try {
      transcript = await getTranscript(videoId)
    } catch {
      return NextResponse.json({
        error: '자막을 추출할 수 없는 영상입니다. 자막이 있는 영상을 시도해주세요.'
      }, { status: 422 })
    }

    // Get video description + pinned comments (병렬 처리)
    const [{ description, pinnedComment }] = await Promise.all([
      getVideoMeta(videoId),
    ])

    // 자막 + 영상설명 + 댓글을 합쳐서 AI에 전달
    const fullContext = [
      `[자막]\n${transcript}`,
      description ? `[영상 설명]\n${description}` : '',
      pinnedComment ? `[상위 댓글]\n${pinnedComment}` : '',
    ].filter(Boolean).join('\n\n')

    // Classify category if not provided
    let category = userCategory
    if (!category) {
      const classified = await classifyCategory(fullContext)
      category = classified.category
    }

    // Generate summary
    const summary = await generateSummary(category, fullContext)

    const sessionId = randomUUID()
    const result = {
      sessionId,
      videoId,
      title: videoInfo.title,
      channel: videoInfo.channel,
      thumbnail: videoInfo.thumbnail,
      duration: 0,
      category,
      summary,
    }

    // Save to Firestore (fire and forget — never block the response)
    setDoc(doc(collection(db, 'summaries'), sessionId), {
      videoId,
      url,
      title: videoInfo.title,
      channel: videoInfo.channel,
      thumbnail: videoInfo.thumbnail,
      category,
      summary,
      createdAt: Timestamp.now(),
      userId: null,
    }).catch(() => {})

    return NextResponse.json(result)
  } catch (error) {
    console.error('Summarize error:', error instanceof Error ? error.message : error)
    const message = error instanceof Error ? error.message : '처리 중 오류가 발생했습니다.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
