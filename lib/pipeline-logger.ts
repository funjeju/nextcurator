/**
 * Pipeline Logger — 각 단계(Scout/Evaluate/Summarize/Publish) 실행 내역을
 * Firestore pipeline_logs 컬렉션에 기록한다.
 */

import type { AiSubcategory, ScoutResult, ScoutDiag, EvaluatedVideo } from './ai-curator'

export interface PipelineLogScout {
  status: 'running' | 'done' | 'failed'
  startedAt: string
  completedAt?: string
  diag?: ScoutDiag
  candidates: Array<{
    videoId: string
    title: string
    channelTitle: string
    durationSec: number
    publishedAt: string
    source: string
  }>
  message?: string
}

export interface PipelineLogEvaluate {
  status: 'running' | 'done' | 'failed' | 'skipped'
  startedAt: string
  completedAt?: string
  results: Array<{
    videoId: string
    title: string
    channelTitle: string
    compositeScore: number
    decision: string
    geminiInfo: number
    geminiRisk: number
    geminiReason: string
    claudeInfo: number
    claudeRisk: number
    claudeReason: string
  }>
  winner?: { videoId: string; title: string; compositeScore: number }
  message?: string
}

export interface PipelineLogSummarize {
  status: 'running' | 'done' | 'failed' | 'skipped'
  startedAt: string
  completedAt?: string
  videoId?: string
  title?: string
  sessionId?: string
  transcriptLength?: number
  message?: string
}

export interface PipelineLogPublish {
  status: 'running' | 'done' | 'failed' | 'skipped'
  startedAt: string
  completedAt?: string
  postTitle?: string
  postSlug?: string
  autoPublish?: boolean
  message?: string
}

export interface PipelineLog {
  id: string
  runId: string
  subcategory: AiSubcategory
  startedAt: string
  scout?: PipelineLogScout
  evaluate?: PipelineLogEvaluate
  summarize?: PipelineLogSummarize
  publish?: PipelineLogPublish
}

function makeRunId(subcategory: AiSubcategory): string {
  const now = new Date()
  const kst = new Date(now.getTime() + 9 * 3600 * 1000)
  const ymd = kst.toISOString().slice(0, 10)
  const hh  = kst.toISOString().slice(11, 13)
  return `${subcategory}_${ymd}_${hh}`
}

async function db() {
  const { initAdminApp } = await import('./firebase-admin')
  initAdminApp()
  const { getFirestore } = await import('firebase-admin/firestore')
  return getFirestore()
}

export async function initPipelineLog(subcategory: AiSubcategory): Promise<string> {
  const runId = makeRunId(subcategory)
  try {
    const firestore = await db()
    await firestore.collection('pipeline_logs').doc(runId).set({
      runId,
      subcategory,
      startedAt: new Date().toISOString(),
    }, { merge: true })
  } catch (e) {
    console.error('[PipelineLog] initPipelineLog error:', e)
  }
  return runId
}

export async function logScout(
  runId: string,
  data: Omit<PipelineLogScout, 'startedAt'> & { startedAt?: string }
): Promise<void> {
  try {
    const firestore = await db()
    await firestore.collection('pipeline_logs').doc(runId).set(
      { scout: { startedAt: new Date().toISOString(), ...data } },
      { merge: true }
    )
  } catch (e) {
    console.error('[PipelineLog] logScout error:', e)
  }
}

export async function logEvaluate(
  runId: string,
  data: Omit<PipelineLogEvaluate, 'startedAt'> & { startedAt?: string }
): Promise<void> {
  try {
    const firestore = await db()
    await firestore.collection('pipeline_logs').doc(runId).set(
      { evaluate: { startedAt: new Date().toISOString(), ...data } },
      { merge: true }
    )
  } catch (e) {
    console.error('[PipelineLog] logEvaluate error:', e)
  }
}

