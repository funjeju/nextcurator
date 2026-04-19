import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { getTranscript, detectTranscriptLang } from '@/lib/transcript'
import { classifyCategory, generateSummary, generateReportSummary, generateContextSummary } from '@/lib/claude'
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

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return req.headers.get('authorization') === `Bearer ${secret}`
}

// YouTube Data API로 카테고리별 핫한 영상 조회
async function searchHotVideos(query: string, maxResults = 3): Promise<string[]> {
  const url = new URL('https://www.googleapis.com/youtube/v3/search')
  url.searchParams.set('part', 'snippet')
  url.searchParams.set('q', query)
  url.searchParams.set('maxResults', String(maxResults + 2))
  url.searchParams.set('key', YOUTUBE_API_KEY)

  console.log('[AutoCollect] YouTube search URL (key redacted):', url.toString().replace(YOUTUBE_API_KEY, 'REDACTED'))

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(10000) })
  if (!res.ok) {
    const errBody = await res.text().catch(() => '(empty)')
    throw new Error(`YouTube search failed: ${res.status} | ${errBody}`)
  }

  const data = await res.json() as { items?: { id?: { videoId?: string } }[] }
  return (data.items ?? [])
    .map(item => item.id?.videoId ?? '')
    .filter(Boolean)
    .slice(0, maxResults)
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

// YouTube oEmbed로 영상 기본 정보 조회
async function getVideoBasicInfo(videoId: string): Promise<{ title: string; channel: string; thumbnail: string }> {
  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`
  const res = await fetch(
    `https://www.youtube.com/oembed?url=${encodeURIComponent(videoUrl)}&format=json`,
    { signal: AbortSignal.timeout(5000) }
  )
  if (!res.ok) throw new Error(`oEmbed failed for ${videoId}`)
  const data = await res.json()
  return {
    title: data.title as string,
    channel: data.author_name as string,
    thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
  }
}

// 영상 조회수 조회
async function getVideoStats(videoId: string): Promise<{ viewCount: number; publishedAt: string }> {
  const url = new URL('https://www.googleapis.com/youtube/v3/videos')
  url.searchParams.set('part', 'statistics,snippet')
  url.searchParams.set('id', videoId)
  url.searchParams.set('key', YOUTUBE_API_KEY)

  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(8000) })
  if (!res.ok) return { viewCount: 0, publishedAt: '' }
  const data = await res.json() as { items?: { statistics?: { viewCount?: string }; snippet?: { publishedAt?: string } }[] }
  const item = data.items?.[0]
  return {
    viewCount: Number(item?.statistics?.viewCount ?? 0),
    publishedAt: item?.snippet?.publishedAt ?? '',
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

// 영상 1개 자동 수집·요약·저장
async function collectAndSummarize(videoId: string, categoryHint: string): Promise<{ title: string } | null> {
  try {
    const alreadyDone = await isAlreadyCollected(videoId)
    if (alreadyDone) {
      console.log(`[AutoCollect] Skip (already collected): ${videoId}`)
      return null
    }

    const [basicInfo, stats, transcriptResult] = await Promise.all([
      getVideoBasicInfo(videoId),
      getVideoStats(videoId),
      getTranscript(videoId).catch(() => ({ text: '', source: 'none', lang: 'ko' as const })),
    ])

    const transcript = transcriptResult.text
    const transcriptLang = detectTranscriptLang(transcript)

    // 카테고리 분류
    const classified = await classifyCategory(transcript || basicInfo.title)
    const category = classified.category || categoryHint

    // 요약 생성
    const [summary, reportSummary] = await Promise.all([
      generateSummary(category, transcript || basicInfo.title, 'youtube'),
      generateReportSummary(category, basicInfo.title, transcript || basicInfo.title).catch(() => ''),
    ])

    const contextSummary = await generateContextSummary(basicInfo.title, category, summary).catch(() => '')

    const sessionId = randomUUID()

    const square_meta = {
      topic_cluster: category,
      tags: [] as string[],
      channel: basicInfo.channel,
      thumbnail: basicInfo.thumbnail,
      ytViewCount: stats.viewCount,
    }

    await saveToSavedSummaries({
      userId: 'auto-collector',
      userDisplayName: 'SSOKTUBE 에디터',
      userPhotoURL: '',
      folderId: '',
      sessionId,
      videoId,
      title: basicInfo.title,
      channel: basicInfo.channel,
      thumbnail: basicInfo.thumbnail,
      category,
      summary,
      contextSummary,
      reportSummary,
      square_meta,
      isPublic: true,
      transcript: transcript.slice(0, 5000),
      transcriptSource: transcriptResult.source,
      transcriptLang,
      ytViewCount: stats.viewCount,
      videoPublishedAt: stats.publishedAt,
      postedToMagazine: false,
      autoCollected: true,
    })

    console.log(`[AutoCollect] ✅ Saved: "${basicInfo.title}" (${category})`)
    return { title: basicInfo.title }
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
  const results: { category: string; title: string; videoId: string; status: 'success' | 'skip' | 'error' }[] = []

  // 이번 실행에서 수집할 카테고리 3개 — 시간 기반으로 로테이션
  const hour = new Date().getUTCHours()
  const offset = Math.floor(hour / 8) * 3 // 0~2 / 3~5 인덱스
  const targets = CATEGORY_QUERIES.slice(offset % CATEGORY_QUERIES.length, offset % CATEGORY_QUERIES.length + 3)
    .concat(CATEGORY_QUERIES) // 경계 넘을 경우 wrap
    .slice(0, 3)

  for (const target of targets) {
    try {
      const videoIds = await searchHotVideos(target.query, 3)
      let collected = false

      for (const videoId of videoIds) {
        const result = await collectAndSummarize(videoId, target.category)
        if (result) {
          results.push({ category: target.label, title: result.title, videoId, status: 'success' })
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
