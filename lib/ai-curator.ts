/**
 * AI Magazine Curator
 * Scout → Evaluate → Publish 3-phase pipeline
 */

import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenerativeAI } from '@google/generative-ai'

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY!

// ── 화이트리스트 채널 ─────────────────────────────────────────────────────────
// 우선 채널에서 후보 수집. 부족하면 키워드 검색으로 보완.

export type AiSubcategory = 'news' | 'tools' | 'usecases'

interface ChannelDef {
  name: string
  lang: 'en' | 'ko'
  priority: 1 | 2 | 3
  /** YouTube @handle (e.g. 'lexfridman') — resolves with 1 quota instead of 100 */
  handle?: string
  /** Direct channelId — skips resolution entirely */
  channelId?: string
}

export const WHITELIST: Record<AiSubcategory, ChannelDef[]> = {
  news: [
    { name: 'AI Explained',                      lang: 'en', priority: 1, handle: 'AIExplained' },
    { name: 'Matthew Berman',                    lang: 'en', priority: 1, handle: 'matthew_berman' },
    { name: 'Wes Roth',                          lang: 'en', priority: 1, handle: 'WesRoth' },
    { name: 'The AI Daily Brief',                lang: 'en', priority: 1, handle: 'theaidailybrief' },
    { name: 'Two Minute Papers',                 lang: 'en', priority: 1, handle: 'TwoMinutePapers' },
    { name: 'Bloomberg Technology',              lang: 'en', priority: 1, handle: 'BloombergTechnology' },
    { name: 'Machine Learning Street Talk',      lang: 'en', priority: 2, handle: 'MachineLearningStreetTalk' },
    { name: 'Dwarkesh Patel',                    lang: 'en', priority: 2, handle: 'dwarkeshpatel' },
    { name: 'Lex Fridman',                       lang: 'en', priority: 2, handle: 'lexfridman' },
    { name: 'a16z',                              lang: 'en', priority: 2, handle: 'a16z' },
    { name: '안될공학',                           lang: 'ko', priority: 1, handle: 'unrealclever' },
    { name: '티타임즈TV',                         lang: 'ko', priority: 2, handle: 'ttimestv' },
    { name: 'EO',                                lang: 'ko', priority: 2, handle: 'EO_studio' },
    { name: '언더스탠딩',                         lang: 'ko', priority: 2, handle: 'understandingkorea' },
    { name: 'AI타잔',                             lang: 'ko', priority: 3, handle: 'aitarzan' },
  ],
  tools: [
    { name: 'Marques Brownlee',                  lang: 'en', priority: 1, handle: 'mkbhd' },
    { name: 'The AI Advantage',                  lang: 'en', priority: 1, handle: 'TheAiAdvantage' },
    { name: 'Theoretically Media',               lang: 'en', priority: 1, handle: 'Theoretically' },
    { name: 'Fireship',                          lang: 'en', priority: 1, handle: 'Fireship' },
    { name: 'All About AI',                      lang: 'en', priority: 2, handle: 'AllAboutAI' },
    { name: 'Kevin Stratvert',                   lang: 'en', priority: 2, handle: 'KevinStratvert' },
    { name: 'Cole Medin',                        lang: 'en', priority: 2, handle: 'ColeMedin' },
    { name: '조코딩',                             lang: 'ko', priority: 1, handle: 'jocoding' },
    { name: '테디노트',                           lang: 'ko', priority: 1, handle: 'teddynote' },
    { name: '노마드코더',                         lang: 'ko', priority: 2, handle: 'nomadcoders' },
    { name: '생활코딩',                           lang: 'ko', priority: 2, handle: 'egoing' },
    { name: 'AI프리뷰',                           lang: 'ko', priority: 3 },
  ],
  usecases: [
    { name: '일잘러를 위한 AI',                   lang: 'ko', priority: 1 },
    { name: '노트북러너',                         lang: 'ko', priority: 1 },
    { name: '월간 프롬프트',                      lang: 'ko', priority: 1 },
    { name: 'The AI Advantage Igor Pogany',      lang: 'en', priority: 1, handle: 'TheAiAdvantage' },
    { name: 'Prompt Engineering',                lang: 'en', priority: 1, handle: 'PromptEngineering' },
    { name: 'Liam Ottley',                       lang: 'en', priority: 2, handle: 'LiamOttley' },
    { name: 'Cole Medin',                        lang: 'en', priority: 2, handle: 'ColeMedin' },
    { name: 'David Ondrej',                      lang: 'en', priority: 2, handle: 'DavidOndrej' },
    { name: '자동화 연구소',                      lang: 'ko', priority: 2 },
    { name: '드로우앤드류',                       lang: 'ko', priority: 2, handle: 'drewandrew' },
    { name: 'Matt Wolfe Future Tools',           lang: 'en', priority: 3, handle: 'mreflow' },
    { name: 'AI 업무비서',                        lang: 'ko', priority: 3 },
  ],
}

