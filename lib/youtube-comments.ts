import { GoogleGenerativeAI } from '@google/generative-ai'

export interface YTComment {
  text: string
  likes: number
  author: string
  publishedAt: string
}

export interface CommentGroup {
  type: 'popular' | 'recent'
  summary: string
  highlights: { text: string; likes: number }[]
}

// ── Stage 1: 키워드 블록리스트 ────────────────────────────────────────────────
const BLOCKED_PATTERNS = [
  // 정치인
  '이재명', '윤석열', '한동훈', '김건희', '이준석', '조국', '문재인', '박근혜', '이낙연', '안철수', '홍준표',
  // 정당·정치 레이블
  '민주당', '국민의힘', '국힘', '더불어민주', '개혁신당',
  '빨갱이', '수꼴', '개딸', '친일파', '매국노',
  // 지역 혐오
  '홍어', '전라도놈', '경상도놈',
  // 성별·세대 혐오
  '틀딱', '맘충', '한남', '된장녀', '김치녀', '페미충',
  // 욕설
  '씨발', '개새끼', '병신', '지랄', '미친놈', '닥쳐', '꺼져',
]

function passesKeywordFilter(text: string): boolean {
  return !BLOCKED_PATTERNS.some(kw => text.includes(kw))
}

// ── Stage 2: Gemini AI 분류 ───────────────────────────────────────────────────
async function filterWithAI(comments: YTComment[]): Promise<YTComment[]> {
  if (!comments.length) return []
  try {
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY!)
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: { responseMimeType: 'application/json', temperature: 0 },
    })
    const items = comments.map((c, i) => `${i}|${c.text.slice(0, 120)}`).join('\n')
    const res = await model.generateContent(
      `아래 유튜브 댓글 중 정치적 발언, 혐오·차별, 욕설, 스팸에 해당하는 번호만 JSON 배열로 반환하세요.\n안전한 댓글 번호는 포함하지 마세요.\n{"blocked":[번호,...]}\n\n${items}`,
    )
    const raw = res.response.text()
    const { blocked = [] } = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] ?? '{}') as { blocked: number[] }
    const badSet = new Set(blocked)
    return comments.filter((_, i) => !badSet.has(i))
  } catch {
    return comments // Gemini 실패 시 Stage 1 결과 그대로 사용
  }
}

export async function fetchVideoComments(videoId: string): Promise<{
  popular: YTComment[]
  recent: YTComment[]
  combined: YTComment[]
}> {
  const key = process.env.SOCIALKIT_API_KEY
  if (!key) return { popular: [], recent: [], combined: [] }

  try {
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`
    const res = await fetch(
      `https://api.socialkit.dev/youtube/comments?url=${encodeURIComponent(videoUrl)}&limit=25`,
      {
        headers: { 'x-access-key': key },
        signal: AbortSignal.timeout(15000),
      }
    )
    if (!res.ok) return { popular: [], recent: [], combined: [] }

    const data = await res.json() as {
      success?: boolean
      data?: { comments?: Array<{ text: string; likes: number; author: string; date: string }> }
    }

    const raw = data.data?.comments ?? []
    const parsed: YTComment[] = raw.map(c => ({
      text: c.text?.replace(/<[^>]+>/g, '').trim() ?? '',
      likes: c.likes ?? 0,
      author: c.author ?? '',
      publishedAt: c.date ?? '',
    })).filter(c => c.text.length > 0)

    // Stage 1: 키워드 필터
    const stage1 = parsed.filter(c => passesKeywordFilter(c.text))

    // Stage 2: AI 필터 (정치·혐오·스팸 제거)
    const combined = await filterWithAI(stage1)

    // 인기순: likes 내림차순 top 15
    const popular = [...combined]
      .sort((a, b) => b.likes - a.likes)
      .slice(0, 15)

    // 최신순: date 내림차순 top 10
    const recent = [...combined]
      .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
      .slice(0, 10)

    return { popular, recent, combined }
  } catch {
    return { popular: [], recent: [], combined: [] }
  }
}

export function formatCommentsForPrompt(popular: YTComment[], recent: YTComment[]): string {
  const fmt = (c: YTComment) => `- [👍${c.likes}] ${c.text.slice(0, 200)}`
  return `[인기 댓글 TOP ${popular.length}개]
${popular.map(fmt).join('\n')}

[최신 댓글 ${recent.length}개]
${recent.map(fmt).join('\n')}`
}
