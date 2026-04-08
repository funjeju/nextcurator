/**
 * lib/transcript.ts
 * YouTube 자막 추출 파이프라인
 *
 * [1단계] SocialKit API → YouTube IP 차단 우회, 자막 없어도 STT 변환 (프로덕션)
 * [2단계] youtube-transcript npm → 로컬 개발환경 전용 폴백
 */

import { YoutubeTranscript } from 'youtube-transcript'

export interface TranscriptEntry {
  text: string
  offset: number
  duration: number
}

// ─────────────────────────────────────────────
// URL 파싱 유틸
// ─────────────────────────────────────────────
export function extractVideoId(url: string): string | null {
  const ID_PATTERN = /^[A-Za-z0-9_-]{11}$/

  try {
    const u = new URL(url.trim())

    if (u.hostname === 'youtu.be') {
      const id = u.pathname.slice(1).split('/')[0]
      if (ID_PATTERN.test(id)) return id
    }

    if (u.hostname.includes('youtube.com')) {
      const v = u.searchParams.get('v')
      if (v && ID_PATTERN.test(v)) return v

      const seg = u.pathname.split('/').filter(Boolean)
      const PREFIX = ['shorts', 'embed', 'live', 'v', 'e']
      if (seg.length >= 2 && PREFIX.includes(seg[0])) {
        const id = seg[1]
        if (ID_PATTERN.test(id)) return id
      }
    }
  } catch {
    // 파싱 실패 시 정규식 폴백
  }

  const fallback = url.match(/(?:v=|\/|%2F)([A-Za-z0-9_-]{11})(?:[^A-Za-z0-9_-]|$)/)
  return fallback ? fallback[1] : null
}

export function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

// ─────────────────────────────────────────────
// [1단계] Cloudflare Worker (프로덕션 메인)
// - YouTube IP 차단 우회, 자막 직접 추출
// ─────────────────────────────────────────────
async function getTranscriptViaCloudflare(videoId: string): Promise<string> {
  const workerUrl = process.env.CLOUDFLARE_WORKER_URL
  if (!workerUrl) throw new Error('CLOUDFLARE_WORKER_NOT_CONFIGURED')

  const res = await fetch(`${workerUrl}?videoId=${videoId}`, {
    signal: AbortSignal.timeout(15000),
  })

  if (!res.ok) {
    const errData = await res.json().catch(() => ({})) as { error?: string; details?: string[] }
    throw new Error(`CLOUDFLARE_${res.status}: ${errData.error || 'unknown'}`)
  }

  const data = await res.json() as { transcript?: string; error?: string }

  if (!data.transcript || data.transcript.trim().length < 10) {
    throw new Error('CLOUDFLARE_EMPTY_TRANSCRIPT')
  }

  return data.transcript.trim()
}

// ─────────────────────────────────────────────
// [2단계] Supadata API (CF Worker 실패 시 폴백)
// - 자동생성 자막 포함 폭넓은 커버리지
// ─────────────────────────────────────────────
async function getTranscriptViaSupadata(videoId: string): Promise<string> {
  const apiKey = process.env.SUPADATA_API_KEY
  if (!apiKey) throw new Error('SUPADATA_NOT_CONFIGURED')

  const res = await fetch(
    `https://api.supadata.ai/v1/youtube/transcript?videoId=${videoId}&text=false`,
    {
      headers: { 'x-api-key': apiKey },
      signal: AbortSignal.timeout(30000),
    }
  )

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`SUPADATA_${res.status}: ${errText.slice(0, 100)}`)
  }

  const data = await res.json() as {
    content?: Array<{ text: string; offset: number; duration: number; lang: string }>
    lang?: string
    availableLangs?: string[]
  }

  if (!data.content || data.content.length === 0) {
    throw new Error('SUPADATA_EMPTY_RESPONSE')
  }

  return data.content
    .map(s => {
      const ms = s.offset
      const mm = String(Math.floor(ms / 60000)).padStart(2, '0')
      const ss = String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')
      return `[${mm}:${ss}] ${s.text.replace(/\n/g, ' ').trim()}`
    })
    .filter(line => line.length > 8)
    .join('\n')
}

// ─────────────────────────────────────────────
// [3단계] SocialKit API (최종 폴백)
// - 자막 있는 영상: 자막 직접 추출
// - 자막 없는 영상: 오디오 다운로드 후 STT 변환
// - YouTube IP 차단 자체 우회 처리
// ─────────────────────────────────────────────
async function getTranscriptViaSocialKit(videoId: string): Promise<string> {
  const apiKey = process.env.SOCIALKIT_API_KEY
  if (!apiKey) throw new Error('SOCIALKIT_NOT_CONFIGURED')

  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`

  const res = await fetch(
    `https://api.socialkit.dev/youtube/transcript?url=${encodeURIComponent(videoUrl)}`,
    {
      headers: { 'x-access-key': apiKey },
      signal: AbortSignal.timeout(30000), // STT 변환은 최대 30초
    }
  )

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`SOCIALKIT_${res.status}: ${errText.slice(0, 100)}`)
  }

  const data = await res.json() as {
    success?: boolean
    data?: {
      transcript?: string
      transcriptSegments?: Array<{ text: string; start: number; duration: number; timestamp: string }>
      wordCount?: number
      segments?: number
    }
    error?: string
  }

  if (!data.success || !data.data) {
    throw new Error(`SOCIALKIT_FAILED: ${data.error || 'unknown'}`)
  }

  // transcriptSegments → 타임스탬프 포함 포맷으로 변환
  const segs = data.data.transcriptSegments
  if (segs && segs.length > 0) {
    return segs
      .map(s => `[${s.timestamp}] ${s.text.replace(/\n/g, ' ').trim()}`)
      .filter(line => line.length > 10)
      .join('\n')
  }

  // 세그먼트 없으면 full transcript 사용
  if (data.data.transcript && data.data.transcript.trim().length > 50) {
    return data.data.transcript.trim()
  }

  throw new Error('SOCIALKIT_EMPTY_RESPONSE')

}

