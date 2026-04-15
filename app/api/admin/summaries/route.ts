import { NextRequest, NextResponse } from 'next/server'
import { runFirestoreQuery } from '@/lib/firestore-rest'
import { checkIsAdminByToken } from '@/lib/admin'

const PAGE_SIZE = 10

export async function POST(req: NextRequest) {
  try {
    const { search = '', page = 1 } = await req.json()
    const idToken = req.headers.get('Authorization')?.replace('Bearer ', '') ?? ''
    const isAdmin = await checkIsAdminByToken(idToken)
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const offset = (page - 1) * PAGE_SIZE

    // 검색 시: 넓게 가져와서 필터 / 일반 조회: 페이지 단위로만
    const fetchLimit = search ? 500 : PAGE_SIZE
    const fetchOffset = search ? 0 : offset

    const summaries = await runFirestoreQuery('summaries', {
      limit: fetchLimit,
      offset: fetchOffset,
      orderBy: [{ field: { fieldPath: 'summarizedAt' }, direction: 'DESCENDING' }],
    })

    let savedList: any[] = []
    try {
      savedList = await runFirestoreQuery('saved_summaries', { limit: 500 })
    } catch {
      // 403 등 실패 시 빈 배열로 진행
    }

    const savedMap = new Map()
    savedList.forEach((s: any) => savedMap.set(s.sessionId, s))

    let processed = summaries.map((s: any) => {
      const saved = savedMap.get(s.id)
      return {
        ...s,
        isSaved: !!saved,
        userDisplayName: saved?.userDisplayName || '익명 (캐시)',
        userId: saved?.userId || '',
        createdAt: s.summarizedAt || s.createdAt || '',
        originalId: s.id,
      }
    })

    if (search) {
      const q = search.toLowerCase()
      processed = processed.filter((s: any) =>
        (s.title || '').toLowerCase().includes(q) ||
        (s.userDisplayName || '').toLowerCase().includes(q) ||
        (s.id || '').toLowerCase().includes(q)
      )
      // 검색 결과도 페이지 단위로 자름
      const total = processed.length
      processed = processed.slice(offset, offset + PAGE_SIZE)
      return NextResponse.json({ summaries: processed, total, page, pageSize: PAGE_SIZE })
    }

    // 전체 건수는 별도 집계 쿼리로
    return NextResponse.json({ summaries: processed, page, pageSize: PAGE_SIZE })
  } catch (error: any) {
    console.error('[Admin API] Error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
