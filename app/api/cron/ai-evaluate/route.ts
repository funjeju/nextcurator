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
import { initPipelineLog, logEvaluate, evaluatedToLog, getActiveRunId, setActiveRunId } from '@/lib/pipeline-logger'

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


interface ScoutQueueItem {
  videoId: string
  title: string
  channelTitle: string
  publishedAt: string
  durationSec: number
}

async function readScoutQueue(subcategory: AiSubcategory): Promise<ScoutQueueItem[]> {
  try {
    const { initAdminApp } = await import('@/lib/firebase-admin')
    initAdminApp()
    const { getFirestore } = await import('firebase-admin/firestore')
    const doc = await getFirestore().collection('ai_scout_queue').doc(subcategory).get()
    if (!doc.exists) {
      console.log(`[Evaluate] scout queue not found for ${subcategory}`)
      return []
    }
    const data = doc.data()!
    console.log(`[Evaluate] scout queue status: ${data.status} count: ${data.items?.length ?? 0} for ${subcategory}`)
    if (data.status !== 'scouted') return []
    return (data.items ?? []).filter((i: any) => i.videoId)
  } catch (e) {
    console.log(`[Evaluate] readScoutQueue error: ${e}`)
    return []
  }
}

async function markScoutQueueProcessed(subcategory: AiSubcategory): Promise<void> {
  try {
    const { initAdminApp } = await import('@/lib/firebase-admin')
    initAdminApp()
    const { getFirestore } = await import('firebase-admin/firestore')
    await getFirestore().collection('ai_scout_queue').doc(subcategory).update({ status: 'processing' })
  } catch (e) {
    console.log(`[Evaluate] markScoutQueueProcessed error: ${e}`)
  }
}

async function runEvaluate(subcategory: AiSubcategory, existingRunId?: string) {
  const active = existingRunId ? null : await getActiveRunId(subcategory)
  const runId = existingRunId ?? active?.runId ?? await initPipelineLog(subcategory)
  const startedAt = new Date().toISOString()

  const candidates = await readScoutQueue(subcategory)
  if (!candidates.length) {
    await logEvaluate(runId, { startedAt, status: 'skipped', completedAt: new Date().toISOString(), results: [], message: 'No scout queue found' })
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
    await logEvaluate(runId, { startedAt, status: 'failed', completedAt: new Date().toISOString(), results: [], message: 'All transcripts too short or failed' })
    return NextResponse.json({ success: true, subcategory, message: 'All transcripts too short or failed' })
  }

  console.log(`[AI Evaluate] ${withTranscript.length} videos with usable transcripts`)

  // 2 AI 심사관 병렬 교차 검증
  const evaluated = await evaluateVideos(withTranscript)

  let passCount = evaluated.filter(e => e.decision === 'PASS').length
  const holdCount = evaluated.filter(e => e.decision === 'HOLD').length

  // 결과 저장
  await saveEvaluateQueue(subcategory, evaluated)

  // PASS가 없으면 HOLD 중 최고점을 PASS로 격상 (한번 더 트라이)
  if (passCount === 0 && holdCount > 0) {
    const bestHold = evaluated.find(e => e.decision === 'HOLD')
    if (bestHold) {
      bestHold.decision = 'PASS'
      passCount = 1
      console.log(`[AI Evaluate] No PASS found — promoting top HOLD: "${bestHold.title}"`)
      await saveEvaluateQueue(subcategory, evaluated)
    }
  }

  console.log(`[AI Evaluate] Done: PASS=${passCount}, HOLD=${holdCount}, FAIL=${evaluated.length - passCount - holdCount}`)

  const winner = evaluated.find(e => e.decision === 'PASS')
  await setActiveRunId(subcategory, runId, 'evaluated', winner ? { videoId: winner.videoId, title: winner.title } : {})
  await logEvaluate(runId, {
    startedAt,
    status: 'done',
    completedAt: new Date().toISOString(),
    results: evaluatedToLog(evaluated),
    winner: winner ? { videoId: winner.videoId, title: winner.title, compositeScore: winner.compositeScore } : undefined,
  })

  return NextResponse.json({
    success: true,
    subcategory,
    runId,
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
  const body = await req.json().catch(() => ({})) as { subcategory?: AiSubcategory; force?: boolean; runId?: string }
  if (!body.force) {
    return NextResponse.json({ error: 'force:true required' }, { status: 400 })
  }
  const subcategory = body.subcategory ?? getSubcategoryForSlot()
  return runEvaluate(subcategory, body.runId)
}