// ─────────────────────────────────────────────
// [2단계] 로컬 개발용 폴백 (youtube-transcript npm)
// Vercel/프로덕션에서는 IP 차단으로 실패 예상
// ─────────────────────────────────────────────
async function getTranscriptLocal(videoId: string): Promise<string> {
  const langCodes = ['ko', 'en', 'ja', 'zh', 'es', 'fr', 'de']

  for (const lang of langCodes) {
    try {
      const entries: TranscriptEntry[] = await YoutubeTranscript.fetchTranscript(videoId, { lang })
      if (entries && entries.length > 0) {
        return entries
          .map(e => `[${formatTimestamp(e.offset / 1000)}] ${e.text}`)
          .join('\n')
      }
    } catch {
      // 다음 언어 시도
    }
  }

  // 언어 코드 없이 재시도
  try {
    const entries: TranscriptEntry[] = await YoutubeTranscript.fetchTranscript(videoId)
    if (entries && entries.length > 0) {
      return entries
        .map(e => `[${formatTimestamp(e.offset / 1000)}] ${e.text}`)
        .join('\n')
    }
  } catch {
    // 전부 실패
  }

  throw new Error('LOCAL_TRANSCRIPT_UNAVAILABLE')
}

// ─────────────────────────────────────────────
// 메인 함수: 환경에 따른 폴백 파이프라인
// ─────────────────────────────────────────────
export interface TranscriptResult {
  text: string
  source: string
}

export async function getTranscript(videoId: string): Promise<TranscriptResult> {
  const strategies: Array<{ name: string; fn: () => Promise<string> }> = []

  if (process.env.CLOUDFLARE_WORKER_URL) {
    strategies.push({
      name: 'Cloudflare Worker',
      fn: () => getTranscriptViaCloudflare(videoId),
    })
  }

  if (process.env.SUPADATA_API_KEY) {
    strategies.push({
      name: 'Supadata',
      fn: () => getTranscriptViaSupadata(videoId),
    })
  }

  if (process.env.SOCIALKIT_API_KEY) {
    strategies.push({
      name: 'SocialKit',
      fn: () => getTranscriptViaSocialKit(videoId),
    })
  }

  strategies.push({
    name: 'youtube-transcript (local)',
    fn: () => getTranscriptLocal(videoId),
  })

  const errors: string[] = []

  for (const strategy of strategies) {
    try {
      console.log(`[Transcript] Trying: ${strategy.name} for ${videoId}`)
      const text = await strategy.fn()
      console.log(`[Transcript] ✅ Success: ${strategy.name}`)
      return { text, source: strategy.name }
    } catch (e) {
      const msg = (e as Error).message
      console.warn(`[Transcript] ❌ Failed (${strategy.name}): ${msg}`)
      errors.push(`${strategy.name}: ${msg}`)
    }
  }

  console.error('[Transcript] All strategies failed:', errors)
  throw new Error('TRANSCRIPT_UNAVAILABLE')
}

// ─────────────────────────────────────────────
// 비디오 메타데이터 (설명 + 댓글)
// ─────────────────────────────────────────────
export interface VideoMeta {
  description: string
  pinnedComment: string
}

export async function getVideoMeta(videoId: string): Promise<VideoMeta> {
  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) return { description: '', pinnedComment: '' }

  try {
    const videoRes = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=snippet&key=${apiKey}`
    )
    const videoData = await videoRes.json() as {
      items?: Array<{ snippet: { description: string } }>
    }
    const description: string = videoData.items?.[0]?.snippet?.description ?? ''

    const commentRes = await fetch(
      `https://www.googleapis.com/youtube/v3/commentThreads?videoId=${videoId}&part=snippet&order=relevance&maxResults=5&key=${apiKey}`
    )
    const commentData = await commentRes.json() as {
      items?: Array<{ snippet: { topLevelComment: { snippet: { textDisplay: string } } } }>
    }
    const comments: string[] = (commentData.items ?? []).map(
      item => item.snippet.topLevelComment.snippet.textDisplay
    )
    const pinnedComment = comments.slice(0, 3).join('\n---\n')

    return {
      description: description.slice(0, 2000),
      pinnedComment: pinnedComment.slice(0, 1000),
    }
  } catch {
    return { description: '', pinnedComment: '' }
  }
}
