import { NextRequest, NextResponse } from 'next/server'
import { runFirestoreQuery } from '@/lib/firestore-rest'
import { checkIsAdminByToken } from '@/lib/admin'

export async function POST(req: NextRequest) {
  try {
    const idToken = req.headers.get('Authorization')?.replace('Bearer ', '') ?? ''
    const isAdmin = await checkIsAdminByToken(idToken)
    if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { search = '', role = 'all', plan = 'all', page = 1 } = await req.json()
    const PAGE_SIZE = 20

    // 전체 users 조회 (최대 500명) — orderBy 없이 전체 조회 후 클라이언트 정렬
    // orderBy를 쓰면 해당 필드 없는 문서가 제외됨
    const users = await runFirestoreQuery('users', {
      limit: 500,
    })

    // 최신순 정렬 (createdAt → updatedAt → 없으면 맨 뒤)
    let filtered = (users as any[]).sort((a, b) => {
      const aTime = a.createdAt || a.updatedAt || ''
      const bTime = b.createdAt || b.updatedAt || ''
      return bTime > aTime ? 1 : bTime < aTime ? -1 : 0
    })

    // role 필터
    if (role !== 'all') {
      if (role === 'none') {
        filtered = filtered.filter(u => !u.role)
      } else {
        filtered = filtered.filter(u => u.role === role)
      }
    }

    // plan 필터
    if (plan !== 'all') {
      filtered = filtered.filter(u => (u.plan || 'free') === plan)
    }

    // 검색
    if (search.trim()) {
      const q = search.toLowerCase()
      filtered = filtered.filter(u =>
        (u.displayName || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q) ||
        (u.studentName || '').toLowerCase().includes(q) ||
        (u.schoolName || '').toLowerCase().includes(q) ||
        (u.classCode || '').toLowerCase().includes(q)
      )
    }

    const total = filtered.length
    const offset = (page - 1) * PAGE_SIZE
    const paged = filtered.slice(offset, offset + PAGE_SIZE)

    // 요약 통계
    const stats = {
      total: users.length,
      teachers: (users as any[]).filter(u => u.role === 'teacher').length,
      students: (users as any[]).filter(u => u.role === 'student').length,
      general: (users as any[]).filter(u => !u.role).length,
      paid: (users as any[]).filter(u => u.plan === 'paid' || u.plan === 'pro').length,
    }

    return NextResponse.json({ users: paged, total, page, pageSize: PAGE_SIZE, stats })
  } catch (error: any) {
    console.error('[Admin Users] Error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