// 카테고리별 키워드 폴백 (화이트리스트 후보 부족 시)
export const FALLBACK_QUERIES: Record<AiSubcategory, string[]> = {
  news:     ['AI news latest 2026', 'OpenAI Anthropic Google AI announcement', 'AI 최신 소식'],
  tools:    ['new AI tool review 2026', 'AI tools comparison tutorial', 'AI 도구 리뷰'],
  usecases: ['AI productivity workflow 2026', 'ChatGPT Claude practical use', 'AI 업무 활용'],
}

// 카테고리별 신선도 기준 (초)
export const FRESHNESS_WINDOW: Record<AiSubcategory, number> = {
  news:     48 * 3600,      // 48시간
  tools:    7 * 24 * 3600,  // 1주일
  usecases: 7 * 24 * 3600,  // 1주일
}

// ── 클릭베이트 필터 ────────────────────────────────────────────────────────────
const CLICKBAIT_KW = [
  '충격', '경악', '소름', '끝났다', '망했다', '반드시', '절대',
  'SHOCKING', 'DESTROYED', 'BANNED', 'You MUST', 'FINALLY',
  'Everything is OVER', 'CRAZY', 'INSANE reveal',
]

export function isClickbait(title: string): boolean {
  return CLICKBAIT_KW.some(kw => title.toLowerCase().includes(kw.toLowerCase()))
}

// ── YouTube API 헬퍼 ───────────────────────────────────────────────────────────

export interface VideoMeta {
  videoId: string
  title: string
  channelTitle: string
  channelId: string
  publishedAt: string
  durationSec: number
  viewCount: number
  hasCaption: boolean
  lang: 'en' | 'ko' | 'other'
}

function parseDuration(iso: string): number {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!m) return 0
  return (+(m[1] ?? 0)) * 3600 + (+(m[2] ?? 0)) * 60 + (+(m[3] ?? 0))
}

function detectLang(title: string, defaultLang: 'en' | 'ko'): 'en' | 'ko' | 'other' {
  const hasKorean = /[가-힣]/.test(title)
  if (hasKorean) return 'ko'
  if (defaultLang === 'en') return 'en'
  return 'other'
}

// 채널 @handle로 채널 ID 조회 (1 quota — 검색 100 quota보다 훨씬 저렴)
async function resolveChannelByHandle(handle: string): Promise<string | null> {
  try {
    const url = new URL('https://www.googleapis.com/youtube/v3/channels')
    url.searchParams.set('part', 'id')
    url.searchParams.set('forHandle', `@${handle}`)
    url.searchParams.set('key', YOUTUBE_API_KEY)
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(8000) })
    if (!res.ok) return null
    const data = await res.json() as { items?: { id?: string }[] }
    return data.items?.[0]?.id ?? null
  } catch {
    return null
  }
}

// 채널명으로 YouTube 채널 ID 검색 (검색 1회당 100 quota — 폴백용)
async function resolveChannelByName(channelName: string): Promise<string | null> {
  try {
    const url = new URL('https://www.googleapis.com/youtube/v3/search')
    url.searchParams.set('part', 'id')
    url.searchParams.set('type', 'channel')
    url.searchParams.set('q', channelName)
    url.searchParams.set('maxResults', '1')
    url.searchParams.set('key', YOUTUBE_API_KEY)
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(8000) })
    if (!res.ok) return null
    const data = await res.json() as { items?: { id?: { channelId?: string } }[] }
    return data.items?.[0]?.id?.channelId ?? null
  } catch {
    return null
  }
}

