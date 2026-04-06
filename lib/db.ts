import { db } from './firebase'
import { collection, doc, setDoc, getDocs, getDoc, query, where, orderBy, addDoc, serverTimestamp } from 'firebase/firestore'
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
  const q = query(foldersRef, where('userId', '==', userId), orderBy('createdAt', 'desc'))
  const snapshot = await getDocs(q)
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Folder)
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

export async function getPublicSummaries(): Promise<SavedSummary[]> {
  const savedRef = collection(db, 'saved_summaries')
  const q = query(savedRef, where('isPublic', '==', true), orderBy('createdAt', 'desc'))
  const snapshot = await getDocs(q)
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as SavedSummary)
}

export async function getSavedSummariesByFolder(userId: string, folderId: string): Promise<SavedSummary[]> {
  const savedRef = collection(db, 'saved_summaries')
  let q;
  if (folderId === 'all') {
    q = query(savedRef, where('userId', '==', userId), orderBy('createdAt', 'desc'))
  } else {
    q = query(savedRef, where('userId', '==', userId), where('folderId', '==', folderId), orderBy('createdAt', 'desc'))
  }
  const snapshot = await getDocs(q)
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as SavedSummary)
}
