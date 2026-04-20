import { NextRequest, NextResponse } from 'next/server'
import { extractVideoId, getTranscript, detectTranscriptLang } from '@/lib/transcript'
import { classifyCategory, generateSummary, generateReportSummary, generateContextSummary } from '@/lib/claude'
import { fetchVideoComments, formatCommentsForPrompt } from '@/lib/youtube-comments'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { randomUUID } from 'crypto'

async function generateYtCommentSummary(popular: { text: string; likes: number }[]): Promise<string> {
  if (popular.length === 0) return ''
  try {
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY!)
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 600,
        // @ts-expect-error thinkingConfig not yet in types but supported
        thinkingConfig: { thinkingBudget: 0 },
      },
    })
    const lines = popular.slice(0, 25).map(c => `- [👍${c.likes}] ${c.text.slice(0, 150)}`).join('\n')
    const result = await model.generateContent(
      `다음은 유튜브 영상의 인기 댓글입니다.\n\n${lines}\n\n시청자 반응의 방향성을 280자 이내로 요약해주세요. 긍정/부정/혼재 여부, 주요 언급 포인트, 전체 분위기를 간결하게. 마크다운 없이 문장만.`
    )
    return result.response.text().trim().slice(0, 300)
  } catch {
    return ''
  }
}