// 채널의 업로드 플레이리스트 ID 조회 (채널당 1 quota)
async function getUploadPlaylistId(channelId: string): Promise<string | null> {
  try {
    const url = new URL('https://www.googleapis.com/youtube/v3/channels')
    url.searchParams.set('part', 'contentDetails')
    url.searchParams.set('id', channelId)
    url.searchParams.set('key', YOUTUBE_API_KEY)
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(8000) })
    if (!res.ok) return null
    const data = await res.json() as { items?: { contentDetails?: { relatedPlaylists?: { uploads?: string } } }[] }
    return data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads ?? null
  } catch {
    return null
  }
}

// 플레이리스트에서 최근 영상 ID 수집 (1 quota)
async function getRecentVideoIds(playlistId: string, maxResults = 5): Promise<string[]> {
  try {
    const url = new URL('https://www.googleapis.com/youtube/v3/playlistItems')
    url.searchParams.set('part', 'contentDetails')
    url.searchParams.set('playlistId', playlistId)
    url.searchParams.set('maxResults', String(maxResults))
    url.searchParams.set('key', YOUTUBE_API_KEY)
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(8000) })
    if (!res.ok) return []
    const data = await res.json() as { items?: { contentDetails?: { videoId?: string } }[] }
    return (data.items ?? []).map(i => i.contentDetails?.videoId ?? '').filter(Boolean)
  } catch {
    return []
  }
}

// videoId 배열의 메타 일괄 조회 (1 quota per call)
export async function fetchVideoMetas(videoIds: string[]): Promise<VideoMeta[]> {
  if (!videoIds.length) return []
  try {
    const url = new URL('https://www.googleapis.com/youtube/v3/videos')
    url.searchParams.set('part', 'snippet,statistics,contentDetails')
    url.searchParams.set('id', videoIds.join(','))
    url.searchParams.set('key', YOUTUBE_API_KEY)
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(10000) })
    if (!res.ok) return []
    const data = await res.json() as {
      items?: {
        id: string
        snippet?: { title?: string; channelTitle?: string; channelId?: string; publishedAt?: string; defaultAudioLanguage?: string }
        statistics?: { viewCount?: string }
        contentDetails?: { duration?: string; caption?: string }
      }[]
    }
    return (data.items ?? []).map(item => {
      const audioLang = item.snippet?.defaultAudioLanguage ?? ''
      const title = item.snippet?.title ?? ''
      const chanLang: 'en' | 'ko' = audioLang.startsWith('ko') ? 'ko' : 'en'
      return {
        videoId: item.id,
        title,
        channelTitle: item.snippet?.channelTitle ?? '',
        channelId: item.snippet?.channelId ?? '',
        publishedAt: item.snippet?.publishedAt ?? '',
        durationSec: parseDuration(item.contentDetails?.duration ?? ''),
        viewCount: Number(item.statistics?.viewCount ?? 0),
        hasCaption: item.contentDetails?.caption === 'true',
        lang: detectLang(title, chanLang),
      }
    })
  } catch {
    return []
  }
}

// 키워드 검색으로 videoId 수집 (100 quota)
async function searchVideoIds(query: string, maxResults = 8): Promise<string[]> {
  try {
    const url = new URL('https://www.googleapis.com/youtube/v3/search')
    url.searchParams.set('part', 'id')
    url.searchParams.set('type', 'video')
    url.searchParams.set('q', query)
    url.searchParams.set('maxResults', String(maxResults))
    url.searchParams.set('order', 'date')
    url.searchParams.set('key', YOUTUBE_API_KEY)
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(10000) })
    if (!res.ok) return []
    const data = await res.json() as { items?: { id?: { videoId?: string } }[] }
    return (data.items ?? []).map(i => i.id?.videoId ?? '').filter(Boolean)
  } catch {
    return []
  }
}

// ── Scout: 화이트리스트 + 폴백 검색으로 후보 수집 ─────────────────────────────

export interface ScoutResult {
  videoId: string
  title: string
  channelTitle: string
  channelId: string
  publishedAt: string
  durationSec: number
  viewCount: number
  lang: 'en' | 'ko' | 'other'
  source: 'whitelist' | 'search'
  subcategory: AiSubcategory
}

