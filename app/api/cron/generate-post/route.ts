import { NextRequest, NextResponse } from 'next/server'
import {
  getRecentPublicSummaries, pickBestSingle,
  generateMagazinePost,
} from '@/lib/magazine'
import {
  getCurationSettings,
  saveCuratedPostAdmin, publishCuratedPostAdmin, saveCurationSettingsAdmin,
  getSummaryBySessionIdAdmin, getPlatformCommentsBySessionIdAdmin,
} from '@/lib/magazine-server'
import { fetchVideoComments, formatCommentsForPrompt } from '@/lib/youtube-comments'
import { initAdminApp } from '@/lib/firebase-admin'
import { initPipelineLog, logPublish, getActiveRunId, setActiveRunId } from '@/lib/pipeline-logger'

async function writeLog(log: Omit<import('@/lib/magazine').MagazineLog, 'id'>) {
  try {
    initAdminApp()
    const { getFirestore } = await import('firebase-admin/firestore')
    await getFirestore().collection('magazine_logs').add(log)
  } catch { /* non-critical */ }
}

export const maxDuration = 120

// Vercel Cron은 Authorization: Bearer 헤더로 CRON_SECRET을 전달
function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const auth = req.headers.get('authorization')
  return auth === `Bearer ${secret}`
}

type AiSubcategory = 'news' | 'tools' | 'usecases'

function getSubcategoryForSlot(): AiSubcategory {
  const hour = new Date().getUTCHours()
  if (hour >= 20 && hour < 24) return 'news'
  if (hour >= 4 && hour < 8)   return 'tools'
  return 'usecases'
}

