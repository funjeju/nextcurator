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

// 최상위 컬렉션에서 userId 필드로 문서 ID 목록 조회
async function queryDocIdsByUserId(
  collectionId: string,
  uid: string,
  idToken: string,
  userField = 'userId'
): Promise<string[]> {
  try {
    const url = `${FIRESTORE_BASE}:runQuery?key=${API_KEY}`
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId }],
          where: {
            fieldFilter: {
              field: { fieldPath: userField },
              op: 'EQUAL',
              value: { stringValue: uid },
            },
          },
          select: { fields: [{ fieldPath: '__name__' }] },
          limit: 500,
        },
      }),
    })
    if (!res.ok) return []
    const results = await res.json()
    if (!Array.isArray(results)) return []
    return results
      .filter((r: any) => r.document?.name)
      .map((r: any) => r.document.name.split('/documents/')[1])
  } catch {
    return []
  }
}

async function deleteFirestoreDoc(path: string, idToken: string): Promise<void> {
  try {
    await fetch(`${FIRESTORE_BASE}/${path}?key=${API_KEY}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${idToken}` },
    })
  } catch {
    // 삭제 실패는 무시 (이미 없는 문서일 수 있음)
  }
}

// array-contains 쿼리 (friendships.uids 등)
async function queryDocsByArrayContains(
  collectionId: string,
  field: string,
  value: string,
  idToken: string
): Promise<string[]> {
  try {
    const url = `${FIRESTORE_BASE}:runQuery?key=${API_KEY}`
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId }],
          where: {
            fieldFilter: {
              field: { fieldPath: field },
              op: 'ARRAY_CONTAINS',
              value: { stringValue: value },
            },
          },
          select: { fields: [{ fieldPath: '__name__' }] },
          limit: 200,
        },
      }),
    })
    if (!res.ok) return []
    const results = await res.json()
    if (!Array.isArray(results)) return []
    return results
      .filter((r: any) => r.document?.name)
      .map((r: any) => r.document.name.split('/documents/')[1])
  } catch {
    return []
  }
}

async function deleteBatch(paths: string[], idToken: string): Promise<void> {
  // 20개씩 병렬 처리
  for (let i = 0; i < paths.length; i += 20) {
    await Promise.all(paths.slice(i, i + 20).map(p => deleteFirestoreDoc(p, idToken)))
  }
}

async function deleteFirebaseAuthAccount(idToken: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      }
    )
    if (res.ok) return { ok: true }
    const data = await res.json()
    return { ok: false, error: data?.error?.message || 'AUTH_DELETE_FAILED' }
  } catch (e: any) {
    return { ok: false, error: e.message }
  }
}

export async function POST(req: NextRequest) {
  try {
    const idToken = req.headers.get('Authorization')?.replace('Bearer ', '') ?? ''
    if (!idToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const uid = await getUidFromToken(idToken)
    if (!uid) return NextResponse.json({ error: '유효하지 않은 토큰입니다.' }, { status: 401 })

    // 본문에서 classCode 읽기 (학생 탈퇴용)
    const body = await req.json().catch(() => ({}))
    const classCode: string | null = body.classCode || null

    // 1. 최상위 컬렉션에서 본인 문서 ID 조회 (병렬)
    const [savedIds, folderIds, friendReqFromIds, friendReqToIds] = await Promise.all([
      queryDocIdsByUserId('saved_summaries', uid, idToken),           // userId 필드
      queryDocIdsByUserId('folders', uid, idToken),                    // userId 필드
      queryDocIdsByUserId('friend_requests', uid, idToken, 'fromUid'), // fromUid 필드
      queryDocIdsByUserId('friend_requests', uid, idToken, 'toUid'),   // toUid 필드
    ])

    // 2. friendships: uids array-contains (REST API 지원)
    const friendshipIds = await queryDocsByArrayContains('friendships', 'uids', uid, idToken)

    // 3. Firestore 데이터 삭제 (병렬)
    await Promise.all([
      deleteFirestoreDoc(`users/${uid}`, idToken),
      deleteBatch(savedIds, idToken),
      deleteBatch(folderIds, idToken),
      deleteBatch([...friendReqFromIds, ...friendReqToIds], idToken),
      deleteBatch(friendshipIds, idToken),
    ])

    // 4. 학생인 경우 클래스 students 서브컬렉션에서 제거
    if (classCode) {
      await deleteFirestoreDoc(`classes/${classCode}/students/${uid}`, idToken)
    }

    // 5. Firebase Auth 계정 삭제 (마지막 — 이후 idToken 무효화)
    const authResult = await deleteFirebaseAuthAccount(idToken)
    if (!authResult.ok) {
      // Auth 삭제 실패 시 — Firestore 데이터는 이미 지워졌지만 Auth만 남은 상태
      // CREDENTIAL_TOO_OLD_LOGIN_AGAIN 등의 경우 재로그인 안내
      const needsRelogin = authResult.error?.includes('CREDENTIAL_TOO_OLD') ||
                           authResult.error?.includes('TOKEN_EXPIRED')
      return NextResponse.json({
        error: needsRelogin
          ? '보안을 위해 재로그인 후 다시 탈퇴해주세요.'
          : `계정 삭제 실패: ${authResult.error}`,
      }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[User Delete] Error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
