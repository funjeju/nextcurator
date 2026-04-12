import { NextRequest, NextResponse } from 'next/server'
import { runFirestoreQuery } from '@/lib/firestore-rest'
import { checkIsAdmin } from '@/lib/admin'

export async function POST(req: NextRequest) {
  try {
    const { uid, email, search = '' } = await req.json()
    const isAdmin = await checkIsAdmin(uid, email)
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 1. 전체 분석 기록(summaries) 가져오기
    // 정렬(orderBy)을 제거하여 필드가 없는 데이터도 모두 나오게 함 (데이터 유실 방지)
    const summaries = await runFirestoreQuery('summaries', { 
      limit: 100 
    })

    // 2. 수동 정렬 (최신순 - summarizedAt 또는 createdAt 기준)
    const sorted = summaries.sort((a, b) => {
      const dateA = a.summarizedAt || a.createdAt || ''
      const dateB = b.summarizedAt || b.createdAt || ''
      return dateB.localeCompare(dateA)
    })

    // 3. 실제 저장본(saved_summaries)과 비교하기 위해 sessionId 목록 추출
    // 전체를 다 가져오기엔 무거우므로 통계용으로만 사용하거나 부분 조회 필요
    let savedList: any[] = []
    try {
      savedList = await runFirestoreQuery('saved_summaries', { limit: 500 })
    } catch (e) {
      console.warn('[Admin] Failed to fetch saved_summaries (possibly 403), proceeding with empty list')
    }
    
    const savedMap = new Map()
    savedList.forEach((s: any) => savedMap.set(s.sessionId, s))

    // 4. 데이터 가공 (저장 여부 플래그 추가)
    let processed = sorted.map((s: any) => {
      const saved = savedMap.get(s.id)
      return {
        ...s,
        isSaved: !!saved,
        userDisplayName: saved?.userDisplayName || '익명 (캐시)',
        userId: saved?.userId || '',
        createdAt: s.summarizedAt || s.createdAt || '',
        originalId: s.id
      }
    })

    if (search) {
      const q = search.toLowerCase()
      processed = processed.filter((s: any) => 
        (s.title || '').toLowerCase().includes(q) || 
        (s.userDisplayName || '').toLowerCase().includes(q) ||
        (s.id || '').toLowerCase().includes(q)
      )
    }

    return NextResponse.json({ summaries: processed })
  } catch (error: any) {
    console.error('[Admin API] Error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