export const maxDuration = 300

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
  const socialkitKey = process.env.SOCIALKIT_API_KEY
  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`

  let title = '', channel = '', publishedAt = '', ytViewCount = 0, description = ''

  // 1순위: YouTube Data API v3 — 창작자가 설정한 원본 제목 (언어 그대로)
  if (apiKey) {
    try {
      const apiRes = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=snippet,statistics&key=${apiKey}`,
        { signal: AbortSignal.timeout(5000) }
      )
      if (apiRes.ok) {
        const data = await apiRes.json()
        const item = data.items?.[0]
        if (item) {
          title       = item.snippet?.title ?? ''
          channel     = item.snippet?.channelTitle ?? ''
          publishedAt = item.snippet?.publishedAt ?? ''
          ytViewCount = Number(item.statistics?.viewCount ?? 0)
          description = item.snippet?.description ?? ''
        }
      }
    } catch (e) {
      console.warn('[getVideoInfo] YouTube API error:', e)
    }
  }

  // 2순위: SocialKit stats — views/description 보완 (title이 없을 때만 title도 사용)
  if (socialkitKey && (!title || !ytViewCount)) {
    try {
      const res = await fetch(
        `https://api.socialkit.dev/youtube/stats?url=${encodeURIComponent(videoUrl)}`,
        { headers: { 'x-access-key': socialkitKey }, signal: AbortSignal.timeout(10000) }
      )
      if (res.ok) {
        const data = await res.json() as { data?: { title?: string; channelName?: string; views?: number; description?: string } }
        if (!title) title = data.data?.title ?? ''
        if (!channel) channel = data.data?.channelName ?? ''
        if (!ytViewCount) ytViewCount = data.data?.views ?? 0
        if (!description) description = data.data?.description ?? ''
      }
    } catch { /* ignore */ }
  }

  // 3순위: oEmbed — title/channel 최후 보완
  if (!title || !channel) {
    try {
      const res = await fetch(
        `https://www.youtube.com/oembed?url=${encodeURIComponent(videoUrl)}&format=json`,
        { signal: AbortSignal.timeout(5000) }
      )
      if (res.ok) {
        const data = await res.json()
        if (!title) title = data.title as string
        if (!channel) channel = data.author_name as string
      }
    } catch { /* ignore */ }
  }

  // publishedAt 없으면 watch 페이지 HTML 파싱
  if (!publishedAt) {
    try {
      const html = await fetch(videoUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)' },
        signal: AbortSignal.timeout(7000),
      }).then(r => r.ok ? r.text() : '')
      const m = html.match(/"datePublished"\s*:\s*"([^"]+)"/) ?? html.match(/"publishDate"\s*:\s*"([^"]+)"/)
      if (m) publishedAt = new Date(m[1]).toISOString()
    } catch { /* ignore */ }
  }

  if (!title) throw new Error('VIDEO_NOT_FOUND')

  return {
    title,
    channel,
    thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
    publishedAt,
    ytViewCount,
    description,
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

function extractTranscriptDuration(transcript: string): number {
  const matches = [...transcript.matchAll(/\[(\d{1,2}):(\d{2})\]/g)]
  if (!matches.length) return 0
  const last = matches[matches.length - 1]
  return parseInt(last[1]) * 60 + parseInt(last[2])
}

export async function POST(req: NextRequest) {
  try {
    const {
      url,
      category: userCategory,
      summaryLang,           // 'ko' | 'original' — 언어 선택 후 재호출 시 포함
      cachedTranscript,      // 1차 호출에서 반환된 자막 캐시
      cachedVideoInfo,       // 1차 호출에서 반환된 영상 정보 캐시
      forceAutoCaption,      // true: 한국어 자막 건너뛰고 자동자막으로 추출
      noSave,                // true: Firestore 저장 안 함 (타인 요약 임시 재분석)
    } = await req.json()

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
          // 자막 없이 요약된 캐시는 재분석 (고정댓글/설명 활용 못했을 수 있음)
          if (cached.transcriptSource === 'none' || cached.transcriptSource === '') {
            console.log('[Summarize] ⚠️ Cache has no/empty transcript — re-analyzing:', videoId)
          } else {
            console.log('[Summarize] ✅ Cache hit for videoId:', videoId)
            // videoPublishedAt 없으면 YouTube API에서 보완 후 저장
            if (!cached.videoPublishedAt) {
              try {
                const info = await getVideoInfo(videoId)
                if (info.publishedAt) {
                  cached.videoPublishedAt = info.publishedAt
                  await saveToFirestore(cached.sessionId as string, cached)
                }
              } catch { /* 보완 실패해도 캐시 반환은 진행 */ }
            }
            return NextResponse.json(cached)
          }
        }
      } catch (e) {
        console.warn('[Summarize] ⚠️ Cache check failed, proceeding fresh:', e)
      }
    }

    // 영상정보 + 자막 + 댓글 병렬 실행 (getVideoMeta 제거 — fetchVideoComments로 통합)
    const [videoInfo, transcriptResult, commentResult] = await Promise.all([
      cachedVideoInfo
        ? Promise.resolve(cachedVideoInfo as { title: string; channel: string; thumbnail: string; publishedAt: string; ytViewCount?: number; description?: string })
        : getVideoInfo(videoId),
      cachedTranscript
        ? Promise.resolve({ text: cachedTranscript as string, source: 'cached', lang: detectTranscriptLang(cachedTranscript as string) })
        : getTranscript(videoId).catch((e: Error) => {
            console.warn(`[Summarize] ⚠️ 자막 추출 실패 (${videoId}): ${e.message} — 영상 설명 및 댓글 요약으로 대체합니다.`)
            return { text: '', source: 'none', lang: 'ko' as const }
          }),
      fetchVideoComments(videoId).catch(() => ({ popular: [], recent: [], combined: [] })),
    ])

    let transcript = transcriptResult.text
    let transcriptSource = transcriptResult.source
    let transcriptLang = transcriptResult.lang as 'ko' | 'en' | 'other'

    // ── 언어 선택 필요 여부 확인 ──
    // summaryLang 미지정 + 비한국어 자막 → 프론트에서 선택하도록 early return
    if (!summaryLang && transcriptLang !== 'ko' && transcript.trim().length > 50) {
      return NextResponse.json({
        needsLangChoice: true,
        detectedLang: transcriptLang,
        cachedTranscript: transcript,
        cachedVideoInfo: cachedVideoInfo || {
          title: videoInfo.title,
          channel: videoInfo.channel,
          thumbnail: videoInfo.thumbnail,
          publishedAt: videoInfo.publishedAt,
        },
      })
    }

    const outputLang: 'ko' | 'original' = summaryLang === 'original' ? 'original' : 'ko'

    const description = (videoInfo as any).description ?? ''
    // pinnedComment: 인기 댓글 1위로 대체 (getVideoMeta 제거)
    const pinnedComment = commentResult.popular[0]?.text ?? ''

    const contextParts = []

    // 제목+채널은 항상 포함 — fullContext가 절대 빈값이 되지 않도록 보장
    contextParts.push(`[영상 제목]\n${videoInfo.title}\n[채널]\n${videoInfo.channel}`)

    if (transcript) {
      const transNote = outputLang === 'ko' && transcriptLang !== 'ko'
        ? `[언어 안내: 아래 자막은 ${transcriptLang === 'en' ? '영어(English)' : '외국어'}입니다. 내용을 이해하고 한국어로 번역하여 요약해주세요.]\n\n`
        : ''
      contextParts.push(`[자막]\n${transNote}${transcript}`)
    }
    if (description) {
      contextParts.push(`[영상 설명]\n${description}`)
    }
    if (pinnedComment) contextParts.push(`[상위 댓글]\n${pinnedComment}`)

    const fullContext = contextParts.join('\n\n')

    // 자막 실패 시 경고 메시지 생성
    let transcriptWarning = ''
    if (transcriptSource === 'none') {
      if (!description) {
        transcriptWarning = '이 영상은 자막과 설명 정보를 모두 가져올 수 없어 제목만으로 요약했습니다. 정확도가 낮을 수 있습니다.'
        console.warn(`[Summarize] ⚠️ No transcript or description for ${videoId} — summarizing from title only`)
      } else {
        transcriptWarning = '이 영상은 자막을 가져올 수 없어 영상 설명과 댓글을 기반으로 요약했습니다. 실제 내용과 다를 수 있습니다.'
        console.warn(`[Summarize] ⚠️ No transcript for ${videoId} — summarizing from description/comments`)
      }
    }

    let category = userCategory
    if (!category) {
      const classified = await classifyCategory(fullContext)
      category = classified.category
    }

    const [summary, reportSummary, ytCommentSummary] = await Promise.all([
      generateSummary(category, fullContext, 'youtube', outputLang),
      generateReportSummary(category, videoInfo.title, fullContext).catch(() => ''),
      generateYtCommentSummary(commentResult.popular),
    ])
    const contextSummary = await generateContextSummary(videoInfo.title, category, summary).catch(() => '')

    const ytCommentsContext = commentResult.popular.length > 0
      ? formatCommentsForPrompt(commentResult.popular, commentResult.recent).slice(0, 3000)
      : ''

    const sessionId = randomUUID()
    const result = {
      sessionId,
      videoId,
      title: videoInfo.title,
      channel: videoInfo.channel,
      thumbnail: videoInfo.thumbnail,
      duration: 0,
      transcriptDuration: extractTranscriptDuration(transcript),
      category,
      summary,
      contextSummary,
      transcript,
      transcriptSource,
      transcriptWarning,
      videoPublishedAt: videoInfo.publishedAt || '',
      ytViewCount: videoInfo.ytViewCount ?? 0,
      summarizedAt: new Date().toISOString(),
      reportSummary: reportSummary || '',
      ytCommentSummary,
      ytCommentsContext,
    }

    // Firestore 저장 (noSave=true 이면 임시 재분석이므로 저장 스킵)
    if (!noSave) {
      try {
        console.log('[Summarize] 🔍 PRE-SAVE transcriptSource:', JSON.stringify(transcriptSource), '| transcriptResult.source:', JSON.stringify(transcriptResult.source))
        await saveToFirestore(sessionId, result)
        console.log('[Summarize] ✅ Saved to Firestore summaries:', sessionId)
      } catch (e) {
        console.warn('[Summarize] ⚠️ Failed to save to Firestore:', e)
      }
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Summarize error:', error instanceof Error ? error.message : error)
    const message = error instanceof Error ? error.message : '처리 중 오류가 발생했습니다.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