async function resolveAndFetch(
  channel: ChannelDef,
  channelIdCache: Map<string, string>,
): Promise<string[]> {
  let channelId = channelIdCache.get(channel.name)
  if (!channelId) {
    if (channel.channelId) {
      channelId = channel.channelId
    } else if (channel.handle) {
      channelId = await resolveChannelByHandle(channel.handle) ?? ''
      if (!channelId) {
        // handle이 틀렸을 수 있으니 이름 검색으로 폴백
        channelId = await resolveChannelByName(channel.name) ?? ''
      }
    } else {
      channelId = await resolveChannelByName(channel.name) ?? ''
    }
    if (channelId) channelIdCache.set(channel.name, channelId)
  }
  if (!channelId) {
    console.log(`[Scout] ⚠️ Failed to resolve: ${channel.name}`)
    return []
  }

  const playlistId = await getUploadPlaylistId(channelId)
  if (!playlistId) {
    console.log(`[Scout] ⚠️ No upload playlist: ${channel.name} (${channelId})`)
    return []
  }

  const videoIds = await getRecentVideoIds(playlistId, 3)
  console.log(`[Scout] ✅ ${channel.name}: ${videoIds.length} videos`)
  return videoIds
}

export async function scoutCandidates(
  subcategory: AiSubcategory,
  channelIdCache: Map<string, string>,
  alreadyCollectedIds: Set<string>,
): Promise<ScoutResult[]> {
  const channels = WHITELIST[subcategory]
  const freshnessMs = FRESHNESS_WINDOW[subcategory] * 1000
  const cutoff = Date.now() - freshnessMs

  // Priority 1·2 채널만 실행 (시간·quota 절약, priority 3은 폴백용)
  const activeChannels = channels.filter(c => c.priority <= 2)

  // 채널별 최근 영상 병렬 수집 (채널당 최대 3개 ID)
  const idBatches = await Promise.all(
    activeChannels.map(ch => resolveAndFetch(ch, channelIdCache).catch(() => [] as string[]))
  )
  const whitelistIds = [...new Set(idBatches.flat())].filter(id => !alreadyCollectedIds.has(id))
  console.log(`[Scout] Whitelist raw IDs: ${whitelistIds.length}`)

  // 메타 조회
  let metas = await fetchVideoMetas(whitelistIds.slice(0, 20))
  console.log(`[Scout] Metas fetched: ${metas.length}`)

  // 메타 필터
  metas = metas.filter(v => {
    if (v.durationSec < 180 || v.durationSec > 3600) {
      console.log(`[Scout] Filtered (duration ${v.durationSec}s): ${v.title.slice(0, 50)}`)
      return false
    }
    if (isClickbait(v.title)) {
      console.log(`[Scout] Filtered (clickbait): ${v.title.slice(0, 50)}`)
      return false
    }
    if (new Date(v.publishedAt).getTime() < cutoff) {
      console.log(`[Scout] Filtered (old: ${v.publishedAt}): ${v.title.slice(0, 50)}`)
      return false
    }
    if (alreadyCollectedIds.has(v.videoId)) return false
    return true
  })
  console.log(`[Scout] After filter: ${metas.length}`)

  let results: ScoutResult[] = metas.map(v => ({
    ...v,
    source: 'whitelist' as const,
    subcategory,
  }))

  // 화이트리스트 후보가 4개 미만이면 키워드 검색으로 보완
  if (results.length < 4) {
    for (const query of FALLBACK_QUERIES[subcategory]) {
      const ids = await searchVideoIds(query, 6)
      const filtered = ids.filter(id => !alreadyCollectedIds.has(id) && !results.find(r => r.videoId === id))
      const fallbackMetas = await fetchVideoMetas(filtered)
      const valid = fallbackMetas.filter(v =>
        v.durationSec >= 180 && v.durationSec <= 3600 &&
        !isClickbait(v.title) &&
        new Date(v.publishedAt).getTime() >= cutoff
      )
      results.push(...valid.map(v => ({ ...v, source: 'search' as const, subcategory })))
      if (results.length >= 6) break
    }
  }

  // priority 1 채널 우선, 같은 우선순위면 최신순
  return results
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .slice(0, 8)
}

// ── Evaluate: 2 AI 심사관 교차 검증 ──────────────────────────────────────────

export interface JudgeScore {
  infoScore: number      // 정보밀도·신선도·독창성 (0-10)
  riskScore: number      // 과장·오류·편향 위험도 (0-10, 낮을수록 안전)
  verdict: 'PASS' | 'HOLD' | 'FAIL'
  reason: string
}

