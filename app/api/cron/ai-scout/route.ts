/**
 * CRON A: AI Scout
 * 화이트리스트 채널 + 키워드 검색으로 후보 수집 → Firestore ai_scout_queue 저장
 * KST 06:00 / 14:00 / 22:00 (UTC 21:00 / 05:00 / 13:00)
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  AiSubcategory,
  scoutCandidates,
  saveScoutQueue,
} from '@/lib/ai-curator'
import { initAdminApp } from '@/lib/firebase-admin'

export const maxDuration = 60

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return req.headers.get('authorization') === `Bearer ${secret}`
}

// 이미 수집된 videoId Set 조회
async function getAlreadyCollectedIds(): Promise<Set<string>> {
  try {
    initAdminApp()
    const { getFirestore } = await import('firebase-admin/firestore')
    const db = getFirestore()
    // saved_summaries에서 최근 200개 videoId 조회
    const snap = await db.collection('saved_summaries')
      .orderBy('createdAt', 'desc')
      .limit(200)
      .get()
    const ids = new Set<string>()
    snap.forEach(doc => {
      const vid = doc.data().videoId as string
      if (vid) ids.add(vid)
    })
    return ids
  } catch {
    return new Set()
  }
}

// 시간 기반으로 이번 슬롯의 카테고리 결정
function getSubcategoryForSlot(): AiSubcategory {
  const hour = new Date().getUTCHours()
  // UTC 21 → KST 06 → news
  // UTC 05 → KST 14 → tools
  // UTC 13 → KST 22 → usecases
  if (hour >= 20 && hour < 24) return 'news'
  if (hour >= 4 && hour < 8)   return 'tools'
  return 'usecases'
}

async function runScout(subcategory: AiSubcategory) {
  const alreadyIds = await getAlreadyCollectedIds()
  const channelIdCache = new Map<string, string>()

  console.log(`[AI Scout] Starting: subcategory=${subcategory}, excluded=${alreadyIds.size}`)

  const candidates = await scoutCandidates(subcategory, channelIdCache, alreadyIds)

  console.log(`[AI Scout] Found ${candidates.length} candidates for ${subcategory}`)

  if (candidates.length === 0) {
    return NextResponse.json({ success: true, found: 0, subcategory, message: 'No candidates found' })
  }

  await saveScoutQueue(candidates)

  return NextResponse.json({
    success: true,
    subcategory,
    found: candidates.length,
    candidates: candidates.map(c => ({
      videoId: c.videoId,
      title: c.title.slice(0, 60),
      source: c.source,
      publishedAt: c.publishedAt,
    })),
  })
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const subcategory = getSubcategoryForSlot()
  return runScout(subcategory)
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as { subcategory?: AiSubcategory; force?: boolean }
  if (!body.force) {
    return NextResponse.json({ error: 'force:true required' }, { status: 400 })
  }
  const subcategory = body.subcategory ?? getSubcategoryForSlot()
  return runScout(subcategory)
}
