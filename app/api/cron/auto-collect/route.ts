import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { getTranscript, detectTranscriptLang } from '@/lib/transcript'
import { classifyCategory, generateSummary, generateReportSummary, generateContextSummary } from '@/lib/claude'
import { fetchVideoComments, formatCommentsForPrompt } from '@/lib/youtube-comments'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { getCurationSettings } from '@/lib/magazine'
import { initAdminApp } from '@/lib/firebase-admin'

export const maxDuration = 120

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY!

// 카테고리별 검색 설정
const CATEGORY_QUERIES = [
  { category: 'news',    query: '한국 뉴스 시사 최신',        label: '뉴스/시사' },
  { category: 'selfdev', query: '자기계발 성장 동기부여',      label: '자기계발' },
  { category: 'travel',  query: '국내여행 추천 여행지',        label: '여행' },
  { category: 'tips',    query: '생활 꿀팁 유용한 정보',       label: '팁' },
  { category: 'english', query: '영어 학습 공부법 회화',       label: '영어학습' },
  { category: 'recipe',  query: '요리 레시피 만들기',          label: '요리' },
]

const MIN_DURATION_SEC = 180  // 3분 미만 쇼츠/짧은 클립 제외
const MIN_TRANSCRIPT_LEN = 500 // 자막 너무 짧으면 요약 불가

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return req.headers.get('authorization') === `Bearer ${secret}`
}

// ISO 8601 duration → 초 변환 (PT1H2M3S)
function parseDuration(iso: string): number {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!m) return 0
  return (Number(m[1] ?? 0) * 3600) + (Number(m[2] ?? 0) * 60) + Number(m[3] ?? 0)
}

interface VideoCandidate {
  videoId: string
  title: string
  channel: string
  thumbnail: string
  viewCount: number
  durationSec: number
  publishedAt: string
}

// 여러 videoId의 메타(duration + viewCount)를 한 번에 조회 후 필터·정렬
async function fetchQualifiedVideos(videoIds: string[]): Promise<VideoCandidate[]> {
  const url = new URL('https://www.googleapis.com/youtube/v3/videos')
  url.searchParams.set('part', 'snippet,statistics,contentDetails')
  url.searchParams.set('id', videoIds.join(','))
  url.searchParams.set('key', YOUTUBE_API_KEY)

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(10000) })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`YouTube videos API failed: ${res.status} | ${body}`)
  }

  const data = await res.json() as {
    items?: {
      id: string
      snippet?: { title?: string; channelTitle?: string; publishedAt?: string }
      statistics?: { viewCount?: string }
      contentDetails?: { duration?: string }
    }[]
  }

  return (data.items ?? [])
    .map(item => {
      const durationSec = parseDuration(item.contentDetails?.duration ?? '')
      return {
        videoId: item.id,
        title: item.snippet?.title ?? '',
        channel: item.snippet?.channelTitle ?? '',
        thumbnail: `https://img.youtube.com/vi/${item.id}/maxresdefault.jpg`,
        viewCount: Number(item.statistics?.viewCount ?? 0),
        durationSec,
        publishedAt: item.snippet?.publishedAt ?? '',
      }
    })
    .filter(v => v.durationSec >= MIN_DURATION_SEC)  // 3분 미만 제외
    .sort((a, b) => b.viewCount - a.viewCount)        // 조회수 높은 순
}

// YouTube 검색으로 videoId 목록만 가져오기
async function searchVideoIds(query: string, maxResults = 10): Promise<string[]> {
  const url = new URL('https://www.googleapis.com/youtube/v3/search')
  url.searchParams.set('part', 'id')
  url.searchParams.set('type', 'video')
  url.searchParams.set('q', query)
  url.searchParams.set('maxResults', String(maxResults))
  url.searchParams.set('regionCode', 'KR')
  url.searchParams.set('relevanceLanguage', 'ko')
  url.searchParams.set('key', YOUTUBE_API_KEY)

  console.log('[AutoCollect] Search URL (key redacted):', url.toString().replace(YOUTUBE_API_KEY, 'REDACTED'))

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(10000) })
  if (!res.ok) {
    const errBody = await res.text().catch(() => '(empty)')
    throw new Error(`YouTube search failed: ${res.status} | ${errBody}`)
  }

  const data = await res.json() as { items?: { id?: { videoId?: string } }[] }
  return (data.items ?? []).map(item => item.id?.videoId ?? '').filter(Boolean)
}