export interface EvaluatedVideo {
  videoId: string
  title: string
  channelTitle: string
  publishedAt: string
  durationSec: number
  transcript: string
  geminiScore: JudgeScore
  claudeScore: JudgeScore
  compositeScore: number   // 가중 합산 (높을수록 좋음)
  decision: 'PASS' | 'HOLD' | 'FAIL'
  subcategory: AiSubcategory
}

async function judgeGemini(title: string, transcript: string): Promise<JudgeScore> {
  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY!)
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    // @ts-expect-error thinkingConfig not in types
    generationConfig: { responseMimeType: 'application/json', temperature: 0, thinkingConfig: { thinkingBudget: 512 } },
  })
  const prompt = `당신은 AI 전문 매거진의 큐레이터입니다.
아래 유튜브 영상의 제목과 자막을 보고 매거진 기사 가치를 평가하세요.

제목: ${title}
자막 (일부): ${transcript.slice(0, 3000)}

[평가 기준]
- infoScore (0-10): 구체적 사실·데이터·신규 발표 내용이 얼마나 풍부한가. 실용성·독창성 포함.
- riskScore (0-10): 과장·클릭베이트·미확인 주장·편향 위험도. 10이 가장 위험.
- verdict: infoScore ≥ 6 AND riskScore ≤ 4 이면 "PASS", infoScore ≥ 5 OR riskScore ≤ 5 이면 "HOLD", 나머지 "FAIL"
- reason: 판단 근거 1-2문장

JSON만 반환: {"infoScore":7,"riskScore":2,"verdict":"PASS","reason":"..."}`

  const result = await model.generateContent(prompt)
  const raw = result.response.text()
  const parsed = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] ?? '{}') as Partial<JudgeScore>
  return {
    infoScore: Number(parsed.infoScore ?? 5),
    riskScore: Number(parsed.riskScore ?? 5),
    verdict: parsed.verdict ?? 'HOLD',
    reason: parsed.reason ?? '',
  }
}

async function judgeClaude(title: string, transcript: string): Promise<JudgeScore> {
  const client = new Anthropic()
  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    messages: [{
      role: 'user',
      content: `당신은 AI 매거진의 팩트체커입니다.
아래 영상에서 문제 소지를 찾고, 정보 신뢰도를 평가하세요.

제목: ${title}
자막 (일부): ${transcript.slice(0, 3000)}

[체크 항목]
- infoScore (0-10): 정보의 구체성·신뢰성·독자 실용가치
- riskScore (0-10): 과장·PPL 의심·불확인 주장·혐오·정치 편향. 10이 가장 위험.
- verdict: infoScore ≥ 6 AND riskScore ≤ 4 이면 "PASS", 경계선은 "HOLD", 나머지 "FAIL"
- reason: 핵심 판단 근거 1-2문장

JSON만 반환: {"infoScore":7,"riskScore":2,"verdict":"PASS","reason":"..."}`,
    }],
  })
  const raw = (message.content[0] as { text: string }).text
  const parsed = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] ?? '{}') as Partial<JudgeScore>
  return {
    infoScore: Number(parsed.infoScore ?? 5),
    riskScore: Number(parsed.riskScore ?? 5),
    verdict: parsed.verdict ?? 'HOLD',
    reason: parsed.reason ?? '',
  }
}

function calcComposite(g: JudgeScore, c: JudgeScore): { score: number; decision: 'PASS' | 'HOLD' | 'FAIL' } {
  // Gemini: 정보가치 50% + Claude: 안전성 50% (역산)
  const score = (g.infoScore * 0.5) + ((10 - c.riskScore) * 0.5)

  // 두 심사관 의견 합산
  const verdicts = [g.verdict, c.verdict]
  const passCount = verdicts.filter(v => v === 'PASS').length
  const failCount = verdicts.filter(v => v === 'FAIL').length

  let decision: 'PASS' | 'HOLD' | 'FAIL'
  if (passCount === 2) decision = 'PASS'
  else if (failCount === 2) decision = 'FAIL'
  else decision = 'HOLD'  // 의견 불일치 → 수동 검토

  return { score, decision }
}

