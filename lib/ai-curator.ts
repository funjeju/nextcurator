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

// ── 신선도 기준 (초) ──────────────────────────────────────────────────────────
export const FRESHNESS_WINDOW: Record<AiSubcategory, number> = {
  news:     48 * 3600,
  tools:    7 * 24 * 3600,
  usecases: 7 * 24 * 3600,
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

function detectLang(title: string): 'en' | 'ko' | 'other' {
  if (/[가-힣]/.test(title)) return 'ko'
  if (/[a-zA-Z]/.test(title)) return 'en'
  return 'other'
}

// duration 파싱 — ISO8601 / 초(number) / "MM:SS" / "HH:MM:SS" 모두 대응
function parseDurationFlex(d: string | number | undefined): number {
  if (!d) return 0
  if (typeof d === 'number') return d
  const iso = d.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (iso) return (+(iso[1] ?? 0)) * 3600 + (+(iso[2] ?? 0)) * 60 + (+(iso[3] ?? 0))
  const parts = d.split(':').map(Number)
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  return 0
}

function extractVideoId(raw: Record<string, unknown>): string {
  if (typeof raw.videoId === 'string') return raw.videoId
  if (typeof raw.id === 'string' && raw.id.length === 11) return raw.id
  const url = (raw.url ?? raw.link ?? '') as string
  const m = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
  return m?.[1] ?? ''
}

// ── SocialKit Scout 헬퍼 ──────────────────────────────────────────────────────

const SK_BASE = 'https://api.socialkit.dev'

async function skGet(path: string, params: Record<string, string>): Promise<unknown> {
  const key = process.env.SOCIALKIT_API_KEY
  if (!key) return null
  try {
    const url = new URL(`${SK_BASE}/${path}`)
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
    const res = await fetch(url.toString(), {
      headers: { 'x-access-key': key },
      signal: AbortSignal.timeout(12000),
    })
    if (!res.ok) {
      console.log(`[Scout] SK ${path} HTTP ${res.status}`)
      return null
    }
    return await res.json()
  } catch (e) {
    console.log(`[Scout] SK ${path} error: ${e}`)
    return null
  }
}

// SocialKit search → 영상 목록 반환
async function skSearch(query: string, limit = 10): Promise<Record<string, unknown>[]> {
  const raw = await skGet('youtube/search', { q: query, limit: String(limit) })
  if (!raw) return []
  const r = raw as Record<string, unknown>
  // 다양한 응답 형태 대응
  const items = (Array.isArray(r.data) ? r.data
    : Array.isArray((r.data as Record<string,unknown>)?.videos) ? (r.data as Record<string,unknown>).videos
    : Array.isArray((r.data as Record<string,unknown>)?.results) ? (r.data as Record<string,unknown>).results
    : Array.isArray(r.videos) ? r.videos
    : Array.isArray(r.results) ? r.results
    : []) as Record<string, unknown>[]
  console.log(`[Scout] skSearch "${query}" → ${items.length}개`)
  return items
}

// SocialKit video-details → 단일 영상 상세
async function skVideoDetails(videoId: string): Promise<Record<string, unknown> | null> {
  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`
  const raw = await skGet('youtube/video-details', { url: videoUrl })
  if (!raw) return null
  const r = raw as Record<string, unknown>
  return (r.data as Record<string, unknown>) ?? r
}

// ── Scout 검색 쿼리 ───────────────────────────────────────────────────────────
export const SCOUT_QUERIES: Record<AiSubcategory, string[]> = {
  news: [
    'AI news latest 2026',
    'OpenAI Anthropic Google AI announcement 2026',
    'AI 최신 소식 인공지능 2026',
  ],
  tools: [
    'new AI tool review tutorial 2026',
    'best AI software productivity 2026',
    'AI 도구 활용법 리뷰 2026',
  ],
  usecases: [
    'AI workflow automation productivity 2026',
    'ChatGPT Claude practical use case 2026',
    'AI 업무 자동화 활용 2026',
  ],
}

// ── Scout 결과 타입 ───────────────────────────────────────────────────────────
export interface ScoutResult {
  videoId: string
  title: string
  channelTitle: string
  channelId: string
  publishedAt: string
  durationSec: number
  viewCount: number
  lang: 'en' | 'ko' | 'other'
  source: 'search'
  subcategory: AiSubcategory
}

export interface ScoutDiag {
  queriesRun: number
  rawFound: number
  afterFilter: number
  detailsFetched: number
  filteredReasons: { duration: number; clickbait: number; old: number; noId: number }
}

export async function scoutCandidates(
  subcategory: AiSubcategory,
  _cache: Map<string, string>,       // 하위 호환 — 더 이상 사용 안 함
  alreadyCollectedIds: Set<string>,
): Promise<{ results: ScoutResult[]; diag: ScoutDiag }> {
  const freshnessMs = FRESHNESS_WINDOW[subcategory] * 1000
  const cutoff = Date.now() - freshnessMs
  const diag: ScoutDiag = { queriesRun: 0, rawFound: 0, afterFilter: 0, detailsFetched: 0, filteredReasons: { duration: 0, clickbait: 0, old: 0, noId: 0 } }

  const queries = SCOUT_QUERIES[subcategory]
  const seen = new Set<string>()
  const candidates: ScoutResult[] = []

  for (const query of queries) {
    if (candidates.length >= 8) break
    diag.queriesRun++

    const items = await skSearch(query, 10)
    diag.rawFound += items.length

    for (const item of items) {
      if (candidates.length >= 8) break

      const videoId = extractVideoId(item)
      if (!videoId || seen.has(videoId) || alreadyCollectedIds.has(videoId)) {
        if (!videoId) diag.filteredReasons.noId++
        continue
      }
      seen.add(videoId)

      // search 결과에 이미 메타가 있으면 바로 사용, 없으면 video-details 호출
      let title = (item.title ?? item.name ?? '') as string
      let channelTitle = (item.channelTitle ?? item.channel ?? '') as string
      let channelId = (item.channelId ?? '') as string
      let publishedAt = (item.publishedAt ?? item.published_at ?? item.date ?? '') as string
      let durationSec = parseDurationFlex(item.duration as string | number | undefined)
      let viewCount = Number(item.viewCount ?? item.views ?? 0)

      // 핵심 정보 부족 시 video-details 추가 호출
      if (!title || !publishedAt || durationSec === 0) {
        diag.detailsFetched++
        const detail = await skVideoDetails(videoId)
        if (detail) {
          title = title || (detail.title as string) || ''
          channelTitle = channelTitle || (detail.channelTitle as string) || (detail.channel as string) || ''
          channelId = channelId || (detail.channelId as string) || ''
          publishedAt = publishedAt || (detail.publishedAt as string) || (detail.published_at as string) || ''
          durationSec = durationSec || parseDurationFlex(detail.duration as string | number | undefined)
          viewCount = viewCount || Number(detail.viewCount ?? detail.views ?? 0)
        }
      }

      if (!title) continue

      // 필터
      if (durationSec > 0 && (durationSec < 180 || durationSec > 3600)) { diag.filteredReasons.duration++; continue }
      if (isClickbait(title)) { diag.filteredReasons.clickbait++; continue }
      if (publishedAt && new Date(publishedAt).getTime() < cutoff) { diag.filteredReasons.old++; continue }

      candidates.push({
        videoId,
        title,
        channelTitle,
        channelId,
        publishedAt,
        durationSec,
        viewCount,
        lang: detectLang(title),
        source: 'search',
        subcategory,
      })
    }
  }

  diag.afterFilter = candidates.length
  console.log(`[Scout] ${subcategory}: 쿼리${diag.queriesRun}개 → 원본${diag.rawFound}개 → 필터후${diag.afterFilter}개 (duration:${diag.filteredReasons.duration} old:${diag.filteredReasons.old} clickbait:${diag.filteredReasons.clickbait})`)

  return {
    results: candidates.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()),
    diag,
  }
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
