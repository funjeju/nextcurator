import { db } from './firebase'
import { collection, addDoc, getDocs, query, where, deleteDoc, doc, serverTimestamp } from 'firebase/firestore'

export interface Comment {
  id: string
  sessionId: string
  segmentId: string | null      // null = 영상 전체 댓글
  segmentLabel: string | null   // "Step 3", "타임라인 2번째" 등
  parentId: string | null       // null = 최상위, 있으면 대댓글
  userId: string
  userDisplayName: string
  userPhotoURL: string
  text: string
  createdAt: any
  isAI?: boolean                // AI가 생성한 댓글
}

export async function getCommentsBySession(sessionId: string): Promise<Comment[]> {
  const q = query(collection(db, 'comments'), where('sessionId', '==', sessionId))
  const snap = await getDocs(q)
  const items = snap.docs.map(d => ({ id: d.id, ...d.data() }) as Comment)
  return items.sort((a, b) => (a.createdAt?.toMillis?.() ?? 0) - (b.createdAt?.toMillis?.() ?? 0))
}

export async function addComment(data: Omit<Comment, 'id' | 'createdAt'>): Promise<Comment> {
  const docRef = await addDoc(collection(db, 'comments'), { ...data, createdAt: serverTimestamp() })
  return { id: docRef.id, ...data, createdAt: new Date() }
}

export async function deleteComment(commentId: string): Promise<void> {
  await deleteDoc(doc(db, 'comments', commentId))
}

/** sessionId 배열에 대한 댓글 수 일괄 조회 (스퀘어 카드용)
 *  30개씩 배치 in-query로 처리 — 불필요한 문서 내용은 무시하고 sessionId만 카운트
 */
export async function getCommentCountsBySessionIds(sessionIds: string[]): Promise<Record<string, number>> {
  if (!sessionIds.length) return {}
  const counts: Record<string, number> = {}
  for (const sid of sessionIds) counts[sid] = 0

  const unique = [...new Set(sessionIds)]
  for (let i = 0; i < unique.length; i += 30) {
    const batch = unique.slice(i, i + 30)
    try {
      const snap = await getDocs(
        query(collection(db, 'comments'), where('sessionId', 'in', batch))
      )
      snap.docs.forEach(d => {
        const sid = d.data().sessionId as string
        counts[sid] = (counts[sid] ?? 0) + 1
      })
    } catch { /* 권한 문제 등 무시 */ }
  }
  return counts
}
