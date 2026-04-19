import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY!)

const magazineModel = genAI.getGenerativeModel({
  model: 'gemini-2.5-flash',
  systemInstruction: 'You are a JSON generator. Always respond with valid JSON only. No explanation, no markdown code fences. Start with { and end with }. All string values must be properly JSON-escaped.',
  generationConfig: {
    temperature: 0.55,
    maxOutputTokens: 8192,
    // @ts-expect-error thinkingConfig not in types
    thinkingConfig: { thinkingBudget: 0 },
    responseMimeType: 'application/json',
  },
})

// ─── Types ─────────────────────────────────────────────────────────────────

export interface CuratedPost {
  id: string
  slug: string
  title: string
  subtitle: string
  heroThumbnail: string
  category: string
  tags: string[]
  summaryIds: string[]       // Firestore doc IDs of included summaries
  videoTitles: string[]      // For display without re-fetching
  body: string               // Full markdown article
  seoDescription: string     // 150-char Google snippet
  seoKeywords: string[]
  faq?: { question: string; answer: string }[]
  checklist?: string[]
  comments?: { popular_summary: string; popular_highlights: { text: string; likes: number }[]; recent_summary: string; recent_highlights: { text: string; likes: number }[] }
  readTime: number           // Estimated minutes
  status: 'draft' | 'published'
  publishedAt: string
  createdAt: string
  viewCount: number
  likeCount: number
  topicCluster: string
}

export type CurationSchedule = '3x_daily' | '2x_daily' | '1x_daily' | '3x_weekly' | '1x_weekly' | 'manual'

export interface CurationSettings {
  enabled: boolean
  schedule: CurationSchedule
  dailyLimit: 1 | 2 | 3    // 하루 최대 발행 수
  lookbackDays: number      // 최근 N일 영상 기준
  lastGeneratedAt: string
  autoPublish: boolean      // false = 초안으로 저장
  categoryFilter: string[]  // 빈 배열 = 전체 카테고리
}

export interface MagazineLog {
  id: string
  postId?: string
  postTitle?: string
  videoTitle?: string
  videoId?: string
  status: 'success' | 'error' | 'skipped'
  triggerType: 'cron' | 'manual'
  reason?: string
  error?: string
  createdAt: string
}

export interface SummaryForCuration {
  id: string
  sessionId: string
  videoId: string
  title: string
  channel: string
  thumbnail: string
  category: string
  topicCluster: string
  tags: string[]
  contextSummary: string
  reportSummary: string
  summarizedAt: string
  videoPublishedAt: string
  ytViewCount: number
  postedToMagazine?: boolean
}

// ─── Firestore REST helpers ─────────────────────────────────────────────────

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!
const API_KEY    = process.env.NEXT_PUBLIC_FIREBASE_API_KEY!
const BASE       = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`

type FSField = {
  stringValue?: string; integerValue?: string; booleanValue?: boolean
  nullValue?: null
  arrayValue?: { values?: FSField[] }
  mapValue?: { fields?: Record<string, FSField> }
  doubleValue?: number
}

function toFV(v: unknown): FSField {
  if (v === null || v === undefined) return { nullValue: null }
  if (typeof v === 'string')  return { stringValue: v }
  if (typeof v === 'number')  return { integerValue: String(v) }
  if (typeof v === 'boolean') return { booleanValue: v }
  if (Array.isArray(v))       return { arrayValue: { values: v.map(toFV) } }
  if (typeof v === 'object') {
    const fields: Record<string, FSField> = {}
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) fields[k] = toFV(val)
    return { mapValue: { fields } }
  }
  return { stringValue: String(v) }
}

function toFields(obj: Record<string, unknown>): Record<string, FSField> {
  const fields: Record<string, FSField> = {}
  for (const [k, v] of Object.entries(obj)) fields[k] = toFV(v)
  return fields
}

function fromFV(v: FSField): unknown {
  if ('stringValue'  in v) return v.stringValue
  if ('integerValue' in v) return Number(v.integerValue)
  if ('doubleValue'  in v) return v.doubleValue
  if ('booleanValue' in v) return v.booleanValue
  if ('nullValue'    in v) return null
  if ('arrayValue'   in v) return (v.arrayValue?.values ?? []).map(fromFV)
  if ('mapValue'     in v) {
    const f = v.mapValue?.fields ?? {}
    const out: Record<string, unknown> = {}
    for (const [k, val] of Object.entries(f)) out[k] = fromFV(val)
    return out
  }
  return null
}

function fromFields(fields: Record<string, FSField>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(fields)) out[k] = fromFV(v)
  return out
}

async function fsGet(path: string) {
  const res = await fetch(`${BASE}/${path}?key=${API_KEY}`)
  if (!res.ok) return null
  const doc = await res.json()
  if (!doc.fields) return null
  return fromFields(doc.fields as Record<string, FSField>)
}

async function fsPatch(path: string, data: Record<string, unknown>) {
  return fetch(`${BASE}/${path}?key=${API_KEY}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: toFields(data) }),
  })
}

