import { YoutubeTranscript } from 'youtube-transcript'

export interface TranscriptEntry {
  text: string
  offset: number
  duration: number
}

export function extractVideoId(url: string): string | null {
  // YouTube video ID는 항상 11자리 [A-Za-z0-9_-]
  const ID_PATTERN = /^[A-Za-z0-9_-]{11}$/

  try {
    const u = new URL(url.trim())

    // 1. youtu.be/VIDEO_ID (단축 URL)
    if (u.hostname === 'youtu.be') {
      const id = u.pathname.slice(1).split('/')[0]
      if (ID_PATTERN.test(id)) return id
    }

    if (u.hostname.includes('youtube.com')) {
      // 2. ?v=VIDEO_ID (일반, 재생목록 포함)
      const v = u.searchParams.get('v')
      if (v && ID_PATTERN.test(v)) return v

      const seg = u.pathname.split('/').filter(Boolean)

      // 3. /shorts/VIDEO_ID
      // 4. /embed/VIDEO_ID
      // 5. /live/VIDEO_ID
      // 6. /v/VIDEO_ID
      const PREFIX = ['shorts', 'embed', 'live', 'v', 'e']
      if (seg.length >= 2 && PREFIX.includes(seg[0])) {
        const id = seg[1]
        if (ID_PATTERN.test(id)) return id
      }
    }
  } catch {
    // URL 파싱 실패 시 정규식으로 폴백
  }

  // 폴백: URL 어디서든 11자리 ID 추출
  const fallback = url.match(/(?:v=|\/|%2F)([A-Za-z0-9_-]{11})(?:[^A-Za-z0-9_-]|$)/)
  return fallback ? fallback[1] : null
}

export function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

export async function getTranscript(videoId: string): Promise<string> {
  const langCodes = ['ko', 'en', 'ja', 'zh', 'es', 'fr', 'de']

  // 공식 자막 + 자동 자막 모두 순차적으로 시도
  for (const lang of langCodes) {
    try {
      const entries: TranscriptEntry[] = await YoutubeTranscript.fetchTranscript(videoId, { lang })
      if (entries && entries.length > 0) {
        return entries
          .map(e => `[${formatTimestamp(e.offset / 1000)}] ${e.text}`)
          .join('\n')
      }
    } catch {
      // 해당 언어 코드 실패 시 다음 언어 시도
    }
  }

  // 마지막으로 언어 코드 없이 시도 (자동 자막 포함 모든 자막)
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

  throw new Error('TRANSCRIPT_UNAVAILABLE')
}

export interface VideoMeta {
  description: string
  pinnedComment: string
}

export async function getVideoMeta(videoId: string): Promise<VideoMeta> {
  const apiKey = process.env.YOUTUBE_API_KEY
  if (!apiKey) return { description: '', pinnedComment: '' }

  try {
    // 영상 설명 가져오기
    const videoRes = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=snippet&key=${apiKey}`
    )
    const videoData = await videoRes.json()
    const description: string = videoData.items?.[0]?.snippet?.description ?? ''

    // 고정댓글 포함 상위 댓글 가져오기 (relevance 순 = 고정댓글 우선)
    const commentRes = await fetch(
      `https://www.googleapis.com/youtube/v3/commentThreads?videoId=${videoId}&part=snippet&order=relevance&maxResults=5&key=${apiKey}`
    )
    const commentData = await commentRes.json()
    const comments: string[] = (commentData.items ?? []).map(
      (item: { snippet: { topLevelComment: { snippet: { textDisplay: string } } } }) =>
        item.snippet.topLevelComment.snippet.textDisplay
    )
    const pinnedComment = comments.slice(0, 3).join('\n---\n')

    return { description: description.slice(0, 2000), pinnedComment: pinnedComment.slice(0, 1000) }
  } catch {
    return { description: '', pinnedComment: '' }
  }
}
