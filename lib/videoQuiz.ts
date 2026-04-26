import { db, storage } from './firebase'
import {
  collection, doc, addDoc, getDocs, deleteDoc,
  query, where, serverTimestamp,
} from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { secsToLabel } from './videoBookmark'

export type VideoQuizType = 'ox' | 'multiple_choice' | 'short_answer'

export interface VideoQuiz {
  id: string
  userId: string
  videoId: string
  sessionId: string
  videoTitle: string
  thumbnail: string
  channel: string
  timestampSec: number
  timestampLabel: string
  quizType: VideoQuizType
  question: string
  imageUrl?: string
  // OX
  oxAnswer?: 'O' | 'X'
  oxExplanation?: string
  // multiple_choice
  options?: string[]
  correctOptionIndex?: number
  // short_answer
  sampleAnswer?: string
  createdAt: any
}

export { secsToLabel }

export async function getVideoQuizzesBySession(userId: string, sessionId: string): Promise<VideoQuiz[]> {
  const q = query(
    collection(db, 'video_quizzes'),
    where('userId', '==', userId),
    where('sessionId', '==', sessionId),
  )
  const snap = await getDocs(q)
  const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as VideoQuiz))
  return list.sort((a, b) => a.timestampSec - b.timestampSec)
}

export async function getAllVideoQuizzes(userId: string): Promise<VideoQuiz[]> {
  const q = query(
    collection(db, 'video_quizzes'),
    where('userId', '==', userId),
  )
  const snap = await getDocs(q)
  const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as VideoQuiz))
  return list.sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0))
}

export async function addVideoQuiz(
  userId: string,
  data: Omit<VideoQuiz, 'id' | 'userId' | 'createdAt'>,
): Promise<string> {
  // Firestore는 undefined 값을 거부 → 저장 전 제거
  const payload: Record<string, any> = { userId, createdAt: serverTimestamp() }
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined) payload[k] = v
  }
  const docRef = await addDoc(collection(db, 'video_quizzes'), payload)
  return docRef.id
}

export async function deleteVideoQuiz(id: string): Promise<void> {
  await deleteDoc(doc(db, 'video_quizzes', id))
}

export async function uploadQuizImage(userId: string, file: File): Promise<string> {
  const storageRef = ref(storage, `quiz_images/${userId}/${Date.now()}_${file.name}`)
  await uploadBytes(storageRef, file)
  return getDownloadURL(storageRef)
}
