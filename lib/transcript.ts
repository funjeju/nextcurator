/**
 * lib/transcript.ts
 * YouTube 자막 추출 파이프라인
 *
 * [1단계] Cloudflare Worker — YouTube watch 페이지에서 공식/자동 자막 무료 추출
 * [2단계] SocialKit (STT) — 자막 없거나 CF Worker 실패 시 Whisper STT 변환 (유료)
 * [3단계] youtube-transcript npm — 로컬 개발환경 전용 폴백
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

// 자막 텍스트에서 언어 감지 (타임스탬프·숫자·공백 제거 후 문자 비율로 판단)
export function detectTranscriptLang(text: string): 'ko' | 'en' | 'other' {
  const stripped = text.replace(/\[[^\]]*\]|\d+[:.\s]/g, '').replace(/\s+/g, '')
  if (!stripped) return 'other'
  const korean = (stripped.match(/[\uAC00-\uD7AF\u1100-\u11FF]/g) || []).length
  const latin  = (stripped.match(/[A-Za-z]/g) || []).length
  if (korean / stripped.length > 0.15) return 'ko'
  if (latin  / stripped.length > 0.4)  return 'en'
  return 'other'
}

// ─────────────────────────────────────────────
// [1단계] Cloudflare Worker (프로덕션 메인, 무료)
// - YouTube watch 페이지 직접 스크래핑으로 공식/자동 자막 추출
// - 자막 없으면 NO_CAPTIONS(404) 반환 → SocialKit STT로 넘김
// ─────────────────────────────────────────────
async function getTranscriptViaCloudflare(videoId: string): Promise<string> {
  const workerUrl = process.env.CLOUDFLARE_WORKER_URL
  if (!workerUrl) throw new Error('CLOUDFLARE_WORKER_NOT_CONFIGURED')

  const res = await fetch(`${workerUrl}?videoId=${videoId}`, {
    signal: AbortSignal.timeout(35000), // watch 페이지 스크래핑만 하므로 35초면 충분
  })

  if (!res.ok) {
    const errData = await res.json().catch(() => ({})) as { error?: string }
    const code = errData.error || 'unknown'
    // NO_CAPTIONS: 자막 트랙 자체가 없는 영상 → SocialKit STT 필요
    // FETCH_FAILED: YouTube 일시적 접근 실패 → SocialKit 폴백
    throw new Error(`CLOUDFLARE_${code}`)
  }

  const data = await res.json() as { transcript?: string }

  if (!data.transcript || data.transcript.trim().length < 10) {
    throw new Error('CLOUDFLARE_EMPTY_TRANSCRIPT')
  }

  return data.transcript.trim()
}

// ─────────────────────────────────────────────
// [2단계] SocialKit API (유료 폴백)
// - 자막 없는 영상: 오디오 다운로드 후 Whisper STT 변환
// - 자막 있는 영상: 자막 직접 추출 (CF Worker 실패 시 보조)
// ─────────────────────────────────────────────
async function getTranscriptViaSocialKit(videoId: string): Promise<string> {
  const apiKey = process.env.SOCIALKIT_API_KEY
  if (!apiKey) throw new Error('SOCIALKIT_NOT_CONFIGURED')

  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`

  const res = await fetch(
    `https://api.socialkit.dev/youtube/transcript?url=${encodeURIComponent(videoUrl)}`,
    {
      headers: { 'x-access-key': apiKey },
      signal: AbortSignal.timeout(90000),  // STT 변환 시간을 충분히 확보
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
// 메인 함수: CF Worker(무료) → SocialKit STT(유료) 2단계 파이프라인
// ─────────────────────────────────────────────
export interface TranscriptResult {
  text: string
  source: string
  lang: 'ko' | 'en' | 'other'
}

export async function getTranscript(videoId: string): Promise<TranscriptResult> {
  const errors: string[] = []

  // ── 1단계: Cloudflare Worker (자막 있는 영상 → 무료) ──
  if (process.env.CLOUDFLARE_WORKER_URL) {
    try {
      console.log(`[Transcript] Trying: Cloudflare Worker for ${videoId}`)
      const text = await getTranscriptViaCloudflare(videoId)
      console.log('[Transcript] ✅ Cloudflare Worker 성공')
      return { text, source: 'Cloudflare Worker', lang: detectTranscriptLang(text) }
    } catch (e) {
      const msg = (e as Error).message
      console.warn(`[Transcript] ❌ Cloudflare Worker 실패: ${msg}`)
      errors.push(`Cloudflare Worker: ${msg}`)
      // NO_CAPTIONS면 자막 없는 영상임을 로그로 명시
      if (msg === 'CLOUDFLARE_NO_CAPTIONS') {
        console.log('[Transcript] 자막 없는 영상 → SocialKit STT로 처리')
      }
    }
  }

  // ── 2단계: SocialKit (자막 없거나 CF Worker 실패 → 유료 STT) ──
  if (process.env.SOCIALKIT_API_KEY) {
    try {
      console.log(`[Transcript] Trying: SocialKit STT for ${videoId}`)
      const text = await getTranscriptViaSocialKit(videoId)
      console.log('[Transcript] ✅ SocialKit 성공')
      return { text, source: 'SocialKit', lang: detectTranscriptLang(text) }
    } catch (e) {
      const msg = (e as Error).message
      console.warn(`[Transcript] ❌ SocialKit 실패: ${msg}`)
      errors.push(`SocialKit: ${msg}`)
    }
  }

  // ── 3단계: 로컬 개발 폴백 (프로덕션에서는 IP 차단으로 실패 예상) ──
  try {
    console.log(`[Transcript] Trying: youtube-transcript (local) for ${videoId}`)
    const text = await getTranscriptLocal(videoId)
    console.log('[Transcript] ✅ Local 성공')
    return { text, source: 'youtube-transcript (local)', lang: detectTranscriptLang(text) }
  } catch (e) {
    errors.push(`local: ${(e as Error).message}`)
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
