import { NextRequest, NextResponse } from 'next/server'
import { checkIsAdminByToken } from '@/lib/admin'
import { initAdminApp } from '@/lib/firebase-admin'

const PAGE_SIZE = 12

export async function POST(req: NextRequest) {
  try {
    const { search = '', page = 1, showHidden = false } = await req.json()
    const idToken = req.headers.get('Authorization')?.replace('Bearer ', '') ?? ''
    const isAdmin = await checkIsAdminByToken(idToken)
    if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    initAdminApp()
    const { getFirestore } = await import('firebase-admin/firestore')
    const db = getFirestore()

    let q = db.collection('saved_summaries')
      .where('isPublic', '==', true)
      .orderBy('createdAt', 'desc')
      .limit(500) as FirebaseFirestore.Query

    if (!showHidden) {
      // adminHidden 필드가 없거나 false인 것만 — Firestore는 != 쿼리가 제한적이라 클라이언트 필터
    }

    const snap = await q.get()
    let items = snap.docs.map(d => {
      const data = d.data()
      return {
        id: d.id,
        sessionId: data.sessionId ?? '',
        videoId: data.videoId ?? '',
        title: data.title ?? '',
        channel: data.channel ?? '',
        thumbnail: data.thumbnail ?? '',
        category: data.category ?? '',
        userId: data.userId ?? '',
        userDisplayName: data.userDisplayName ?? '',
        ytViewCount: data.ytViewCount ?? 0,
        adminHidden: data.adminHidden ?? false,
        autoCollected: data.autoCollected ?? false,
        createdAt: data.createdAt?.toDate?.()?.toISOString() ?? '',
      }
    })

    if (!showHidden) {
      items = items.filter(i => !i.adminHidden)
    }

    if (search) {
      const q2 = search.toLowerCase()
      items = items.filter(i =>
        i.title.toLowerCase().includes(q2) ||
        i.channel.toLowerCase().includes(q2) ||
        i.userDisplayName.toLowerCase().includes(q2)
      )
    }

    const total = items.length
    const paginated = items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

    return NextResponse.json({ items: paginated, total, page, pageSize: PAGE_SIZE })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { id, action } = await req.json() // action: 'hide' | 'show' | 'delete'
    const idToken = req.headers.get('Authorization')?.replace('Bearer ', '') ?? ''
    const isAdmin = await checkIsAdminByToken(idToken)
    if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if (!id || !action) return NextResponse.json({ error: 'id and action required' }, { status: 400 })

    initAdminApp()
    const { getFirestore } = await import('firebase-admin/firestore')
    const db = getFirestore()
    const ref = db.collection('saved_summaries').doc(id)

    if (action === 'delete') {
      await ref.delete()
    } else if (action === 'hide') {
      await ref.update({ adminHidden: true, isPublic: false })
    } else if (action === 'show') {
      await ref.update({ adminHidden: false, isPublic: true })
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
