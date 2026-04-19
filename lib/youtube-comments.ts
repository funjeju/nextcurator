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

async function fetchComments(videoId: string, order: 'relevance' | 'time'): Promise<YTComment[]> {
  const key = process.env.YOUTUBE_API_KEY
  if (!key) return []

  try {
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/commentThreads?part=snippet&videoId=${videoId}&order=${order}&maxResults=30&key=${key}`,
      { next: { revalidate: 0 } }
    )
    if (!res.ok) return []
    const data = await res.json()
    if (!data.items) return []

    return data.items.map((item: any) => {
      const c = item.snippet.topLevelComment.snippet
      return {
        text: c.textDisplay?.replace(/<[^>]+>/g, '') ?? '',
        likes: c.likeCount ?? 0,
        author: c.authorDisplayName ?? '',
        publishedAt: c.publishedAt ?? '',
      }
    })
  } catch {
    return []
  }
}

export async function fetchVideoComments(videoId: string): Promise<{
  popular: YTComment[]
  recent: YTComment[]
  combined: YTComment[]
}> {
  const [popular, recent] = await Promise.all([
    fetchComments(videoId, 'relevance'),
    fetchComments(videoId, 'time'),
  ])

  // dedup by text
  const seen = new Set<string>()
  const combined: YTComment[] = []
  for (const c of [...popular, ...recent]) {
    const key = c.text.slice(0, 80)
    if (!seen.has(key)) { seen.add(key); combined.push(c) }
  }

  return { popular, recent, combined }
}

export function formatCommentsForPrompt(popular: YTComment[], recent: YTComment[]): string {
  const fmt = (c: YTComment) => `- [👍${c.likes}] ${c.text.slice(0, 200)}`
  return `[인기 댓글 TOP ${popular.length}개]
${popular.map(fmt).join('\n')}

[최신 댓글 ${recent.length}개]
${recent.map(fmt).join('\n')}`
}
