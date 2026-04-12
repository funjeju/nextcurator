import { NextRequest, NextResponse } from 'next/server'
import { FIRESTORE_BASE } from '@/lib/firestore-rest'
import { checkIsAdmin } from '@/lib/admin'

const API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY!

export async function POST(req: NextRequest) {
  try {
    const { uid, email, id } = await req.json()
    const isAdmin = await checkIsAdmin(uid, email)
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 })
    }

    // 1. 전체 캐시(summaries) 삭제
    const url = `${FIRESTORE_BASE}/summaries/${id}?key=${API_KEY}`
    const res = await fetch(url, { method: 'DELETE' })

    if (!res.ok) {
      // 이미 삭제되었을 수도 있으므로 실패하더라도 계속 진행하거나 로그 남김
      console.warn(`[Admin] Summary ${id} delete failed or already gone: ${res.status}`)
    }

    // 2. 만약 저장된 항목(saved_summaries)이 있다면 그것도 함께 삭제할지는 선택사항.
    // 여기서는 캐시 삭제를 명확히 하여 '재분석'이 가능하게 만드는 것을 우선합니다.

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
