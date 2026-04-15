import { NextRequest, NextResponse } from 'next/server'
import { FIRESTORE_BASE } from '@/lib/firestore-rest'
import { checkIsAdminByToken } from '@/lib/admin'

const API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY!

export async function POST(req: NextRequest) {
  try {
    const { id } = await req.json()
    const idToken = req.headers.get('Authorization')?.replace('Bearer ', '') ?? ''
    const isAdmin = await checkIsAdminByToken(idToken)
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 })
    }

    // 1. 전체 캐시(summaries) 삭제
    const url = `${FIRESTORE_BASE}/summaries/${id}?key=${API_KEY}`
    const res = await fetch(url, { method: 'DELETE' })

    if (!res.ok && res.status !== 404) {
      const errBody = await res.text()
      console.error(`[Admin] Summary ${id} delete failed: ${res.status} ${errBody}`)
      return NextResponse.json({ error: `Firestore delete failed: ${res.status}` }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