export async function evaluateVideos(
  candidates: { videoId: string; title: string; channelTitle: string; publishedAt: string; durationSec: number; transcript: string; subcategory: AiSubcategory }[]
): Promise<EvaluatedVideo[]> {
  // 모든 후보를 병렬로 2심사관 평가
  const results = await Promise.all(
    candidates.map(async (c) => {
      const [geminiScore, claudeScore] = await Promise.all([
        judgeGemini(c.title, c.transcript).catch(() => ({ infoScore: 5, riskScore: 5, verdict: 'HOLD' as const, reason: 'evaluation failed' })),
        judgeClaude(c.title, c.transcript).catch(() => ({ infoScore: 5, riskScore: 5, verdict: 'HOLD' as const, reason: 'evaluation failed' })),
      ])
      const { score, decision } = calcComposite(geminiScore, claudeScore)
      return {
        ...c,
        geminiScore,
        claudeScore,
        compositeScore: score,
        decision,
      } as EvaluatedVideo
    })
  )

  // 점수 내림차순 정렬
  return results.sort((a, b) => b.compositeScore - a.compositeScore)
}

// ── Firestore 큐 관리 ─────────────────────────────────────────────────────────

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!
const API_KEY    = process.env.NEXT_PUBLIC_FIREBASE_API_KEY!
const FS_BASE    = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`

function toFV(v: unknown): unknown {
  if (v === null || v === undefined) return { nullValue: null }
  if (typeof v === 'string')  return { stringValue: v }
  if (typeof v === 'number')  return { integerValue: String(v) }
  if (typeof v === 'boolean') return { booleanValue: v }
  if (Array.isArray(v))       return { arrayValue: { values: v.map(toFV) } }
  if (typeof v === 'object') {
    const fields: Record<string, unknown> = {}
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) fields[k] = toFV(val)
    return { mapValue: { fields } }
  }
  return { stringValue: String(v) }
}
function toFields(obj: Record<string, unknown>) {
  const f: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) f[k] = toFV(v)
  return f
}

export async function saveScoutQueue(items: ScoutResult[]): Promise<void> {
  await fetch(`${FS_BASE}/ai_scout_queue?key=${API_KEY}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fields: toFields({
        items: items,
        savedAt: new Date().toISOString(),
        status: 'scouted',
      })
    }),
    cache: 'no-store',
  })
}

export async function saveEvaluateQueue(
  subcategory: AiSubcategory,
  evaluated: EvaluatedVideo[],
): Promise<void> {
  const docId = `${subcategory}_${new Date().toISOString().slice(0, 13)}`
  await fetch(`${FS_BASE}/ai_evaluate_queue/${docId}?key=${API_KEY}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fields: toFields({
        subcategory,
        evaluated: evaluated.map(e => ({
          videoId: e.videoId,
          title: e.title,
          channelTitle: e.channelTitle,
          publishedAt: e.publishedAt,
          transcript: e.transcript.slice(0, 8000),
          compositeScore: e.compositeScore,
          decision: e.decision,
          geminiReason: e.geminiScore.reason,
          claudeReason: e.claudeScore.reason,
        })),
        savedAt: new Date().toISOString(),
        status: 'evaluated',
      })
    }),
    cache: 'no-store',
  })
}

export async function getTopPickForPublish(subcategory: AiSubcategory): Promise<{
  videoId: string; title: string; channelTitle: string; transcript: string; compositeScore: number
} | null> {
  const docId = `${subcategory}_${new Date().toISOString().slice(0, 13)}`
  try {
    const res = await fetch(`${FS_BASE}/ai_evaluate_queue/${docId}?key=${API_KEY}`, { cache: 'no-store' })
    if (!res.ok) return null
    const doc = await res.json() as { fields?: Record<string, any> }
    if (!doc.fields) return null

    const evaluated = (doc.fields.evaluated?.arrayValue?.values ?? []) as any[]
    const passes = evaluated
      .map(e => ({
        videoId: e.mapValue?.fields?.videoId?.stringValue ?? '',
        title: e.mapValue?.fields?.title?.stringValue ?? '',
        channelTitle: e.mapValue?.fields?.channelTitle?.stringValue ?? '',
        transcript: e.mapValue?.fields?.transcript?.stringValue ?? '',
        compositeScore: Number(e.mapValue?.fields?.compositeScore?.integerValue ?? 0),
        decision: e.mapValue?.fields?.decision?.stringValue ?? 'FAIL',
      }))
      .filter(e => e.decision === 'PASS')
      .sort((a, b) => b.compositeScore - a.compositeScore)

    return passes[0] ?? null
  } catch {
    return null
  }
}
