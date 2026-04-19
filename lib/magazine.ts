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
  readTime: number           // Estimated minutes
  status: 'draft' | 'published'
  publishedAt: string
  createdAt: string
  viewCount: number
  likeCount: number
  topicCluster: string
}

export type CurationSchedule = '3x_daily' | '1x_daily' | '3x_weekly' | '1x_weekly' | 'manual'

export interface CurationSettings {
  enabled: boolean
  schedule: CurationSchedule
  minVideoCount: number    // min videos needed per post
  maxVideoCount: number    // max videos to include per post
  lookbackDays: number     // how many recent days to scan
  lastGeneratedAt: string
  autoPublish: boolean     // false = save as draft
}

export interface SummaryForCuration {
  id: string
  sessionId: string
  title: string
  channel: string
  thumbnail: string
  category: string
  topicCluster: string
  tags: string[]
  contextSummary: string
  reportSummary: string
  summarizedAt: string
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
  schedule: '3x_weekly',
  minVideoCount: 5,
  maxVideoCount: 8,
  lookbackDays: 3,
  lastGeneratedAt: '',
  autoPublish: false,
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
        'sessionId', 'title', 'channel', 'thumbnail', 'category',
        'square_meta', 'contextSummary', 'reportSummary', 'createdAt',
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
        title: (data.title as string) ?? '',
        channel: (data.channel as string) ?? '',
        thumbnail: (data.thumbnail as string) ?? '',
        category: (data.category as string) ?? '',
        topicCluster: (meta.topic_cluster as string) ?? '',
        tags: (meta.tags as string[]) ?? [],
        contextSummary: (data.contextSummary as string) ?? '',
        reportSummary: (data.reportSummary as string) ?? '',
        summarizedAt,
        _createdAtMs: createdAtMs,
      }
    })
    .filter(s => s._createdAtMs === 0 || s._createdAtMs >= sinceMs)
    .map(({ _createdAtMs: _, ...s }) => s)
}

// ─── Clustering ──────────────────────────────────────────────────────────────

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
  cluster: string,
  items: SummaryForCuration[],
): Promise<Omit<CuratedPost, 'id' | 'viewCount' | 'likeCount'>> {
  const allTags = [...new Set(items.flatMap(v => v.tags))].slice(0, 12)
  const mainCategory = items[0]?.category ?? 'news'

  const videoBlocks = items
    .map((v, i) =>
      `[영상 ${i + 1}] "${v.title}" — ${v.channel}\n${v.contextSummary ?? ''}${v.reportSummary ? '\n' + v.reportSummary.slice(0, 400) : ''}`,
    )
    .join('\n\n---\n\n')

  const prompt = `당신은 SSOKTUBE의 수석 콘텐츠 에디터입니다.
아래 ${items.length}개 영상을 기반으로 구글 검색 상위 랭크를 목표로 한 전문 큐레이션 포스트를 작성하세요.

주제 클러스터: "${cluster}"

[포함 영상 요약 데이터]
${videoBlocks}

[작성 원칙]
- 유튜브에는 없는 SSOKTUBE만의 독자적 분석과 에디터 관점을 반드시 포함할 것
- 영상들을 단순 나열하지 말고, 공통점·차이점·흐름·시사점을 뽑아낼 것
- 검색자가 실제로 검색할 법한 자연스러운 키워드를 본문에 녹일 것
- 마크다운 헤딩(##, ###)과 볼드(**) 적극 활용

[JSON 형식으로 응답 — 다른 텍스트 없이 JSON만]:
{
  "title": "SEO 최적화된 포스트 제목 (숫자/연도 포함 권장, 30-60자)",
  "subtitle": "독자 호기심 자극 부제 (20-40자)",
  "body": "## 시작\n\n[서론 2-3문장: 이 주제가 왜 지금 중요한지]\n\n## 핵심 분석\n\n[각 영상의 핵심을 비교 분석하는 메인 섹션. 각 영상마다 ### 소제목 사용. 단순 소개가 아닌 비교·인사이트·평가를 포함]\n\n## 흐름과 트렌드\n\n[이 주제의 현재 흐름, 공통 패턴, 앞으로의 방향]\n\n## 에디터 총평\n\n[SSOKTUBE 에디터만의 독자적 관점. 유튜브 영상에 없는 내용. 실용적 조언이나 비판적 시각 포함]\n\n(실제 내용으로 채워주세요, 위 구조는 가이드라인)",
  "seoDescription": "구글 스니펫용 설명. 핵심 키워드 자연스럽게 포함. 150자 이내.",
  "seoKeywords": ["검색키워드1", "검색키워드2", "검색키워드3", "검색키워드4", "검색키워드5"]
}`

  const result = await magazineModel.generateContent(prompt)
  const raw = result.response.text().trim()

  let parsed: { title: string; subtitle: string; body: string; seoDescription: string; seoKeywords: string[] }
  try {
    const match = raw.match(/\{[\s\S]*\}/)
    parsed = JSON.parse(match ? match[0] : raw)
  } catch (parseErr) {
    console.error('[Magazine] JSON parse failed. Raw response (first 500 chars):', raw.slice(0, 500))
    throw new Error(`Magazine generation returned invalid JSON: ${(parseErr as Error).message}`)
  }

  const now = new Date().toISOString()
  const heroThumbnail = items.find(v => v.thumbnail && !v.thumbnail.startsWith('data:'))?.thumbnail ?? ''

  return {
    slug: slugify(parsed.title),
    title: parsed.title,
    subtitle: parsed.subtitle,
    heroThumbnail,
    category: mainCategory,
    tags: allTags,
    summaryIds: items.map(v => v.id),
    videoTitles: items.map(v => v.title),
    body: parsed.body,
    seoDescription: parsed.seoDescription.slice(0, 155),
    seoKeywords: parsed.seoKeywords ?? [],
    readTime: estimateReadTime(parsed.body),
    status: 'draft',
    publishedAt: '',
    createdAt: now,
    topicCluster: cluster,
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
