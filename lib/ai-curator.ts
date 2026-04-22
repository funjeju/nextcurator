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
      const body = await res.text().catch(() => '')
      console.log(`[Scout] SK ${path} HTTP ${res.status}: ${body.slice(0, 200)}`)
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
  const raw = await skGet('youtube/search', { query, limit: String(limit) })
  if (!raw) return []
  const r = raw as Record<string, unknown>
  const items = (Array.isArray(r.data) ? r.data
    : Array.isArray((r.data as Record<string,unknown>)?.videos) ? (r.data as Record<string,unknown>).videos
    : Array.isArray((r.data as Record<string,unknown>)?.results) ? (r.data as Record<string,unknown>).results
    : Array.isArray(r.videos) ? r.videos
    : Array.isArray(r.results) ? r.results
    : []) as Record<string, unknown>[]
  if (items.length > 0) {
    console.log(`[Scout] skSearch "${query}" → ${items.length}개, 샘플 필드: ${JSON.stringify(Object.keys(items[0]))}`)
    console.log(`[Scout] 첫번째 아이템: ${JSON.stringify(items[0]).slice(0, 300)}`)
  } else {
    console.log(`[Scout] skSearch "${query}" → 0개, raw keys: ${JSON.stringify(Object.keys(r))}`)
  }
  return items
}

// SocialKit stats → 단일 영상 상세 (youtube/stats 엔드포인트)
// 응답: { title, channelName, channelLink, views, likes, comments, duration (MM:SS) }
async function skStats(videoId: string): Promise<Record<string, unknown> | null> {
  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`
  const raw = await skGet('youtube/stats', { url: videoUrl })
  if (!raw) return null
  const r = raw as Record<string, unknown>
  return (r.data as Record<string, unknown>) ?? r
}

// "2 days ago", "1 week ago", "3 months ago" 등 상대 날짜 → ISO 날짜 문자열
function parseRelativeDate(rel: string): string {
  if (!rel) return ''
  // 이미 ISO 형식이면 그대로
  if (/^\d{4}-\d{2}-\d{2}/.test(rel)) return rel
  const now = Date.now()
  const m = rel.match(/(\d+)\s+(second|minute|hour|day|week|month|year)s?\s+ago/i)
  if (!m) return ''
  const n = parseInt(m[1])
  const unit = m[2].toLowerCase()
  const msMap: Record<string, number> = {
    second: 1000, minute: 60_000, hour: 3_600_000,
    day: 86_400_000, week: 7 * 86_400_000,
    month: 30 * 86_400_000, year: 365 * 86_400_000,
  }
  const ms = (msMap[unit] ?? 0) * n
  return new Date(now - ms).toISOString()
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
      // SocialKit search 응답 필드: channelName (not channelTitle), publishedTime (relative), duration (MM:SS)
      let title = (item.title ?? item.name ?? '') as string
      let channelTitle = (item.channelName ?? item.channelTitle ?? item.channel ?? '') as string
      let channelId = (item.channelId ?? '') as string
      const rawDate = (item.publishedAt ?? item.published_at ?? item.publishedTime ?? item.date ?? '') as string
      let publishedAt = parseRelativeDate(rawDate) || rawDate
      let durationSec = parseDurationFlex(item.duration as string | number | undefined)
      let viewCount = Number(item.viewCount ?? item.views ?? 0)

      // 핵심 정보 부족 시 youtube/stats 추가 호출
      // stats 응답: title, channelName, channelLink, views, likes, comments, duration
      // ※ publishedAt은 stats에도 없으므로 search의 publishedTime(상대날짜) 사용
      if (!title || durationSec === 0) {
        diag.detailsFetched++
        const detail = await skStats(videoId)
        if (detail) {
          title = title || (detail.title as string) || ''
          channelTitle = channelTitle || (detail.channelName as string) || ''
          // channelLink에서 channelId 추출: https://youtube.com/channel/UCxxx
          if (!channelId && typeof detail.channelLink === 'string') {
            const m = (detail.channelLink as string).match(/channel\/([A-Za-z0-9_-]+)/)
            channelId = m?.[1] ?? ''
          }
          durationSec = durationSec || parseDurationFlex(detail.duration as string | number | undefined)
          viewCount = viewCount || Number(detail.views ?? 0)
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

export async function saveScoutQueue(items: ScoutResult[]): Promise<void> {
  const subcategory = items[0]?.subcategory ?? 'news'
  try {
    const { initAdminApp } = await import('./firebase-admin')
    initAdminApp()
    const { getFirestore } = await import('firebase-admin/firestore')
    await getFirestore().collection('ai_scout_queue').doc(subcategory).set({
      subcategory,
      items,
      savedAt: new Date().toISOString(),
      status: 'scouted',
    })
    console.log(`[Scout] saveScoutQueue OK: ${subcategory} ${items.length}개`)
  } catch (e) {
    console.error(`[Scout] saveScoutQueue error: ${e}`)
  }
}

export async function saveEvaluateQueue(
  subcategory: AiSubcategory,
  evaluated: EvaluatedVideo[],
): Promise<void> {
  const docId = `${subcategory}_${new Date().toISOString().slice(0, 13)}`
  try {
    const { initAdminApp } = await import('./firebase-admin')
    initAdminApp()
    const { getFirestore } = await import('firebase-admin/firestore')
    await getFirestore().collection('ai_evaluate_queue').doc(docId).set({
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
    console.log(`[Evaluate] saveEvaluateQueue OK: ${docId} ${evaluated.length}개`)
  } catch (e) {
    console.error(`[Evaluate] saveEvaluateQueue error: ${e}`)
  }
}

export async function getTopPickForPublish(subcategory: AiSubcategory): Promise<{
  videoId: string; title: string; channelTitle: string; transcript: string; compositeScore: number
} | null> {
  try {
    const { initAdminApp } = await import('./firebase-admin')
    initAdminApp()
    const { getFirestore } = await import('firebase-admin/firestore')
    const db = getFirestore()

    // 정확한 hour docId 대신 최근 4시간 이내 최신 문서 쿼리
    const cutoff = new Date(Date.now() - 4 * 3600 * 1000).toISOString()
    const snap = await db.collection('ai_evaluate_queue')
      .where('subcategory', '==', subcategory)
      .where('status', '==', 'evaluated')
      .where('savedAt', '>=', cutoff)
      .orderBy('savedAt', 'desc')
      .limit(1)
      .get()

    if (snap.empty) {
      console.log(`[Summarize] No recent evaluate queue found for ${subcategory} (cutoff: ${cutoff})`)
      return null
    }

    const data = snap.docs[0].data()
    console.log(`[Summarize] Found evaluate queue: ${snap.docs[0].id} savedAt=${data.savedAt}`)
    const evaluated = (data.evaluated ?? []) as any[]
    const passes = evaluated
      .filter(e => e.decision === 'PASS')
      .sort((a, b) => b.compositeScore - a.compositeScore)
    return passes[0] ?? null
  } catch (e) {
    console.error(`[Summarize] getTopPickForPublish error: ${e}`)
    return null
  }
}
