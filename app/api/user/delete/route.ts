import { NextRequest, NextResponse } from 'next/server'

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!
const API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY!
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`

async function getUidFromToken(idToken: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      }
    )
    if (!res.ok) return null
    const data = await res.json()
    return data?.users?.[0]?.localId ?? null
  } catch {
    return null
  }
}

async function deleteFirestoreDoc(path: string, idToken: string) {
  const url = `${FIRESTORE_BASE}/${path}?key=${API_KEY}`
  await fetch(url, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`,
    },
  })
}

async function listSubCollection(path: string, idToken: string): Promise<string[]> {
  const url = `${FIRESTORE_BASE}/${path}?key=${API_KEY}&pageSize=200`
  try {
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${idToken}` },
    })
    if (!res.ok) return []
    const data = await res.json()
    return (data.documents ?? []).map((d: any) => d.name.split('/documents/')[1])
  } catch {
    return []
  }
}

async function deleteFirebaseAuthAccount(idToken: string): Promise<boolean> {
  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      }
    )
    return res.ok
  } catch {
    return false
  }
}

export async function POST(req: NextRequest) {
  try {
    const idToken = req.headers.get('Authorization')?.replace('Bearer ', '') ?? ''
    if (!idToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const uid = await getUidFromToken(idToken)
    if (!uid) return NextResponse.json({ error: 'Invalid token' }, { status: 401 })

    // 1. users 문서 삭제
    await deleteFirestoreDoc(`users/${uid}`, idToken)

    // 2. 저장된 요약(savedSummaries) 삭제
    const summaries = await listSubCollection(`users/${uid}/savedSummaries`, idToken)
    await Promise.all(summaries.map(p => deleteFirestoreDoc(p, idToken)))

    // 3. 폴더(folders) 삭제
    const folders = await listSubCollection(`users/${uid}/folders`, idToken)
    await Promise.all(folders.map(p => deleteFirestoreDoc(p, idToken)))

    // 4. 친구 관계 삭제 (friends, friendRequests)
    const friends = await listSubCollection(`users/${uid}/friends`, idToken)
    await Promise.all(friends.map(p => deleteFirestoreDoc(p, idToken)))

    const friendReqs = await listSubCollection(`users/${uid}/friendRequests`, idToken)
    await Promise.all(friendReqs.map(p => deleteFirestoreDoc(p, idToken)))

    // 5. 학생인 경우: 클래스에서 제거 (user 문서에서 classCode 조회 불가하므로 클라이언트가 전달)
    const { classCode } = await req.json().catch(() => ({}))
    if (classCode) {
      await deleteFirestoreDoc(`classes/${classCode}/students/${uid}`, idToken)
    }

    // 6. Firebase Auth 계정 삭제
    const authDeleted = await deleteFirebaseAuthAccount(idToken)
    if (!authDeleted) {
      return NextResponse.json({ error: '계정 삭제에 실패했습니다. 다시 로그인 후 시도해주세요.' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[User Delete] Error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
