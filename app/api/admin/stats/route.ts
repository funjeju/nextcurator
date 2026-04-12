import { NextRequest, NextResponse } from 'next/server'
import { runFirestoreQuery } from '@/lib/firestore-rest'
import { checkIsAdmin } from '@/lib/admin'

export async function POST(req: NextRequest) {
  try {
    const { uid, email } = await req.json()
    const isAdmin = await checkIsAdmin(uid, email)
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 1. 전체 분석 캐시 수 (가장 상위 집합)
    const allSummaries = await runFirestoreQuery('summaries', { limit: 1000 })
    
    // 2. 실제 저장된 요약 수
    const savedSummaries = await runFirestoreQuery('saved_summaries', { limit: 1000 })

    // 3. 전체 유저 수
    const allUsers = await runFirestoreQuery('users', { limit: 1000 })

    // 4. 오늘 분석된 영상 수 (summarizedAt 기준)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayISO = today.toISOString()

    const todaySummaries = allSummaries.filter((s: any) => {
      const date = s.summarizedAt || s.createdAt || ''
      return date >= todayISO
    })

    return NextResponse.json({
      totalSummaries: allSummaries.length,
      totalSaved: savedSummaries.length,
      totalUsers: allUsers.length,
      todaySummaries: todaySummaries.length,
      recentItems: allSummaries.slice(0, 5)
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
