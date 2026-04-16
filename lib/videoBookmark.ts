import { db } from './firebase'
import {
  collection, doc, addDoc, getDocs, deleteDoc,
  query, where, serverTimestamp,
} from 'firebase/firestore'

export interface VideoBookmark {
  id: string
  userId: string
  videoId: string
  sessionId: string
  videoTitle: string
  thumbnail: string
  channel: string
  timestampSec: number
  timestampLabel: string  // MM:SS
  memo: string
  createdAt: any
}

export function secsToLabel(secs: number): string {
  const s = Math.floor(secs)
  const m = Math.floor(s / 60)
  const h = Math.floor(m / 60)
  if (h > 0) {
    return `${h}:${String(m % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
  }
  return `${m}:${String(s % 60).padStart(2, '0')}`
}

export async function getBookmarks(userId: string): Promise<VideoBookmark[]> {
  const q = query(
    collection(db, 'video_bookmarks'),
    where('userId', '==', userId),
  )
  const snap = await getDocs(q)
  const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as VideoBookmark))
  return list.sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0))
}

export async function addBookmark(
  userId: string,
  data: Omit<VideoBookmark, 'id' | 'userId' | 'createdAt'>,
): Promise<string> {
  const ref = await addDoc(collection(db, 'video_bookmarks'), {
    ...data,
    userId,
    createdAt: serverTimestamp(),
  })
  return ref.id
}

export async function deleteBookmark(id: string): Promise<void> {
  await deleteDoc(doc(db, 'video_bookmarks', id))
}
