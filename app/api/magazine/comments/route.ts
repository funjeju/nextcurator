import { NextRequest, NextResponse } from 'next/server'
import { initAdminApp } from '@/lib/firebase-admin'

export interface MagazineComment {
  id: string
  postId: string
  author: string
  text: string
  createdAt: string
  likeCount: number
}

async function getDb() {
  initAdminApp()
  const { getFirestore } = await import('firebase-admin/firestore')
  return getFirestore()
}

// GET /api/magazine/comments?postId=xxx
export async function GET(req: NextRequest) {
  const postId = req.nextUrl.searchParams.get('postId')
  if (!postId) return NextResponse.json({ error: 'postId required' }, { status: 400 })

  try {
    const db = await getDb()
    const snap = await db.collection('magazine_comments')
      .where('postId', '==', postId)
      .limit(100)
      .get()
    const comments = snap.docs
      .map(d => ({ id: d.id, ...d.data() } as MagazineComment))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    return NextResponse.json(comments)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

// POST /api/magazine/comments  { postId, author, text }
export async function POST(req: NextRequest) {
  try {
    const { postId, author, text } = await req.json()
    if (!postId || !text?.trim()) {
      return NextResponse.json({ error: 'postId and text required' }, { status: 400 })
    }
    const trimmedText = String(text).trim().slice(0, 500)
    const trimmedAuthor = String(author || '익명').trim().slice(0, 30)

    const db = await getDb()
    const ref = await db.collection('magazine_comments').add({
      postId,
      author: trimmedAuthor,
      text: trimmedText,
      createdAt: new Date().toISOString(),
      likeCount: 0,
    })
    return NextResponse.json({ id: ref.id, ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

// PATCH /api/magazine/comments  { id } — like +1
export async function PATCH(req: NextRequest) {
  try {
    const { id } = await req.json()
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const db = await getDb()
    const { FieldValue } = await import('firebase-admin/firestore')
    await db.collection('magazine_comments').doc(id).update({ likeCount: FieldValue.increment(1) })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
