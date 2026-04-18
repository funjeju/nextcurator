import { NextRequest, NextResponse } from 'next/server'
import {
  getCurationSettings, saveCurationSettings,
  getRecentPublicSummaries, findBestCluster,
  generateMagazinePost, saveCuratedPost, publishCuratedPost,
  shouldGenerate,
} from '@/lib/magazine'

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
    const cluster = findBestCluster(summaries, settings.minVideoCount, settings.maxVideoCount)

    if (!cluster) {
      return NextResponse.json({
        skipped: true,
        reason: `Not enough videos (need ${settings.minVideoCount}, found max ${Math.max(...Object.values(
          summaries.reduce<Record<string, number>>((acc, s) => {
            if (s.topicCluster) acc[s.topicCluster] = (acc[s.topicCluster] ?? 0) + 1
            return acc
          }, {}),
        ).concat(0))})`
      })
    }

    const post = await generateMagazinePost(cluster.cluster, cluster.items)
    const id = await saveCuratedPost(post)

    if (settings.autoPublish) {
      await publishCuratedPost(id)
    }

    await saveCurationSettings({ lastGeneratedAt: new Date().toISOString() })

    return NextResponse.json({
      success: true,
      id,
      title: post.title,
      status: settings.autoPublish ? 'published' : 'draft',
      videoCount: cluster.items.length,
      cluster: cluster.cluster,
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
    const { force, autoPublish } = body as { force?: boolean; autoPublish?: boolean }

    const settings = await getCurationSettings()

    if (!force && !shouldGenerate(settings)) {
      return NextResponse.json({ skipped: true, reason: 'Use force:true to override schedule' })
    }

    const summaries = await getRecentPublicSummaries(settings.lookbackDays)
    const cluster = findBestCluster(summaries, settings.minVideoCount, settings.maxVideoCount)

    if (!cluster) {
      return NextResponse.json({
        error: `클러스터 부족. 최소 ${settings.minVideoCount}개 이상의 영상이 같은 주제(또는 카테고리)여야 합니다. 현재 조회된 공개 영상: ${summaries.length}개 (최근 ${settings.lookbackDays}일 기준)`,
        availableCount: summaries.length,
      }, { status: 422 })
    }

    const post = await generateMagazinePost(cluster.cluster, cluster.items)
    const id = await saveCuratedPost(post)

    const shouldPublish = autoPublish ?? settings.autoPublish
    if (shouldPublish) await publishCuratedPost(id)

    await saveCurationSettings({ lastGeneratedAt: new Date().toISOString() })

    return NextResponse.json({
      success: true,
      id,
      title: post.title,
      slug: post.slug,
      status: shouldPublish ? 'published' : 'draft',
      videoCount: cluster.items.length,
      cluster: cluster.cluster,
    })
  } catch (e) {
    console.error('[Manual trigger] Magazine post generation failed:', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