// videoId가 이미 saved_summaries에 있는지 확인
async function isAlreadyCollected(videoId: string): Promise<boolean> {
  try {
    initAdminApp()
    const { getFirestore } = await import('firebase-admin/firestore')
    const db = getFirestore()
    const snap = await db.collection('saved_summaries')
      .where('videoId', '==', videoId)
      .limit(1)
      .get()
    return !snap.empty
  } catch {
    return false
  }
}

// saved_summaries에 직접 저장 (Admin SDK)
async function saveToSavedSummaries(doc: Record<string, unknown>): Promise<string> {
  initAdminApp()
  const { getFirestore, FieldValue } = await import('firebase-admin/firestore')
  const db = getFirestore()
  const ref = db.collection('saved_summaries').doc()
  await ref.set({ ...doc, createdAt: FieldValue.serverTimestamp() })
  return ref.id
}

// 반복 자막 감지: 고유 문장 비율이 20% 미만이면 쓰레기 자막으로 판단
function isRepetitiveTranscript(text: string): boolean {
  if (!text || text.length < 100) return false
  const sentences = text.split(/[.!?\n]+/).map(s => s.trim()).filter(Boolean)
  if (sentences.length < 5) return false
  const unique = new Set(sentences)
  return unique.size / sentences.length < 0.2
}

// 유튜브 댓글 AI 요약 (280자)
async function generateYtCommentSummary(popular: { text: string; likes: number }[]): Promise<string> {
  if (popular.length === 0) return ''
  try {
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY!)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })
    const prompt = `다음은 유튜브 영상의 인기 댓글입니다. 시청자 반응과 분위기를 한국어로 280자 이내로 요약해주세요.\n\n${popular.slice(0, 20).map(c => `"${c.text}" (좋아요 ${c.likes})`).join('\n')}`
    const result = await model.generateContent(prompt)
    return result.response.text().slice(0, 300)
  } catch {
    return ''
  }
}

