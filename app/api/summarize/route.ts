import { NextRequest, NextResponse } from 'next/server'
import { extractVideoId, getTranscript, getVideoMeta } from '@/lib/transcript'
import { classifyCategory, generateSummary } from '@/lib/claude'
import { randomUUID } from 'crypto'

async function getVideoInfo(videoId: string) {
  try {
    const res = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`)
    if (res.ok) {
      const data = await res.json()
      return {
        title: data.title as string,
        channel: data.author_name as string,
        thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
      }
    }
  } catch {
    // Fall back to API
  }

  const apiKey = process.env.YOUTUBE_API_KEY
  if (apiKey) {
    const apiRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=snippet&key=${apiKey}`)
    if (apiRes.ok) {
      const data = await apiRes.json()
      if (data.items && data.items.length > 0) {
        return {
          title: data.items[0].snippet.title,
          channel: data.items[0].snippet.channelTitle,
          thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
        }
      }
    }
  }

  throw new Error('VIDEO_NOT_FOUND')
}

// 결과를 Firestore에 저장 - 마이페이지/스퀘어에서 클릭 시 불러오기 위해
async function saveResultToFirestore(sessionId: string, result: object) {
  try {
    const { db } = await import('@/lib/firebase')
    const { doc, setDoc } = await import('firebase/firestore')
    const { serverTimestamp } = await import('firebase/firestore')
    await setDoc(doc(db, 'summaries', sessionId), { ...result, createdAt: serverTimestamp() })
    console.log('[Summarize] ✅ Saved to Firestore summaries:', sessionId)
  } catch (e) {
    console.warn('[Summarize] ⚠️ Failed to save to Firestore:', e)
    // 저장 실패해도 클라이언트 응답은 정상 반환
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

    // 같은 영상이 이미 DB에 있으면 캐시 반환 (userCategory 지정 시 재분석)
    if (!userCategory) {
      try {
        const { db } = await import('@/lib/firebase')
        const { collection, query, where, getDocs, orderBy, limit } = await import('firebase/firestore')
        const cached = await getDocs(
          query(collection(db, 'summaries'), where('videoId', '==', videoId), orderBy('createdAt', 'desc'), limit(1))
        )
        if (!cached.empty) {
          console.log('[Summarize] ✅ Cache hit for videoId:', videoId)
          const data = cached.docs[0].data()
          return NextResponse.json(data)
        }
      } catch (e) {
        console.warn('[Summarize] ⚠️ Cache check failed, proceeding fresh:', e)
      }
    }

    const videoInfo = await getVideoInfo(videoId)

    let transcript: string = ''
    let transcriptSource: string = ''
    try {
      const result = await getTranscript(videoId)
      transcript = result.text
      transcriptSource = result.source
    } catch {
      console.log('자막 추출 실패: 영상 설명 및 댓글 요약으로 대체합니다. (Video ID:', videoId, ')')
    }

    const [{ description, pinnedComment }] = await Promise.all([
      getVideoMeta(videoId),
    ])

    const contextParts = []
    if (transcript) contextParts.push(`[자막]\n${transcript}`)
    if (description) contextParts.push(`[영상 설명]\n${description}`)
    if (pinnedComment) contextParts.push(`[상위 댓글]\n${pinnedComment}`)

    const fullContext = contextParts.join('\n\n')

    if (!fullContext.trim()) {
      return NextResponse.json({
        error: '자막, 영상 설명, 댓글 중 어떠한 텍스트 데이터도 수집할 수 없어 요약이 불가능합니다.'
      }, { status: 422 })
    }

    let category = userCategory
    if (!category) {
      const classified = await classifyCategory(fullContext)
      category = classified.category
    }

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
      transcript,
      transcriptSource,
    }

    // Firestore 저장 후 응답 반환 (fire-and-forget은 Vercel에서 저장 완료 전 종료됨)
    await saveResultToFirestore(sessionId, result)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Summarize error:', error instanceof Error ? error.message : error)
    const message = error instanceof Error ? error.message : '처리 중 오류가 발생했습니다.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
