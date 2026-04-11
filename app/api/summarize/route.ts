import { NextRequest, NextResponse } from 'next/server'
import { extractVideoId, getTranscript, getVideoMeta } from '@/lib/transcript'
import { classifyCategory, generateSummary, generateReportSummary, generateContextSummary } from '@/lib/claude'
import { randomUUID } from 'crypto'

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!
const API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY!
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`

// Firestore REST API로 저장 (Client SDK는 Vercel 서버리스에서 불안정)
async function saveToFirestore(sessionId: string, data: Record<string, unknown>): Promise<void> {
  const fields = toFirestoreFields(data)
  const url = `${FIRESTORE_BASE}/summaries/${sessionId}?key=${API_KEY}`
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Firestore write failed: ${err}`)
  }
}

// Firestore REST API로 videoId 캐시 조회
async function getCachedByVideoId(videoId: string): Promise<Record<string, unknown> | null> {
  const url = `${FIRESTORE_BASE}:runQuery?key=${API_KEY}`
  const body = {
    structuredQuery: {
      from: [{ collectionId: 'summaries' }],
      where: {
        fieldFilter: {
          field: { fieldPath: 'videoId' },
          op: 'EQUAL',
          value: { stringValue: videoId },
        },
      },
      limit: 1,
    },
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) return null
  const results = await res.json()
  // 결과 없으면 [{ }] 또는 document 없는 객체 반환
  if (!results[0]?.document?.fields) return null
  return fromFirestoreFields(results[0].document.fields)
}

// JS 값 → Firestore REST 필드 변환
function toFirestoreFields(obj: unknown): Record<string, unknown> {
  if (obj === null || obj === undefined) return {}
  if (typeof obj !== 'object' || Array.isArray(obj)) return {}
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    out[k] = toFirestoreValue(v)
  }
  return out
}

function toFirestoreValue(v: unknown): unknown {
  if (v === null || v === undefined) return { nullValue: null }
  if (typeof v === 'string') return { stringValue: v }
  if (typeof v === 'number') return { integerValue: String(v) }
  if (typeof v === 'boolean') return { booleanValue: v }
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toFirestoreValue) } }
  if (typeof v === 'object') return { mapValue: { fields: toFirestoreFields(v) } }
  return { stringValue: String(v) }
}

// Firestore REST 필드 → JS 값 변환
function fromFirestoreFields(fields: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(fields)) {
    out[k] = fromFirestoreValue(v as Record<string, unknown>)
  }
  return out
}

function fromFirestoreValue(v: Record<string, unknown>): unknown {
  if ('stringValue' in v) return v.stringValue
  if ('integerValue' in v) return Number(v.integerValue)
  if ('doubleValue' in v) return Number(v.doubleValue)
  if ('booleanValue' in v) return v.booleanValue
  if ('nullValue' in v) return null
  if ('arrayValue' in v) {
    const arr = v.arrayValue as { values?: unknown[] }
    return (arr.values ?? []).map(i => fromFirestoreValue(i as Record<string, unknown>))
  }
  if ('mapValue' in v) {
    const map = v.mapValue as { fields?: Record<string, unknown> }
    return map.fields ? fromFirestoreFields(map.fields) : {}
  }
  return null
}

async function getVideoInfo(videoId: string) {
  const apiKey = process.env.YOUTUBE_API_KEY
  let title = '', channel = '', publishedAt = ''

  // YouTube Data API v3 — title, channel, publishedAt 모두 가져옴
  if (apiKey) {
    try {
      const apiRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=snippet&key=${apiKey}`)
      if (apiRes.ok) {
        const data = await apiRes.json()
        if (data.items && data.items.length > 0) {
          title = data.items[0].snippet.title
          channel = data.items[0].snippet.channelTitle
          publishedAt = data.items[0].snippet.publishedAt ?? ''
        }
      }
    } catch { /* fall through */ }
  }

  // title/channel 없으면 oEmbed로 보완
  if (!title || !channel) {
    try {
      const res = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`)
      if (res.ok) {
        const data = await res.json()
        if (!title) title = data.title as string
        if (!channel) channel = data.author_name as string
      }
    } catch { /* ignore */ }
  }

  if (!title) throw new Error('VIDEO_NOT_FOUND')

  return {
    title,
    channel,
    thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
    publishedAt,
  }
}