async function fsQuery(collectionId: string, body: unknown): Promise<{ id: string; data: Record<string, unknown> }[]> {
  const res = await fetch(`${BASE}:runQuery?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ structuredQuery: { from: [{ collectionId }], ...body as object } }),
  })
  if (!res.ok) return []
  const docs = await res.json() as { document?: { name?: string; fields?: Record<string, FSField> } }[]
  return docs
    .filter(d => d.document?.fields)
    .map(d => ({
      id: d.document!.name!.split('/').pop()!,
      data: fromFields(d.document!.fields!),
    }))
}

// ─── Settings ───────────────────────────────────────────────────────────────

const SETTINGS_DEFAULTS: CurationSettings = {
  enabled: false,
  schedule: '1x_daily',
  dailyLimit: 1,
  lookbackDays: 5,
  lastGeneratedAt: '',
  autoPublish: false,
  categoryFilter: [],
}

export async function getCurationSettings(): Promise<CurationSettings> {
  try {
    const data = await fsGet('settings/curation')
    if (!data) return { ...SETTINGS_DEFAULTS }
    return { ...SETTINGS_DEFAULTS, ...data } as CurationSettings
  } catch {
    return { ...SETTINGS_DEFAULTS }
  }
}

export async function saveCurationSettings(settings: Partial<CurationSettings>) {
  await fsPatch('settings/curation', settings as Record<string, unknown>)
}

// ─── Summaries for curation ──────────────────────────────────────────────────

export async function getRecentPublicSummaries(lookbackDays: number): Promise<SummaryForCuration[]> {
  const sinceMs = Date.now() - lookbackDays * 24 * 60 * 60 * 1000

  // 복합 인덱스 불필요: isPublic 단일 필터로 조회 후 날짜를 JS에서 필터링
  const docs = await fsQuery('saved_summaries', {
    where: {
      fieldFilter: {
        field: { fieldPath: 'isPublic' },
        op: 'EQUAL',
        value: { booleanValue: true },
      },
    },
    select: {
      fields: [
        'sessionId', 'videoId', 'title', 'channel', 'thumbnail', 'category',
        'square_meta', 'contextSummary', 'reportSummary', 'createdAt',
        'videoPublishedAt', 'ytViewCount', 'postedToMagazine',
      ].map(f => ({ fieldPath: f })),
    },
    orderBy: [{ field: { fieldPath: 'createdAt' }, direction: 'DESCENDING' }],
    limit: 500,
  })

  return docs
    .map(({ id, data }) => {
      const meta = (data.square_meta as Record<string, unknown>) ?? {}
      const createdAt = data.createdAt
      // createdAt: Firestore Timestamp → 숫자(ms) or ISO string
      let summarizedAt = ''
      let createdAtMs = 0
      if (typeof createdAt === 'number') {
        createdAtMs = createdAt
        summarizedAt = new Date(createdAt).toISOString()
      } else if (typeof createdAt === 'object' && createdAt !== null && 'seconds' in (createdAt as any)) {
        createdAtMs = (createdAt as any).seconds * 1000
        summarizedAt = new Date(createdAtMs).toISOString()
      } else if (typeof createdAt === 'string') {
        createdAtMs = new Date(createdAt).getTime()
        summarizedAt = createdAt
      }
      return {
        id,
        sessionId: (data.sessionId as string) ?? '',
        videoId: (data.videoId as string) ?? '',
        title: (data.title as string) ?? '',
        channel: (data.channel as string) ?? '',
        thumbnail: (data.thumbnail as string) ?? '',
        category: (data.category as string) ?? '',
        topicCluster: (meta.topic_cluster as string) ?? '',
        tags: (meta.tags as string[]) ?? [],
        contextSummary: (data.contextSummary as string) ?? '',
        reportSummary: (data.reportSummary as string) ?? '',
        summarizedAt,
        videoPublishedAt: (data.videoPublishedAt as string) ?? '',
        ytViewCount: Number(data.ytViewCount ?? 0),
        postedToMagazine: (data.postedToMagazine as boolean) ?? false,
        _createdAtMs: createdAtMs,
      }
    })
    .filter(s => s._createdAtMs === 0 || s._createdAtMs >= sinceMs)
    .map(({ _createdAtMs: _, ...s }) => s)
}

// ─── Single video selection (hot_score 기반) ─────────────────────────────────

export function pickBestSingle(summaries: SummaryForCuration[]): SummaryForCuration | null {
  const candidates = summaries.filter(s => !s.postedToMagazine && s.title)
  if (!candidates.length) return null

  const now = Date.now()
  const scored = candidates.map(s => {
    const publishedMs = s.videoPublishedAt ? new Date(s.videoPublishedAt).getTime() : 0
    const ageHours = publishedMs ? Math.max(1, (now - publishedMs) / 3600000) : 720
    const hotScore = s.ytViewCount > 0 ? s.ytViewCount / ageHours : 0
    // ytViewCount 없으면 최신 요약 우선
    const summarizedMs = s.summarizedAt ? new Date(s.summarizedAt).getTime() : 0
    return { s, hotScore, summarizedMs }
  })

  // hot_score 있는 것 우선, 없으면 최신 요약순
  const withScore = scored.filter(x => x.hotScore > 0).sort((a, b) => b.hotScore - a.hotScore)
  if (withScore.length) return withScore[0].s

  const byRecent = scored.sort((a, b) => b.summarizedMs - a.summarizedMs)
  return byRecent[0]?.s ?? null
}

// ─── Clustering (레거시) ──────────────────────────────────────────────────────

export function findBestCluster(
  summaries: SummaryForCuration[],
  minCount: number,
  maxCount: number,
): { cluster: string; items: SummaryForCuration[] } | null {
  // 1차: topic_cluster 기반 클러스터링
  const topicClusters: Record<string, SummaryForCuration[]> = {}
  for (const s of summaries) {
    const key = s.topicCluster?.trim()
    if (!key) continue
    topicClusters[key] = topicClusters[key] ?? []
    topicClusters[key].push(s)
  }

  const topicValid = Object.entries(topicClusters)
    .filter(([, items]) => items.length >= minCount)
    .sort((a, b) => b[1].length - a[1].length)

  if (topicValid.length) {
    const [cluster, items] = topicValid[0]
    const sorted = [...items].sort((a, b) => b.summarizedAt.localeCompare(a.summarizedAt))
    return { cluster, items: sorted.slice(0, maxCount) }
  }

  // 2차 폴백: category 기반 클러스터링 (topic_cluster 미설정 영상 대응)
  const catClusters: Record<string, SummaryForCuration[]> = {}
  for (const s of summaries) {
    const key = s.category?.trim()
    if (!key) continue
    catClusters[key] = catClusters[key] ?? []
    catClusters[key].push(s)
  }

  const catValid = Object.entries(catClusters)
    .filter(([, items]) => items.length >= minCount)
    .sort((a, b) => b[1].length - a[1].length)

  if (!catValid.length) return null
  const [cluster, items] = catValid[0]
  const sorted = [...items].sort((a, b) => b.summarizedAt.localeCompare(a.summarizedAt))
  return { cluster, items: sorted.slice(0, maxCount) }
}

// ─── Post generation ────────────────────────────────────────────────────────

function slugify(title: string): string {
  const date = new Date().toISOString().slice(0, 10)
  const clean = title
    .replace(/[^\w\s가-힣]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 50)
  return `${clean}-${date}`
}

function estimateReadTime(body: string): number {
  return Math.max(1, Math.round(body.replace(/\s+/g, ' ').split(' ').length / 200))
}

export async function generateMagazinePost(
  item: SummaryForCuration,
  commentsContext?: string,
): Promise<Omit<CuratedPost, 'id' | 'viewCount' | 'likeCount'>> {
  const today = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
  const year = new Date().getFullYear()
  const hasComments = !!commentsContext

  const prompt = `다음 유튜브 영상 요약 데이터를 구글 SEO에 최적화된 매거진 글로 변환하세요.
작성 기준일: ${today}

영상 제목: ${item.title}
채널: ${item.channel}
카테고리: ${item.category}

요약 데이터:
${item.contextSummary ?? ''}
${item.reportSummary ? '\n추가 분석:\n' + item.reportSummary : ''}
${hasComments ? `\n유튜브 댓글 데이터:\n${commentsContext}` : ''}

[SEO 최적화 규칙]
- title: 핵심 키워드를 앞에 배치, 40-60자, ${year}년 포함 권장, 클릭 유도 (숫자/How-to/질문형)
- seoDescription: 핵심 내용 + 클릭 유도 문구, 140-155자, 핵심 키워드 포함
- slug: 영문 소문자+하이픈 (예: "real-estate-auction-guide-2026")
- seoKeywords: 검색량 높을 법한 키워드 6-10개

[섹션 작성 원칙]
- 단순 요약 나열 금지. 에디터의 분석·평가·실용 조언 반드시 포함
- body는 마크다운(##, ###, **볼드**) 적극 활용, 최소 800자
- intro: 검색자의 핵심 궁금증을 바로 해결하는 도입부
- 각 섹션 300-450자, 분석·비교·맥락 설명 포함
- conclusion: 핵심 요약 + 독자 행동 유도(CTA)

[FAQ — 5개 필수]
- 이 주제로 구글에서 실제로 검색할 법한 질문과 답변
- 질문: 검색 쿼리 형태
- 답변: 2-4문장

[체크리스트 — 3-5개]
- 이 영상 시청 후 독자가 바로 실천할 수 있는 구체적 행동 항목
${hasComments ? `
[댓글 분석]
- popular_summary: 인기 댓글 전체 경향 2-3문장
- popular_highlights: 인기 댓글 중 인상적인 것 3-5개 원문 인용 (likes 포함)
- recent_summary: 최신 댓글 경향 2-3문장
- recent_highlights: 최신 댓글 중 흥미로운 것 3-5개 원문 인용` : ''}

JSON 형식:
{
  "title": "SEO 최적화 제목",
  "subtitle": "독자 호기심 자극 부제 20-40자",
  "body": "## 섹션\\n\\n내용...",
  "seoDescription": "155자 이내 메타 설명",
  "slug": "english-slug-here",
  "seoKeywords": ["키워드1","키워드2","키워드3","키워드4","키워드5"],
  "tags": ["태그1","태그2","태그3","태그4","태그5"],
  "faq": [
    {"question": "질문1?", "answer": "답변1"},
    {"question": "질문2?", "answer": "답변2"},
    {"question": "질문3?", "answer": "답변3"},
    {"question": "질문4?", "answer": "답변4"},
    {"question": "질문5?", "answer": "답변5"}
  ],
  "checklist": ["항목1","항목2","항목3"]${hasComments ? `,
  "comments": {
    "popular_summary": "인기 댓글 경향 요약",
    "popular_highlights": [{"text": "댓글 원문", "likes": 123}],
    "recent_summary": "최신 댓글 경향 요약",
    "recent_highlights": [{"text": "최신 댓글 원문", "likes": 0}]
  }` : ''}
}`

  const result = await magazineModel.generateContent(prompt)
  const raw = result.response.text().trim()

  let parsed: {
    title: string; subtitle: string; body: string; seoDescription: string; slug?: string
    seoKeywords: string[]; tags?: string[]
    faq?: { question: string; answer: string }[]
    checklist?: string[]
    comments?: { popular_summary: string; popular_highlights: any[]; recent_summary: string; recent_highlights: any[] }
  }
  try {
    const match = raw.match(/\{[\s\S]*\}/)
    parsed = JSON.parse(match ? match[0] : raw)
  } catch (parseErr) {
    console.error('[Magazine] JSON parse failed. Raw (first 500):', raw.slice(0, 500))
    throw new Error(`Magazine generation returned invalid JSON: ${(parseErr as Error).message}`)
  }

  const now = new Date().toISOString()
  const heroThumbnail = item.thumbnail && !item.thumbnail.startsWith('data:') ? item.thumbnail : ''
  const allTags = [...new Set([...(parsed.tags ?? []), ...item.tags])].slice(0, 12)

  return {
    slug: parsed.slug ? `${parsed.slug}-${now.slice(0, 10)}` : slugify(parsed.title),
    title: parsed.title,
    subtitle: parsed.subtitle,
    heroThumbnail,
    category: item.category,
    tags: allTags,
    summaryIds: [item.id],
    videoTitles: [item.title],
    body: parsed.body,
    seoDescription: (parsed.seoDescription ?? '').slice(0, 155),
    seoKeywords: parsed.seoKeywords ?? [],
    faq: parsed.faq ?? [],
    checklist: parsed.checklist ?? [],
    comments: parsed.comments,
    readTime: estimateReadTime(parsed.body),
    status: 'draft',
    publishedAt: '',
    createdAt: now,
    topicCluster: item.topicCluster || item.category,
  }
}

// ─── CRUD ────────────────────────────────────────────────────────────────────

export async function saveCuratedPost(post: Omit<CuratedPost, 'id' | 'viewCount' | 'likeCount'>): Promise<string> {
  const id = `mag-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
  const data = { ...post, id, viewCount: 0, likeCount: 0 }
  await fsPatch(`curated_posts/${id}`, data as Record<string, unknown>)
  return id
}

export async function publishCuratedPost(id: string) {
  await fsPatch(`curated_posts/${id}`, {
    status: 'published',
    publishedAt: new Date().toISOString(),
  })
}

export async function deleteCuratedPost(id: string) {
  await fetch(`${BASE}/curated_posts/${id}?key=${API_KEY}`, { method: 'DELETE' })
}

export async function getPublishedPosts(limit = 20): Promise<CuratedPost[]> {
  const docs = await fsQuery('curated_posts', {
    where: { fieldFilter: { field: { fieldPath: 'status' }, op: 'EQUAL', value: { stringValue: 'published' } } },
    orderBy: [{ field: { fieldPath: 'publishedAt' }, direction: 'DESCENDING' }],
    limit,
  })
  return docs.map(({ id, data }) => ({ ...data, id } as CuratedPost))
}

export async function getAllPostsForAdmin(limit = 50): Promise<CuratedPost[]> {
  const docs = await fsQuery('curated_posts', {
    orderBy: [{ field: { fieldPath: 'createdAt' }, direction: 'DESCENDING' }],
    limit,
  })
  return docs.map(({ id, data }) => ({ ...data, id } as CuratedPost))
}

export async function getPostBySlug(slug: string): Promise<CuratedPost | null> {
  const docs = await fsQuery('curated_posts', {
    where: { fieldFilter: { field: { fieldPath: 'slug' }, op: 'EQUAL', value: { stringValue: slug } } },
    limit: 1,
  })
  if (!docs[0]) return null
  return { ...docs[0].data, id: docs[0].id } as CuratedPost
}

export async function incrementPostView(id: string) {
  const data = await fsGet(`curated_posts/${id}`)
  if (!data) return
  const current = (data.viewCount as number) ?? 0
  await fsPatch(`curated_posts/${id}`, { viewCount: current + 1 })
}

// ─── Schedule check ──────────────────────────────────────────────────────────

const SCHEDULE_INTERVALS: Record<CurationSchedule, number> = {
  '3x_daily':  8  * 60 * 60 * 1000,
  '2x_daily':  12 * 60 * 60 * 1000,
  '1x_daily':  24 * 60 * 60 * 1000,
  '3x_weekly': Math.round((7 / 3) * 24 * 60 * 60 * 1000),
  '1x_weekly': 7  * 24 * 60 * 60 * 1000,
  'manual':    Infinity,
}

export function shouldGenerate(settings: CurationSettings): boolean {
  if (!settings.enabled || settings.schedule === 'manual') return false
  if (!settings.lastGeneratedAt) return true
  const elapsed = Date.now() - new Date(settings.lastGeneratedAt).getTime()
  return elapsed >= (SCHEDULE_INTERVALS[settings.schedule] ?? Infinity)
}
