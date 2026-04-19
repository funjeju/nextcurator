import { NextRequest, NextResponse } from 'next/server'
import {
  getRecentPublicSummaries, pickBestSingle,
  generateMagazinePost,
  shouldGenerate,
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

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const settings = await getCurationSettings()

    if (!shouldGenerate(settings)) {
      return NextResponse.json({ skipped: true, reason: 'Not time yet or schedule=manual' })
    }

    const summaries = await getRecentPublicSummaries(settings.lookbackDays)
    const item = pickBestSingle(summaries)

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

    // 발행된 summary에 postedToMagazine 마킹
    try {
      initAdminApp()
      const { getFirestore } = await import('firebase-admin/firestore')
      await getFirestore().collection('saved_summaries').doc(item.id).update({ postedToMagazine: true })
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
      if (!force && !shouldGenerate(settings)) {
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

    await saveCurationSettingsAdmin({ lastGeneratedAt: new Date().toISOString() })

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
