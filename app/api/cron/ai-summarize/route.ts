/**
 * CRON C: AI Summarize
 * evaluate_queue 1위 영상 → 전체 요약 생성 → saved_summaries 저장 (Square K 노출)
 * KST 06:20 / 14:20 / 22:20 (UTC 21:20 / 05:20 / 13:20)
 */

import { NextRequest, NextResponse } from 'next/server'
import { AiSubcategory, getTopPickForPublish } from '@/lib/ai-curator'
import {
  classifyCategory,
  generateSummary,
  generateContextSummary,
  generateReportSummary,
} from '@/lib/claude'
import { fetchVideoComments } from '@/lib/youtube-comments'
import { initAdminApp } from '@/lib/firebase-admin'
import { randomUUID } from 'crypto'

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

// AI 하위카테고리 → 요약 카테고리 매핑
const SUBCATEGORY_TO_CATEGORY: Record<AiSubcategory, string> = {
  news:     'news',
  tools:    'tips',
  usecases: 'selfdev',
}

async function runSummarize(subcategory: AiSubcategory) {
  // evaluate_queue에서 1위 픽 가져오기
  const pick = await getTopPickForPublish(subcategory)
  if (!pick) {
    return NextResponse.json({ success: true, subcategory, message: 'No evaluated pick found — evaluate cron may not have run yet' })
  }

  console.log(`[AI Summarize] Processing: "${pick.title}" (score=${pick.compositeScore.toFixed(1)})`)

  // 이미 saved_summaries에 있는지 확인
  try {
    initAdminApp()
    const { getFirestore } = await import('firebase-admin/firestore')
    const db = getFirestore()
    const existing = await db.collection('saved_summaries')
      .where('videoId', '==', pick.videoId).limit(1).get()
    if (!existing.empty) {
      console.log(`[AI Summarize] Already exists in saved_summaries: ${pick.videoId}`)
      return NextResponse.json({ success: true, subcategory, skipped: true, reason: 'Already summarized' })
    }
  } catch { /* fallthrough */ }

  const category = SUBCATEGORY_TO_CATEGORY[subcategory]

  // 카테고리 재분류 (evaluate 시점에 transcript 기반으로 더 정확하게)
  const classified = await classifyCategory(pick.transcript.slice(0, 3000)).catch(() => ({ category }))
  const finalCategory = classified.category || category

  // 요약 3종 병렬 생성
  const [summary, reportSummary, commentResult] = await Promise.all([
    generateSummary(finalCategory as any, pick.transcript, 'youtube'),
    generateReportSummary(finalCategory as any, pick.title, pick.transcript).catch(() => ''),
    fetchVideoComments(pick.videoId).catch(() => ({ popular: [], recent: [], combined: [] })),
  ])
  const contextSummary = await generateContextSummary(pick.title, finalCategory as any, summary).catch(() => '')

  // 댓글 AI 요약 (있을 때만)
  let ytCommentSummary = ''
  let ytCommentsContext = ''
  if (commentResult.popular.length > 0) {
    const { formatCommentsForPrompt } = await import('@/lib/youtube-comments')
    ytCommentsContext = formatCommentsForPrompt(commentResult.popular, commentResult.recent).slice(0, 3000)

    const { GoogleGenerativeAI } = await import('@google/generative-ai')
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY!)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })
    ytCommentSummary = await model.generateContent(
      `다음 댓글들의 시청자 반응을 한국어 280자 이내로 요약:\n${commentResult.popular.slice(0, 15).map(c => `"${c.text}"`).join('\n')}`
    ).then(r => r.response.text().slice(0, 300)).catch(() => '')
  }

  const sessionId = randomUUID()
  const thumbnail = `https://img.youtube.com/vi/${pick.videoId}/maxresdefault.jpg`

  const doc = {
    userId: 'auto-collector',
    userDisplayName: 'SSOKTUBE AI 에디터',
    userPhotoURL: '',
    folderId: '',
    sessionId,
    videoId: pick.videoId,
    title: pick.title,
    channel: pick.channelTitle,
    thumbnail,
    category: finalCategory,
    aiSubcategory: subcategory,
    summary,
    contextSummary,
    reportSummary,
    ytCommentSummary,
    ytCommentsContext,
    square_meta: {
      topic_cluster: `ai-${subcategory}`,
      tags: ['AI', subcategory, finalCategory],
      channel: pick.channelTitle,
      thumbnail,
    },
    isPublic: true,
    transcript: pick.transcript.slice(0, 5000),
    transcriptSource: 'youtube',
    transcriptLang: 'en',
    videoPublishedAt: '',
    ytViewCount: 0,
    postedToMagazine: false,
    autoCollected: true,
    aiCurated: true,
    aiCompositeScore: pick.compositeScore,
  }

  try {
    initAdminApp()
    const { getFirestore, FieldValue } = await import('firebase-admin/firestore')
    const db = getFirestore()

    // 1. saved_summaries 저장 (Square K 노출)
    const ref = db.collection('saved_summaries').doc()
    await ref.set({ ...doc, createdAt: FieldValue.serverTimestamp() })

    // 2. 슬롯 문서에 sessionId 기록 → generate-post가 정확히 이 요약을 픽업
    await db.collection('ai_pipeline').doc(`${subcategory}_slot`).set({
      sessionId,
      savedSummaryId: ref.id,
      videoId: pick.videoId,
      title: pick.title,
      subcategory,
      savedAt: new Date().toISOString(),
      status: 'ready',
    })

    console.log(`[AI Summarize] ✅ Saved to Square K + slot: "${pick.title}" (docId=${ref.id})`)
    return NextResponse.json({ success: true, subcategory, sessionId, title: pick.title, category: finalCategory })
  } catch (e) {
    console.error('[AI Summarize] Firestore save failed:', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const subcategory = getSubcategoryForSlot()
  return runSummarize(subcategory)
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as { subcategory?: AiSubcategory; force?: boolean }
  if (!body.force) {
    return NextResponse.json({ error: 'force:true required' }, { status: 400 })
  }
  const subcategory = body.subcategory ?? getSubcategoryForSlot()
  return runSummarize(subcategory)
}
