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
    const combined: YTComment[] = raw.map(c => ({
      text: c.text?.replace(/<[^>]+>/g, '').trim() ?? '',
      likes: c.likes ?? 0,
      author: c.author ?? '',
      publishedAt: c.date ?? '',
    })).filter(c => c.text.length > 0)

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
