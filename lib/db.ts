import { db } from './firebase'
import { collection, doc, setDoc, getDocs, getDoc, query, where, addDoc, deleteDoc, serverTimestamp } from 'firebase/firestore'
import { SummaryData } from '@/types/summary'

export interface Folder {
  id: string
  userId: string
  name: string
  createdAt: any
}

export interface SavedSummary {
  id: string
  userId: string
  folderId: string
  sessionId: string
  videoId: string
  title: string
  thumbnail: string
  category: string
  square_meta?: any
  isPublic: boolean
  createdAt: any
  transcript?: string
}

export async function getUserFolders(userId: string): Promise<Folder[]> {
  const foldersRef = collection(db, 'folders')
  const q = query(foldersRef, where('userId', '==', userId))
  const snapshot = await getDocs(q)
  const folders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Folder)
  // 복합 인덱스 없이 클라이언트에서 정렬
  return folders.sort((a, b) => {
    const aTime = a.createdAt?.toMillis?.() ?? a.createdAt?.getTime?.() ?? 0
    const bTime = b.createdAt?.toMillis?.() ?? b.createdAt?.getTime?.() ?? 0
    return bTime - aTime
  })
}

export async function createFolder(userId: string, name: string): Promise<Folder> {
  const foldersRef = collection(db, 'folders')
  const docRef = await addDoc(foldersRef, {
    userId,
    name,
    createdAt: serverTimestamp()
  })
  return { id: docRef.id, userId, name, createdAt: new Date() }
}

export async function saveSummary({
  userId,
  folderId,
  sessionId,
  videoId,
  title,
  thumbnail,
  category,
  square_meta,
  isPublic = false,
  transcript
}: Partial<SavedSummary>): Promise<string> {
  const savedRef = collection(db, 'saved_summaries')
  const docRef = await addDoc(savedRef, {
    userId,
    folderId,
    sessionId,
    videoId,
    title,
    thumbnail,
    category,
    square_meta,
    isPublic,
    transcript,
    createdAt: serverTimestamp()
  })
  return docRef.id
}

export async function deleteSavedSummary(id: string): Promise<void> {
  await deleteDoc(doc(db, 'saved_summaries', id))
}

export async function getPublicSummaries(): Promise<SavedSummary[]> {
  const savedRef = collection(db, 'saved_summaries')
  const q = query(savedRef, where('isPublic', '==', true))
  const snapshot = await getDocs(q)
  const summaries = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as SavedSummary)
  return summaries.sort((a, b) => {
    const aTime = a.createdAt?.toMillis?.() ?? a.createdAt?.getTime?.() ?? 0
    const bTime = b.createdAt?.toMillis?.() ?? b.createdAt?.getTime?.() ?? 0
    return bTime - aTime
  })
}

export async function getSavedSummariesByFolder(userId: string, folderId: string): Promise<SavedSummary[]> {
  const savedRef = collection(db, 'saved_summaries')
  let q;
  if (folderId === 'all') {
    q = query(savedRef, where('userId', '==', userId))
  } else {
    q = query(savedRef, where('userId', '==', userId), where('folderId', '==', folderId))
  }
  const snapshot = await getDocs(q)
  const summaries = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as SavedSummary)
  // 복합 인덱스 없이 클라이언트에서 정렬
  return summaries.sort((a, b) => {
    const aTime = a.createdAt?.toMillis?.() ?? a.createdAt?.getTime?.() ?? 0
    const bTime = b.createdAt?.toMillis?.() ?? b.createdAt?.getTime?.() ?? 0
    return bTime - aTime
  })
}