export async function logSummarize(
  runId: string,
  data: Omit<PipelineLogSummarize, 'startedAt'> & { startedAt?: string }
): Promise<void> {
  try {
    const firestore = await db()
    await firestore.collection('pipeline_logs').doc(runId).set(
      { summarize: { startedAt: new Date().toISOString(), ...data } },
      { merge: true }
    )
  } catch (e) {
    console.error('[PipelineLog] logSummarize error:', e)
  }
}

export async function logPublish(
  runId: string,
  data: Omit<PipelineLogPublish, 'startedAt'> & { startedAt?: string }
): Promise<void> {
  try {
    const firestore = await db()
    await firestore.collection('pipeline_logs').doc(runId).set(
      { publish: { startedAt: new Date().toISOString(), ...data } },
      { merge: true }
    )
  } catch (e) {
    console.error('[PipelineLog] logPublish error:', e)
  }
}

export async function listPipelineLogs(limit = 30): Promise<PipelineLog[]> {
  try {
    const firestore = await db()
    const snap = await firestore.collection('pipeline_logs')
      .orderBy('startedAt', 'desc')
      .limit(limit)
      .get()
    return snap.docs.map(d => ({ id: d.id, ...d.data() }) as PipelineLog)
  } catch (e) {
    console.error('[PipelineLog] listPipelineLogs error:', e)
    return []
  }
}

export async function getPipelineLog(id: string): Promise<PipelineLog | null> {
  try {
    const firestore = await db()
    const doc = await firestore.collection('pipeline_logs').doc(id).get()
    if (!doc.exists) return null
    return { id: doc.id, ...doc.data() } as PipelineLog
  } catch (e) {
    console.error('[PipelineLog] getPipelineLog error:', e)
    return null
  }
}

// ── 활성 파이프라인 상태 관리 ─────────────────────────────────────────────────

export type PipelineStatus = 'idle' | 'scouted' | 'evaluated' | 'summarized' | 'published'

export interface PipelineState {
  subcategory: AiSubcategory
  activeRunId: string
  pipelineStatus: PipelineStatus
  updatedAt: string
  sessionId?: string
  savedSummaryId?: string
  videoId?: string
  title?: string
}

export async function setActiveRunId(
  subcategory: AiSubcategory,
  runId: string,
  status: PipelineStatus,
  extra?: Partial<PipelineState>,
): Promise<void> {
  try {
    const firestore = await db()
    await firestore.collection('ai_pipeline_state').doc(subcategory).set({
      subcategory,
      activeRunId: runId,
      pipelineStatus: status,
      updatedAt: new Date().toISOString(),
      ...extra,
    }, { merge: true })
  } catch (e) {
    console.error('[PipelineState] setActiveRunId error:', e)
  }
}

export async function getActiveRunId(subcategory: AiSubcategory): Promise<{ runId: string; state: PipelineState } | null> {
  try {
    const firestore = await db()
    const doc = await firestore.collection('ai_pipeline_state').doc(subcategory).get()
    if (!doc.exists) return null
    const data = doc.data() as PipelineState
    if (!data.activeRunId) return null
    return { runId: data.activeRunId, state: data }
  } catch (e) {
    console.error('[PipelineState] getActiveRunId error:', e)
    return null
  }
}

// Scout 결과 → 로그용 포맷 변환
export function scoutResultsToLog(results: ScoutResult[]) {
  return results.map(r => ({
    videoId: r.videoId,
    title: r.title,
    channelTitle: r.channelTitle,
    durationSec: r.durationSec,
    publishedAt: r.publishedAt,
    source: r.source,
  }))
}

// Evaluate 결과 → 로그용 포맷 변환
export function evaluatedToLog(evaluated: EvaluatedVideo[]) {
  return evaluated.map(e => ({
    videoId: e.videoId,
    title: e.title,
    channelTitle: e.channelTitle,
    compositeScore: e.compositeScore,
    decision: e.decision,
    geminiInfo: e.geminiScore.infoScore,
    geminiRisk: e.geminiScore.riskScore,
    geminiReason: e.geminiScore.reason,
    claudeInfo: e.claudeScore.infoScore,
    claudeRisk: e.claudeScore.riskScore,
    claudeReason: e.claudeScore.reason,
  }))
}
