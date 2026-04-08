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