// 영상 1개 자동 수집·요약·저장
async function collectAndSummarize(candidate: VideoCandidate, categoryHint: string): Promise<{ title: string; sessionId: string } | null> {
  const { videoId, title: videoTitle, channel, thumbnail, viewCount, publishedAt } = candidate
  try {
    const alreadyDone = await isAlreadyCollected(videoId)
    if (alreadyDone) {
      console.log(`[AutoCollect] Skip (already collected): ${videoId}`)
      return null
    }

    const [transcriptResult, commentResult] = await Promise.all([
      getTranscript(videoId).catch(() => ({ text: '', source: 'none', lang: 'ko' as const })),
      fetchVideoComments(videoId).catch(() => ({ popular: [], recent: [], combined: [] })),
    ])

    const rawTranscript = transcriptResult.text
    const transcript = isRepetitiveTranscript(rawTranscript) ? '' : rawTranscript
    if (rawTranscript && !transcript) {
      console.log(`[AutoCollect] Transcript discarded (repetitive): ${videoId}`)
    }

    // 자막이 없고 너무 짧으면 스킵
    if (transcript.length < MIN_TRANSCRIPT_LEN && !videoTitle) {
      console.log(`[AutoCollect] Skip (transcript too short): ${videoId}`)
      return null
    }

    const transcriptLang = detectTranscriptLang(transcript)

    // 카테고리 분류
    const classified = await classifyCategory(transcript || videoTitle)
    const category = classified.category || categoryHint

    // 요약 생성 + 댓글 요약 병렬
    const [summary, reportSummary, ytCommentSummary] = await Promise.all([
      generateSummary(category, transcript || videoTitle, 'youtube'),
      generateReportSummary(category, videoTitle, transcript || videoTitle).catch(() => ''),
      generateYtCommentSummary(commentResult.popular),
    ])

    const contextSummary = await generateContextSummary(videoTitle, category, summary).catch(() => '')

    const ytCommentsContext = commentResult.popular.length > 0
      ? formatCommentsForPrompt(commentResult.popular, commentResult.recent).slice(0, 3000)
      : ''

    const sessionId = randomUUID()

    const square_meta = {
      topic_cluster: category,
      tags: [] as string[],
      channel,
      thumbnail,
      ytViewCount: viewCount,
    }

    await saveToSavedSummaries({
      userId: 'auto-collector',
      userDisplayName: 'SSOKTUBE 에디터',
      userPhotoURL: '',
      folderId: '',
      sessionId,
      videoId,
      title: videoTitle,
      channel,
      thumbnail,
      category,
      summary,
      contextSummary,
      reportSummary,
      ytCommentSummary,
      ytCommentsContext,
      square_meta,
      isPublic: true,
      transcript: transcript.slice(0, 5000),
      transcriptSource: transcriptResult.source,
      transcriptLang,
      ytViewCount: viewCount,
      videoPublishedAt: publishedAt,
      postedToMagazine: false,
      autoCollected: true,
    })

    console.log(`[AutoCollect] ✅ Saved: "${videoTitle}" (${category}) views=${viewCount}`)
    return { title: videoTitle, sessionId }
  } catch (e) {
    console.error(`[AutoCollect] ❌ Failed for ${videoId}:`, e)
    return null
  }
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const settings = await getCurationSettings().catch(() => null)
  if (!settings?.autoCollectEnabled) {
    return NextResponse.json({ skipped: true, reason: 'autoCollectEnabled=false' })
  }

  return runCollect()
}

export async function POST(req: NextRequest) {
  // 어드민 수동 트리거용 (force)
  const body = await req.json().catch(() => ({}))
  const { force } = body as { force?: boolean }
  if (!force) {
    return NextResponse.json({ error: 'force:true required' }, { status: 400 })
  }
  return runCollect()
}

async function runCollect() {
  const results: { category: string; title: string; videoId: string; sessionId?: string; status: 'success' | 'skip' | 'error' }[] = []

  // 이번 실행에서 수집할 카테고리 3개 — 시간 기반으로 로테이션
  const hour = new Date().getUTCHours()
  const offset = Math.floor(hour / 8) * 3
  const targets = CATEGORY_QUERIES.slice(offset % CATEGORY_QUERIES.length, offset % CATEGORY_QUERIES.length + 3)
    .concat(CATEGORY_QUERIES)
    .slice(0, 3)

  for (const target of targets) {
    try {
      // 1. 검색으로 후보 videoId 10개 수집
      const videoIds = await searchVideoIds(target.query, 10)

      // 2. 후보들의 duration + viewCount 조회 → 3분 이상만 남기고 인기순 정렬
      const candidates = await fetchQualifiedVideos(videoIds)
      console.log(`[AutoCollect] ${target.label}: ${candidates.length}/${videoIds.length} qualified (≥3min), top viewCount=${candidates[0]?.viewCount ?? 0}`)

      let collected = false
      for (const candidate of candidates) {
        const result = await collectAndSummarize(candidate, target.category)
        if (result) {
          results.push({ category: target.label, title: result.title, videoId: candidate.videoId, sessionId: result.sessionId, status: 'success' })
          collected = true
          break // 카테고리당 1개만
        }
      }

      if (!collected) {
        results.push({ category: target.label, title: '', videoId: '', status: 'skip' })
      }
    } catch (e) {
      results.push({ category: target.label, title: '', videoId: '', status: 'error' })
      console.error(`[AutoCollect] Category ${target.label} failed:`, e)
    }
  }

  const successCount = results.filter(r => r.status === 'success').length
  console.log(`[AutoCollect] Done: ${successCount}/${targets.length} collected`)

  return NextResponse.json({ success: true, collected: successCount, results })
}
