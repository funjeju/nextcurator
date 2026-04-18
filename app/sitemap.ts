import { MetadataRoute } from 'next'
import { getPublishedPosts } from '@/lib/magazine'

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!
const API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY!

async function getPublicSessionIds(): Promise<{ sessionId: string; updatedAt?: string }[]> {
  try {
    // Firestore REST: summaries 컬렉션에서 isPublic=true인 문서의 sessionId만 조회
    const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:runQuery?key=${API_KEY}`
    const body = {
      structuredQuery: {
        from: [{ collectionId: 'summaries' }],
        where: {
          fieldFilter: {
            field: { fieldPath: 'isPublic' },
            op: 'EQUAL',
            value: { booleanValue: true },
          },
        },
        select: {
          fields: [
            { fieldPath: 'sessionId' },
            { fieldPath: 'summarizedAt' },
          ],
        },
        limit: 500,
      },
    }
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      next: { revalidate: 3600 },
    })
    if (!res.ok) return []
    const docs = await res.json() as { document?: { fields?: Record<string, { stringValue?: string }> } }[]
    return docs
      .filter(d => d.document?.fields?.sessionId?.stringValue)
      .map(d => ({
        sessionId: d.document!.fields!.sessionId.stringValue!,
        updatedAt: d.document!.fields?.summarizedAt?.stringValue,
      }))
  } catch {
    return []
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: 'https://ssoktube.com',
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: 'https://ssoktube.com/square',
      lastModified: new Date(),
      changeFrequency: 'hourly',
      priority: 0.9,
    },
  ]

  const [sessions, magazinePosts] = await Promise.all([
    getPublicSessionIds(),
    getPublishedPosts(200),
  ])

  const resultRoutes: MetadataRoute.Sitemap = sessions.map(({ sessionId, updatedAt }) => ({
    url: `https://ssoktube.com/result/${sessionId}`,
    lastModified: updatedAt ? new Date(updatedAt) : new Date(),
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }))

  const magazineRoutes: MetadataRoute.Sitemap = magazinePosts.map(post => ({
    url: `https://ssoktube.com/magazine/${post.slug}`,
    lastModified: post.publishedAt ? new Date(post.publishedAt) : new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.85,  // 매거진 포스트는 result보다 높은 우선순위
  }))

  return [...staticRoutes, ...magazineRoutes, ...resultRoutes]
}
