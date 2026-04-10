import { db } from './firebase'
import { collection, doc, setDoc, getDocs, getDoc, query, where, addDoc, deleteDoc, updateDoc, increment, serverTimestamp } from 'firebase/firestore'
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
  userDisplayName?: string
  userPhotoURL?: string
  folderId: string
  sessionId: string
  videoId: string
  title: string
  channel?: string
  thumbnail: string
  category: string
  summary?: any       // AI 요약 내용 (결과 페이지 복원에 필요)
  square_meta?: any
  isPublic: boolean
  createdAt: any
  transcript?: string
  transcriptSource?: string
  likeCount?: number
  viewCount?: number
}

export interface UserProfile {
  uid: string
  displayName: string
  photoURL: string
  updatedAt: any
}

export interface Message {
  id: string
  senderId: string
  text: string
  createdAt: any
  read: boolean
}

export interface Conversation {
  id: string
  participants: string[]
  participantProfiles: Record<string, { displayName: string; photoURL: string }>
  lastMessage: string
  lastAt: any
  unread: Record<string, number>
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
  userDisplayName,
  userPhotoURL,
  folderId,
  sessionId,
  videoId,
  title,
  channel,
  thumbnail,
  category,
  summary,
  square_meta,
  isPublic = false,
  transcript,
  transcriptSource,
}: Partial<SavedSummary>): Promise<string> {
  const savedRef = collection(db, 'saved_summaries')
  const docRef = await addDoc(savedRef, {
    userId,
    userDisplayName: userDisplayName || '',
    userPhotoURL: userPhotoURL || '',
    folderId,
    sessionId,
    videoId,
    title,
    channel: channel || '',
    thumbnail,
    category,
    summary: summary ?? null,
    square_meta: square_meta ?? null,
    isPublic,
    transcript: transcript || '',
    transcriptSource: transcriptSource || '',
    likeCount: 0,
    viewCount: 0,
    createdAt: serverTimestamp()
  })
  return docRef.id
}

// ─────────────────────────────────────────────
// 유저 프로필
// ─────────────────────────────────────────────
export async function upsertUserProfile(profile: Omit<UserProfile, 'updatedAt'>): Promise<void> {
  await setDoc(doc(db, 'users', profile.uid), {
    ...profile,
    updatedAt: serverTimestamp()
  }, { merge: true })
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, 'users', uid))
  return snap.exists() ? (snap.data() as UserProfile) : null
}

export async function getUserPublicSummaries(userId: string): Promise<SavedSummary[]> {
  const q = query(
    collection(db, 'saved_summaries'),
    where('userId', '==', userId),
    where('isPublic', '==', true)
  )
  const snap = await getDocs(q)
  const items = snap.docs.map(d => ({ id: d.id, ...d.data() }) as SavedSummary)
  return items.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0))
}

// ─────────────────────────────────────────────
// 쪽지 (Conversations & Messages)
// ─────────────────────────────────────────────
function conversationId(uid1: string, uid2: string): string {
  return [uid1, uid2].sort().join('_')
}

export async function getOrCreateConversation(
  myUid: string,
  myProfile: { displayName: string; photoURL: string },
  otherUid: string,
  otherProfile: { displayName: string; photoURL: string }
): Promise<string> {
  const cid = conversationId(myUid, otherUid)
  const ref = doc(db, 'conversations', cid)
  const snap = await getDoc(ref)
  if (!snap.exists()) {
    await setDoc(ref, {
      participants: [myUid, otherUid],
      participantProfiles: {
        [myUid]: myProfile,
        [otherUid]: otherProfile,
      },
      lastMessage: '',
      lastAt: serverTimestamp(),
      unread: { [myUid]: 0, [otherUid]: 0 },
    })
  }
  return cid
}

export async function sendMessage(cid: string, senderId: string, text: string, receiverId: string): Promise<void> {
  const messagesRef = collection(db, 'conversations', cid, 'messages')
  await addDoc(messagesRef, { senderId, text, createdAt: serverTimestamp(), read: false })
  await updateDoc(doc(db, 'conversations', cid), {
    lastMessage: text.slice(0, 80),
    lastAt: serverTimestamp(),
    [`unread.${receiverId}`]: increment(1),
  })
}

export async function getConversations(uid: string): Promise<Conversation[]> {
  const q = query(collection(db, 'conversations'), where('participants', 'array-contains', uid))
  const snap = await getDocs(q)
  const items = snap.docs.map(d => ({ id: d.id, ...d.data() }) as Conversation)
  return items.sort((a, b) => (b.lastAt?.toMillis?.() ?? 0) - (a.lastAt?.toMillis?.() ?? 0))
}

export async function getMessages(cid: string): Promise<Message[]> {
  const q = query(collection(db, 'conversations', cid, 'messages'))
  const snap = await getDocs(q)
  const items = snap.docs.map(d => ({ id: d.id, ...d.data() }) as Message)
  return items.sort((a, b) => (a.createdAt?.toMillis?.() ?? 0) - (b.createdAt?.toMillis?.() ?? 0))
}

export async function markConversationRead(cid: string, uid: string): Promise<void> {
  await updateDoc(doc(db, 'conversations', cid), { [`unread.${uid}`]: 0 })
}

export async function getTotalUnread(uid: string): Promise<number> {
  const convos = await getConversations(uid)
  return convos.reduce((sum, c) => sum + (c.unread?.[uid] ?? 0), 0)
}

export async function deleteSavedSummary(id: string): Promise<void> {
  await deleteDoc(doc(db, 'saved_summaries', id))
}

export async function updateSummaryVisibility(id: string, isPublic: boolean): Promise<void> {
  await updateDoc(doc(db, 'saved_summaries', id), { isPublic })
}

export async function getSavedSummaryBySessionId(userId: string, sessionId: string): Promise<SavedSummary | null> {
  const q = query(
    collection(db, 'saved_summaries'),
    where('userId', '==', userId),
    where('sessionId', '==', sessionId)
  )
  const snap = await getDocs(q)
  if (snap.empty) return null
  return { id: snap.docs[0].id, ...snap.docs[0].data() } as SavedSummary
}

export async function toggleLike(userId: string, savedSummaryId: string): Promise<boolean> {
  const likeId = `${userId}_${savedSummaryId}`
  const likeRef = doc(db, 'likes', likeId)
  const savedRef = doc(db, 'saved_summaries', savedSummaryId)

  const likeSnap = await getDoc(likeRef)
  if (likeSnap.exists()) {
    await deleteDoc(likeRef)
    await updateDoc(savedRef, { likeCount: increment(-1) })
    return false
  } else {
    await setDoc(likeRef, { userId, savedSummaryId, createdAt: serverTimestamp() })
    await updateDoc(savedRef, { likeCount: increment(1) })
    return true
  }
}

export async function getUserLikedIds(userId: string): Promise<Set<string>> {
  const q = query(collection(db, 'likes'), where('userId', '==', userId))
  const snapshot = await getDocs(q)
  return new Set(snapshot.docs.map(d => d.data().savedSummaryId as string))
}

export async function incrementViewCount(savedSummaryId: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'saved_summaries', savedSummaryId), { viewCount: increment(1) })
  } catch {
    // 뷰카운트 실패는 무시
  }
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
