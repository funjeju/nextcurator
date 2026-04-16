import { db } from './firebase'
import {
  collection, doc, addDoc, getDocs, deleteDoc,
  query, where, orderBy, serverTimestamp,
} from 'firebase/firestore'

export interface SavedShortsSegment {
  id: number
  title: string
  start_time: string
  end_time: string
  start_seconds: number
  end_seconds: number
  duration_seconds: number
  script: string
  hook: string
  type: 'hook' | 'tip' | 'highlight' | 'emotion'
}

export interface SavedShortsScript {
  id: string
  userId: string
  videoId: string
  sessionId: string
  videoTitle: string
  channel: string
  thumbnail: string
  segments: SavedShortsSegment[]
  edit_tips: string
  createdAt: any
}

export async function getSavedShortsScripts(userId: string): Promise<SavedShortsScript[]> {
  const q = query(
    collection(db, 'shorts_scripts'),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc'),
  )
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as SavedShortsScript))
}

export async function saveShortsScript(
  userId: string,
  script: Omit<SavedShortsScript, 'id' | 'userId' | 'createdAt'>,
): Promise<string> {
  const ref = await addDoc(collection(db, 'shorts_scripts'), {
    ...script,
    userId,
    createdAt: serverTimestamp(),
  })
  return ref.id
}

export async function deleteShortsScript(scriptId: string): Promise<void> {
  await deleteDoc(doc(db, 'shorts_scripts', scriptId))
}