// ai-summarize가 슬롯 문서에 저장한 sessionId로 정확히 픽업
// 없거나 실패하면 기존 saved_summaries 폴백
async function pickItem(lookbackDays: number, subcategoryOverride?: string) {
  try {
    initAdminApp()
    const { getFirestore } = await import('firebase-admin/firestore')
    const db = getFirestore()

    const subcategory = (subcategoryOverride ?? getSubcategoryForSlot()) as import('@/lib/ai-curator').AiSubcategory

    // 1순위: ai_pipeline_state (새 아키텍처)
    const active = await getActiveRunId(subcategory)
    if (active?.state.pipelineStatus === 'summarized' && active.state.savedSummaryId) {
      const summaryDoc = await db.collection('saved_summaries').doc(active.state.savedSummaryId).get()
      if (summaryDoc.exists && !summaryDoc.data()?.postedToMagazine) {
        console.log(`[generate-post] Picked from ai_pipeline_state: ${active.state.title}`)
        return { id: summaryDoc.id, ...summaryDoc.data() } as any
      }
    }

    // 2순위: 기존 ai_pipeline slot (하위 호환)
    const slotDoc = await db.collection('ai_pipeline').doc(`${subcategory}_slot`).get()
    if (slotDoc.exists) {
      const slot = slotDoc.data()!
      const savedAt = new Date(slot.savedAt as string).getTime()
      const isRecent = Date.now() - savedAt < 90 * 60 * 1000
      if (slot.status === 'ready' && isRecent && slot.savedSummaryId) {
        const summaryDoc = await db.collection('saved_summaries').doc(slot.savedSummaryId as string).get()
        if (summaryDoc.exists && !summaryDoc.data()?.postedToMagazine) {
          console.log(`[generate-post] Picked from ai_pipeline slot: ${slot.title}`)
          await slotDoc.ref.update({ status: 'processing' })
          return { id: summaryDoc.id, ...summaryDoc.data() } as any
        }
      }
    }
  } catch (e) {
    console.warn('[generate-post] pipeline state read failed, falling back:', e)
  }

  // 3순위: 폴백
  const summaries = await getRecentPublicSummaries(lookbackDays)
  return pickBestSingle(summaries)
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const settings = await getCurationSettings()

    if (!settings.enabled || settings.schedule === 'manual') {
      return NextResponse.json({ skipped: true, reason: 'Disabled or manual schedule' })
    }

    const item = await pickItem(settings.lookbackDays)

    if (!item) {
      return NextResponse.json({ skipped: true, reason: `No unposted summaries found in last ${settings.lookbackDays} days` })
    }

    const [ytResult, platformComments] = await Promise.all([
      item.ytCommentsContext
        ? Promise.resolve(null)
        : item.videoId
          ? fetchVideoComments(item.videoId).catch(() => ({ popular: [], recent: [], combined: [] }))
          : Promise.resolve({ popular: [], recent: [], combined: [] }),
      getPlatformCommentsBySessionIdAdmin(item.sessionId).catch(() => []),
    ])
    const commentsContext = item.ytCommentsContext
      || (ytResult && (ytResult.popular.length || ytResult.recent.length)
        ? formatCommentsForPrompt(ytResult.popular as any, ytResult.recent as any)
        : undefined)

    const post = await generateMagazinePost(item, commentsContext, platformComments)
    const id = await saveCuratedPostAdmin(post)

    if (settings.autoPublish) await publishCuratedPostAdmin(id)

    const subcategory = getSubcategoryForSlot()

    // 발행된 summary에 postedToMagazine 마킹 + 슬롯 문서 완료 처리
    try {
      initAdminApp()
      const { getFirestore } = await import('firebase-admin/firestore')
      const db = getFirestore()
      await db.collection('saved_summaries').doc(item.id).update({ postedToMagazine: true })
      await db.collection('ai_pipeline').doc(`${subcategory}_slot`).update({ status: 'published', publishedPostId: id }).catch(() => {})
    } catch { /* non-critical */ }

    // pipeline_logs에 Publish 결과 기록 (자동 cron도 로그에 남기기)
    try {
      const active = await getActiveRunId(subcategory)
      const runId = active?.runId ?? await initPipelineLog(subcategory)
      await setActiveRunId(subcategory, runId, 'published')
      await logPublish(runId, {
        status: 'done',
        completedAt: new Date().toISOString(),
        postTitle: post.title,
        postSlug: post.slug,
        autoPublish: settings.autoPublish,
      })
    } catch { /* non-critical */ }

    await saveCurationSettingsAdmin({ lastGeneratedAt: new Date().toISOString() })

    return NextResponse.json({
      success: true,
      id,
      title: post.title,
      status: settings.autoPublish ? 'published' : 'draft',
      videoCount: 1,
      videoTitle: item.title,
    })
  } catch (e) {
    console.error('[Cron] Magazine post generation failed:', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

// Admin manual trigger (POST)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const { force, autoPublish, sessionId, subcategory: bodySubcategory, runId: bodyRunId } = body as { force?: boolean; autoPublish?: boolean; sessionId?: string; subcategory?: string; runId?: string }

    const settings = await getCurationSettings()

    let item
    if (sessionId) {
      // 특정 요약 지정 생성
      item = await getSummaryBySessionIdAdmin(sessionId)
      if (!item) {
        return NextResponse.json({ error: `sessionId "${sessionId}"에 해당하는 요약을 찾을 수 없습니다.` }, { status: 404 })
      }
    } else if (bodyRunId) {
      // runId 있을 때: ai_pipeline_state에서 subcategory 기준으로 요약 찾기
      item = await pickItem(settings.lookbackDays, bodySubcategory)
      if (!item) {
        return NextResponse.json({ error: '발행할 요약을 찾을 수 없습니다. Summarize 단계가 완료됐는지 확인하세요.' }, { status: 422 })
      }
    } else {
      if (!force && (!settings.enabled || settings.schedule === 'manual')) {
        return NextResponse.json({ skipped: true, reason: 'Use force:true to override schedule' })
      }

      item = await pickItem(settings.lookbackDays, bodySubcategory)

      if (!item) {
        const reason = `최근 ${settings.lookbackDays}일 이내 미발행 요약 없음`
        await writeLog({ status: 'skipped', triggerType: 'manual', reason, createdAt: new Date().toISOString() })
        return NextResponse.json({
          error: `발행할 영상이 없습니다. ${reason}`,
          availableCount: 0,
        }, { status: 422 })
      }
    }

    const [ytResult, platformComments] = await Promise.all([
      item.ytCommentsContext
        ? Promise.resolve(null)
        : item.videoId
          ? fetchVideoComments(item.videoId).catch(() => ({ popular: [], recent: [], combined: [] }))
          : Promise.resolve({ popular: [], recent: [], combined: [] }),
      getPlatformCommentsBySessionIdAdmin(item.sessionId).catch(() => []),
    ])
    const commentsContext = item.ytCommentsContext
      || (ytResult && (ytResult.popular.length || ytResult.recent.length)
        ? formatCommentsForPrompt(ytResult.popular as any, ytResult.recent as any)
        : undefined)

    const post = await generateMagazinePost(item, commentsContext, platformComments)
    const id = await saveCuratedPostAdmin(post)

    const shouldPublish = autoPublish ?? settings.autoPublish
    if (shouldPublish) await publishCuratedPostAdmin(id)

    try {
      initAdminApp()
      const { getFirestore } = await import('firebase-admin/firestore')
      await getFirestore().collection('saved_summaries').doc(item.id).update({ postedToMagazine: true })
    } catch { /* non-critical */ }

    // 수동 발행은 lastGeneratedAt 갱신 안 함 — 자동 스케줄 방해 방지
    await writeLog({
      postId: id,
      postTitle: post.title,
      videoTitle: item.title,
      videoId: item.videoId,
      status: 'success',
      triggerType: 'manual',
      createdAt: new Date().toISOString(),
    })

    // pipeline_logs에 Publish 기록
    try {
      const sub = (bodySubcategory ?? item.aiSubcategory ?? getSubcategoryForSlot()) as import('@/lib/ai-curator').AiSubcategory
      const active = bodyRunId ? null : await getActiveRunId(sub)
      const runId = bodyRunId ?? active?.runId ?? await initPipelineLog(sub)
      await setActiveRunId(sub, runId, 'published')
      await logPublish(runId, {
        status: 'done',
        completedAt: new Date().toISOString(),
        postTitle: post.title,
        postSlug: post.slug,
        autoPublish: shouldPublish,
      })
    } catch { /* non-critical */ }

    return NextResponse.json({
      success: true,
      id,
      title: post.title,
      slug: post.slug,
      status: shouldPublish ? 'published' : 'draft',
      videoCount: 1,
      videoTitle: item.title,
    })
  } catch (e) {
    console.error('[Manual trigger] Magazine post generation failed:', e)
    await writeLog({ status: 'error', triggerType: 'manual', error: String(e), createdAt: new Date().toISOString() })
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
