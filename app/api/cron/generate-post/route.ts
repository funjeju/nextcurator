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
async function pickItem(lookbackDays: number) {
  try {
    initAdminApp()
    const { getFirestore } = await import('firebase-admin/firestore')
    const db = getFirestore()

    const subcategory = getSubcategoryForSlot()
    const slotDoc = await db.collection('ai_pipeline').doc(`${subcategory}_slot`).get()

    if (slotDoc.exists) {
      const slot = slotDoc.data()!
      // status가 ready여야 하고, 1시간 이내 저장된 것만 유효
      const savedAt = new Date(slot.savedAt as string).getTime()
      const isRecent = Date.now() - savedAt < 90 * 60 * 1000 // 90분 이내
      if (slot.status === 'ready' && isRecent && slot.savedSummaryId) {
        const summaryDoc = await db.collection('saved_summaries').doc(slot.savedSummaryId as string).get()
        if (summaryDoc.exists && !summaryDoc.data()?.postedToMagazine) {
          console.log(`[generate-post] Picked from ai_pipeline slot: ${slot.title}`)
          // 슬롯 상태를 'processing'으로 변경 (중복 발행 방지)
          await slotDoc.ref.update({ status: 'processing' })
          return { id: summaryDoc.id, ...summaryDoc.data() } as any
        }
      }
    }
  } catch (e) {
    console.warn('[generate-post] ai_pipeline slot read failed, falling back:', e)
  }

  // 폴백: 기존 로직
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

    // 발행된 summary에 postedToMagazine 마킹 + 슬롯 문서 완료 처리
    try {
      initAdminApp()
      const { getFirestore } = await import('firebase-admin/firestore')
      const db = getFirestore()
      await db.collection('saved_summaries').doc(item.id).update({ postedToMagazine: true })
      const subcategory = getSubcategoryForSlot()
      await db.collection('ai_pipeline').doc(`${subcategory}_slot`).update({ status: 'published', publishedPostId: id }).catch(() => {})
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
    const { force, autoPublish, sessionId } = body as { force?: boolean; autoPublish?: boolean; sessionId?: string }

    const settings = await getCurationSettings()

    let item
    if (sessionId) {
      // 특정 요약 지정 생성
      item = await getSummaryBySessionIdAdmin(sessionId)
      if (!item) {
        return NextResponse.json({ error: `sessionId "${sessionId}"에 해당하는 요약을 찾을 수 없습니다.` }, { status: 404 })
      }
    } else {
      if (!force && (!settings.enabled || settings.schedule === 'manual')) {
        return NextResponse.json({ skipped: true, reason: 'Use force:true to override schedule' })
      }

      const summaries = await getRecentPublicSummaries(settings.lookbackDays)
      item = pickBestSingle(summaries)

      if (!item) {
        const reason = `최근 ${settings.lookbackDays}일 이내 미발행 요약 없음`
        await writeLog({ status: 'skipped', triggerType: 'manual', reason, createdAt: new Date().toISOString() })
        return NextResponse.json({
          error: `발행할 영상이 없습니다. ${reason}`,
          availableCount: summaries.length,
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
