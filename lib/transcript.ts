/**
 * lib/transcript.ts
 * YouTube 자막 추출 파이프라인
 *
 * [1단계] Cloudflare Worker — watch 페이지 파싱 + InnerTube API (무료, 1-2초)
 *   - NO_CAPTIONS(404) 반환 시: 자막 자체 없음 → SocialKit STT로 점프
 *   - FETCH_FAILED(502) 반환 시: CF 접근 실패 → SocialKit 시도
 * [2단계] SocialKit — CF 실패 시 폴백 + 자막 없는 영상 Whisper STT (유료)
 * [3단계] Gemini STT — 최후 수단 (고비용)
 * [4단계] youtube-transcript npm — 로컬 개발환경 전용 폴백
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
// [1단계] Cloudflare Worker
// - InnerTube API → watch 페이지 파싱 2단계 내부 전략
// - NO_CAPTIONS: 자막 트랙 없음 (STT 필요 신호)
// - FETCH_FAILED: YouTube 접근 실패 → SocialKit 폴백
// ─────────────────────────────────────────────
async function getTranscriptViaCFWorker(videoId: string): Promise<{ text: string; noCaption?: boolean }> {
  const workerUrl = process.env.CLOUDFLARE_WORKER_URL
  if (!workerUrl) throw new Error('CF_WORKER_NOT_CONFIGURED')

  const res = await fetch(`${workerUrl}?videoId=${videoId}`, {
    signal: AbortSignal.timeout(20000),
  })

  const data = await res.json() as { transcript?: string; error?: string; details?: unknown }

  if (res.status === 404 && data.error === 'NO_CAPTIONS') {
    // 자막 트랙 자체 없음 — SocialKit STT로 바로 넘어가야 함
    const err = new Error('CF_NO_CAPTIONS') as Error & { noCaption: boolean }
    err.noCaption = true
    throw err
  }

  if (!res.ok || !data.transcript) {
    throw new Error(`CF_FAILED: ${data.error ?? res.status}`)
  }

  return { text: data.transcript }
}

// ─────────────────────────────────────────────
// [2단계] SocialKit API
// - 자막 있는 영상: 자막 직접 추출
// - 자막 없는 영상: 오디오 다운로드 후 Whisper STT 변환
// ─────────────────────────────────────────────
async function getTranscriptViaSocialKit(videoId: string): Promise<string> {
  const apiKey = process.env.SOCIALKIT_API_KEY
  if (!apiKey) throw new Error('SOCIALKIT_NOT_CONFIGURED')

  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`

  const startTime = Date.now()

  const res = await fetch(
    `https://api.socialkit.dev/youtube/transcript?url=${encodeURIComponent(videoUrl)}`,
    {
      headers: { 'x-access-key': apiKey },
      signal: AbortSignal.timeout(180000),  // 3분 — STT 긴 영상 대응 (Vercel 300s 중 AI 요약에 120s 확보)
    }
  )

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    console.warn(`[SocialKit] ❌ HTTP ${res.status} (${elapsed}s): ${errText.slice(0, 200)}`)
    throw new Error(`SOCIALKIT_${res.status}: ${errText.slice(0, 100)}`)
  }

  const data = await res.json() as {
    success?: boolean
    data?: {
      transcript?: string
      transcriptSegments?: Array<{ text: string; start: number; duration: number; timestamp: string }>
      wordCount?: number
      segments?: number
      method?: string       // SocialKit이 어떤 방식 사용했는지 (있을 수도 있음)
      language?: string
    }
    error?: string
    message?: string
  }

  // STT vs 자막 구분 추적 로그 (테스트용)
  console.log(`[SocialKit] 응답 (${elapsed}s):`, JSON.stringify({
    success: data.success,
    error: data.error,
    message: data.message,
    wordCount: data.data?.wordCount,
    segments: data.data?.segments,
    method: data.data?.method,
    language: data.data?.language,
    hasTranscriptSegments: !!(data.data?.transcriptSegments?.length),
    hasTranscript: !!(data.data?.transcript?.length),
    transcriptPreview: data.data?.transcript?.slice(0, 100),
  }))

  if (!data.success || !data.data) {
    throw new Error(`SOCIALKIT_FAILED: ${data.error || data.message || 'unknown'}`)
  }

  // transcriptSegments → 타임스탬프 포함 포맷으로 변환
  const segs = data.data.transcriptSegments
  if (segs && segs.length > 0) {
    console.log(`[SocialKit] ✅ 세그먼트 ${segs.length}개 추출 완료 (${elapsed}s)`)
    return segs
      .map(s => `[${s.timestamp}] ${s.text.replace(/\n/g, ' ').trim()}`)
      .filter(line => line.length > 10)
      .join('\n')
  }

  // 세그먼트 없으면 full transcript 사용
  if (data.data.transcript && data.data.transcript.trim().length > 50) {
    console.log(`[SocialKit] ✅ full transcript 사용 (${elapsed}s, ${data.data.transcript.length}자)`)
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

async function getTranscriptViaGemini(videoId: string): Promise<string> {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY
  if (!apiKey) throw new Error('GEMINI_NOT_CONFIGURED')

  const { GoogleGenerativeAI } = await import('@google/generative-ai')
  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: { temperature: 0, maxOutputTokens: 8192 },
  })

  const result = await model.generateContent([
    {
      fileData: {
        mimeType: 'video/*',
        fileUri: `https://www.youtube.com/watch?v=${videoId}`,
      },
    },
    {
      text: `이 영상의 음성 내용을 타임스탬프와 함께 전사해줘.
형식: [MM:SS] 내용
- 대화나 해설이 없는 무음 구간은 건너뜀
- 원본 언어 그대로 전사 (번역 금지)
- 최대한 상세하게`,
    },
  ])

  const text = result.response.text().trim()
  if (!text || text.length < 30) throw new Error('GEMINI_EMPTY_RESPONSE')
  return text
}

export async function getTranscript(videoId: string): Promise<TranscriptResult> {
  const errors: string[] = []
  let skipToSTT = false  // CF에서 NO_CAPTIONS 확인 → SocialKit 자막 시도 스킵

  // ── 1단계: Cloudflare Worker (무료, 1-2초) ──
  if (process.env.CLOUDFLARE_WORKER_URL) {
    try {
      console.log(`[Transcript] Trying: CF Worker for ${videoId}`)
      const { text } = await getTranscriptViaCFWorker(videoId)
      console.log(`[Transcript] ✅ CF Worker 성공 (${text.length}자)`)
      return { text, source: 'CF Worker', lang: detectTranscriptLang(text) }
    } catch (e) {
      const err = e as Error & { noCaption?: boolean }
      const msg = err.message
      if (err.noCaption) {
        console.log(`[Transcript] CF Worker: NO_CAPTIONS → STT 경로로`)
        skipToSTT = true
      } else {
        console.warn(`[Transcript] ❌ CF Worker 실패: ${msg}`)
      }
      errors.push(`CF: ${msg}`)
    }
  }

  // ── 2단계: SocialKit (CF 실패 시 폴백 + STT) ──
  // skipToSTT=true면 자막 없음 확인됨 → SocialKit STT로 처리 (자막 추출 재시도 불필요)
  if (process.env.SOCIALKIT_API_KEY) {
    try {
      console.log(`[Transcript] Trying: SocialKit${skipToSTT ? ' (STT mode)' : ''} for ${videoId}`)
      const text = await getTranscriptViaSocialKit(videoId)
      console.log('[Transcript] ✅ SocialKit 성공')
      return { text, source: 'SocialKit', lang: detectTranscriptLang(text) }
    } catch (e) {
      const msg = (e as Error).message
      console.warn(`[Transcript] ❌ SocialKit 실패: ${msg}`)
      errors.push(`SocialKit: ${msg}`)
    }
  }

  // ── 3단계: Gemini STT 폴백 ──
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    try {
      console.log(`[Transcript] Trying: Gemini STT for ${videoId}`)
      const text = await getTranscriptViaGemini(videoId)
      console.log(`[Transcript] ✅ Gemini STT 성공 (${text.length}자)`)
      return { text, source: 'Gemini STT', lang: detectTranscriptLang(text) }
    } catch (e) {
      const msg = (e as Error).message
      console.error(`[Transcript] ❌ Gemini STT 실패: ${msg}`)
      errors.push(`Gemini: ${msg}`)
    }
  }

  // ── 4단계: 로컬 개발 폴백 ──
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
  const socialkitKey = process.env.SOCIALKIT_API_KEY
  if (!socialkitKey) return { description: '', pinnedComment: '' }

  // SocialKit comments — 상위 댓글 (고정댓글 포함)
  let pinnedComment = ''
  try {
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`
    const commentRes = await fetch(
      `https://api.socialkit.dev/youtube/comments?url=${encodeURIComponent(videoUrl)}&limit=5`,
      { headers: { 'x-access-key': socialkitKey }, signal: AbortSignal.timeout(10000) }
    )
    if (commentRes.ok) {
      const commentData = await commentRes.json() as {
        data?: { comments?: Array<{ text: string; likes: number }> }
      }
      const comments = (commentData.data?.comments ?? [])
        .map(c => c.text?.replace(/<[^>]+>/g, '').trim() ?? '')
        .filter(t => t.length > 0)
        .slice(0, 3)
      pinnedComment = comments.join('\n---\n')
    }
  } catch { /* ignore */ }

  return {
    description: '',  // description은 getVideoInfo(youtube/stats)에서 가져옴
    pinnedComment: pinnedComment.slice(0, 1000),
  }
}