// 일반 URL에서 텍스트 추출
async function fetchUrlContent(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NextCurator/1.0)' },
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) throw new Error('URL 접근 실패')
  const html = await res.text()
  // HTML 태그 제거, 공백 정리
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 10000)
}

export async function POST(req: NextRequest) {
  try {
    const { url, category: userCategory } = await req.json()

    if (!url) {
      return NextResponse.json({ error: 'URL이 필요합니다.' }, { status: 400 })
    }

    const videoId = extractVideoId(url)

    // ── 일반 URL (YouTube 아님) ──
    if (!videoId) {
      try { new URL(url) } catch {
        return NextResponse.json({ error: '올바른 URL을 입력해주세요.' }, { status: 400 })
      }

      let pageText = ''
      try { pageText = await fetchUrlContent(url) } catch {
        return NextResponse.json({ error: 'URL 내용을 가져올 수 없습니다. 접근이 차단된 페이지일 수 있습니다.' }, { status: 422 })
      }
      if (!pageText.trim()) {
        return NextResponse.json({ error: '페이지에서 텍스트를 추출할 수 없습니다.' }, { status: 422 })
      }

      let category = userCategory
      if (!category) {
        const classified = await classifyCategory(pageText)
        category = classified.category
      }

      // 페이지 제목 추출
      const titleMatch = pageText.match(/(?:^|\s)([^.!?]{10,80})(?:\s|$)/)
      const pageTitle = titleMatch?.[1]?.trim() || new URL(url).hostname

      const [summary, reportSummary] = await Promise.all([
        generateSummary(category, pageText, 'web'),
        generateReportSummary(category, pageTitle, pageText).catch(() => ''),
      ])
      const contextSummary = await generateContextSummary(pageTitle, category, summary).catch(() => '')

      const sessionId = randomUUID()
      const result = {
        sessionId,
        videoId: '',
        sourceUrl: url,
        title: pageTitle,
        channel: new URL(url).hostname,
        thumbnail: '',
        duration: 0,
        category,
        summary,
        contextSummary,
        transcript: pageText.slice(0, 3000),
        transcriptSource: 'web',
        videoPublishedAt: '',
        summarizedAt: new Date().toISOString(),
        reportSummary: reportSummary || '',
      }

      try {
        await saveToFirestore(sessionId, result)
      } catch (e) {
        console.warn('[Summarize] ⚠️ Failed to save URL result:', e)
      }

      return NextResponse.json(result)
    }

    // 같은 영상이 이미 DB에 있으면 캐시 반환 (userCategory 지정 시 재분석)
    if (!userCategory) {
      try {
        const cached = await getCachedByVideoId(videoId)
        if (cached) {
          console.log('[Summarize] ✅ Cache hit for videoId:', videoId)
          return NextResponse.json(cached)
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

    const [summary, reportSummary] = await Promise.all([
      generateSummary(category, fullContext),
      generateReportSummary(category, videoInfo.title, fullContext).catch(() => ''),
    ])
    const contextSummary = await generateContextSummary(videoInfo.title, category, summary).catch(() => '')

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
      contextSummary,
      transcript,
      transcriptSource,
      videoPublishedAt: videoInfo.publishedAt || '',
      summarizedAt: new Date().toISOString(),
      reportSummary: reportSummary || '',
    }

    // Firestore REST API로 저장 (Client SDK보다 Vercel 서버리스에서 안정적)
    try {
      await saveToFirestore(sessionId, result)
      console.log('[Summarize] ✅ Saved to Firestore summaries:', sessionId)
    } catch (e) {
      console.warn('[Summarize] ⚠️ Failed to save to Firestore:', e)
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Summarize error:', error instanceof Error ? error.message : error)
    const message = error instanceof Error ? error.message : '처리 중 오류가 발생했습니다.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
