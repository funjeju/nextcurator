import { db } from './firebase'
import {
  collection, doc, addDoc, getDocs, deleteDoc,
  query, where, orderBy, serverTimestamp,
} from 'firebase/firestore'

export interface BlogSection {
  id: string
  heading: string | null
  level: number
  text: string
  timestamp: string | null
  seconds: number | null
}

export interface SavedBlogDraft {
  id: string
  userId: string
  videoId: string
  sessionId: string
  title: string
  channel: string
  thumbnail: string
  seo_title: string
  meta_description: string
  slug: string
  tags: string[]
  reading_time: number
  sections: BlogSection[]
  createdAt: any
}

export async function getSavedBlogDrafts(userId: string): Promise<SavedBlogDraft[]> {
  const q = query(
    collection(db, 'blog_drafts'),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc'),
  )
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as SavedBlogDraft))
}

export async function saveBlogDraft(
  userId: string,
  draft: Omit<SavedBlogDraft, 'id' | 'userId' | 'createdAt'>,
): Promise<string> {
  const ref = await addDoc(collection(db, 'blog_drafts'), {
    ...draft,
    userId,
    createdAt: serverTimestamp(),
  })
  return ref.id
}

export async function deleteBlogDraft(draftId: string): Promise<void> {
  await deleteDoc(doc(db, 'blog_drafts', draftId))
}
