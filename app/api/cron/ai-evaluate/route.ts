/**
 * CRON B: AI Evaluate
 * scout_queue에서 후보 읽기 → 자막 병렬 추출 → 2 AI 심사관 교차 검증
 * → 점수+순위 저장 (ai_evaluate_queue)
 * KST 06:10 / 14:10 / 22:10 (UTC 21:10 / 05:10 / 13:10)
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  AiSubcategory,
  evaluateVideos,
  saveEvaluateQueue,
} from '@/lib/ai-curator'
import { getTranscript } from '@/lib/transcript'

export const maxDuration = 120

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return req.headers.get('authorization') === `Bearer ${secret}`
}

function getSubcategoryForSlot(): AiSubcategory {
  const hour = new Date().getUTCHours()
  if (hour >= 20 && hour < 24) return 'news'
  if (hour >= 4 && hour < 8)   return 'tools'
  return 'usecases'
}

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!
const API_KEY    = process.env.NEXT_PUBLIC_FIREBASE_API_KEY!
const FS_BASE    = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`

interface ScoutQueueItem {
  videoId: string
  title: string
  channelTitle: string
  publishedAt: string
  durationSec: number
}

async function readScoutQueue(subcategory: AiSubcategory): Promise<ScoutQueueItem[]> {
  try {
    const res = await fetch(`${FS_BASE}/ai_scout_queue/${subcategory}?key=${API_KEY}`, { cache: 'no-store' })
    if (!res.ok) {
      console.log(`[Evaluate] readScoutQueue HTTP ${res.status} for ${subcategory}`)
      return []
    }
    const doc = await res.json() as { fields?: Record<string, any> }
    if (!doc.fields) return []

    const status = doc.fields.status?.stringValue ?? ''
    console.log(`[Evaluate] scout queue status: ${status} for ${subcategory}`)
    if (status !== 'scouted') return []

    const items = (doc.fields.items?.arrayValue?.values ?? []) as any[]
    return items.map((item: any) => {
      const f = item.mapValue?.fields ?? {}
      return {
        videoId: f.videoId?.stringValue ?? '',
        title: f.title?.stringValue ?? '',
        channelTitle: f.channelTitle?.stringValue ?? '',
        publishedAt: f.publishedAt?.stringValue ?? '',
        durationSec: Number(f.durationSec?.integerValue ?? f.durationSec?.doubleValue ?? 0),
      }
    }).filter(i => i.videoId)
  } catch (e) {
    console.log(`[Evaluate] readScoutQueue error: ${e}`)
    return []
  }
}

async function markScoutQueueProcessed(subcategory: AiSubcategory): Promise<void> {
  await fetch(`${FS_BASE}/ai_scout_queue/${subcategory}?key=${API_KEY}&updateMask.fieldPaths=status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: { status: { stringValue: 'processing' } } }),
    cache: 'no-store',
  })
}

async function runEvaluate(subcategory: AiSubcategory) {
  const candidates = await readScoutQueue(subcategory)
  if (!candidates.length) {
    return NextResponse.json({ success: true, subcategory, message: 'No scout queue found' })
  }

  await markScoutQueueProcessed(subcategory)
  console.log(`[AI Evaluate] ${candidates.length} candidates to evaluate for ${subcategory}`)

  // 최대 6개 자막 병렬 추출 (타임아웃 안전)
  const toEvaluate = candidates.slice(0, 6)
  const transcriptResults = await Promise.all(
    toEvaluate.map(c =>
      getTranscript(c.videoId)
        .then(r => ({ videoId: c.videoId, text: r.text }))
        .catch(() => ({ videoId: c.videoId, text: '' }))
    )
  )

  // 자막 길이 최소 기준 미달 제거
  const withTranscript = toEvaluate
    .map(c => {
      const tr = transcriptResults.find(r => r.videoId === c.videoId)
      return { ...c, transcript: tr?.text ?? '', subcategory }
    })
    .filter(c => c.transcript.length >= 300)

  if (!withTranscript.length) {
    return NextResponse.json({ success: true, subcategory, message: 'All transcripts too short or failed' })
  }

  console.log(`[AI Evaluate] ${withTranscript.length} videos with usable transcripts`)

  // 2 AI 심사관 병렬 교차 검증
  const evaluated = await evaluateVideos(withTranscript)

  const passCount = evaluated.filter(e => e.decision === 'PASS').length
  const holdCount = evaluated.filter(e => e.decision === 'HOLD').length

  // 결과 저장
  await saveEvaluateQueue(subcategory, evaluated)

  // PASS가 없으면 HOLD 중 최고점을 PASS로 격상 (한번 더 트라이)
  if (passCount === 0 && holdCount > 0) {
    const bestHold = evaluated.find(e => e.decision === 'HOLD')
    if (bestHold) {
      bestHold.decision = 'PASS'
      console.log(`[AI Evaluate] No PASS found — promoting top HOLD: "${bestHold.title}"`)
      await saveEvaluateQueue(subcategory, evaluated)
    }
  }

  console.log(`[AI Evaluate] Done: PASS=${passCount}, HOLD=${holdCount}, FAIL=${evaluated.length - passCount - holdCount}`)

  return NextResponse.json({
    success: true,
    subcategory,
    total: evaluated.length,
    passCount,
    holdCount,
    topPick: evaluated[0] ? {
      title: evaluated[0].title.slice(0, 60),
      compositeScore: evaluated[0].compositeScore.toFixed(1),
      decision: evaluated[0].decision,
    } : null,
  })
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const subcategory = getSubcategoryForSlot()
  return runEvaluate(subcategory)
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as { subcategory?: AiSubcategory; force?: boolean }
  if (!body.force) {
    return NextResponse.json({ error: 'force:true required' }, { status: 400 })
  }
  const subcategory = body.subcategory ?? getSubcategoryForSlot()
  return runEvaluate(subcategory)
}
