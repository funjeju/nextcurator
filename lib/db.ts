import { db } from './firebase'
import { collection, doc, setDoc, getDocs, getDoc, query, where, addDoc, deleteDoc, updateDoc, increment, serverTimestamp, writeBatch } from 'firebase/firestore'
import { SummaryData } from '@/types/summary'
import { getLocalUserId } from './user';

export interface Folder {
  id: string
  userId: string
  name: string
  visibility?: 'private' | 'friends' | 'public'
  clonedFrom?: {
    userId: string
    displayName: string
    originalFolderId: string
  }
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
  summary?: any          // AI 요약 내용 (결과 페이지 복원에 필요)
  contextSummary?: string // 맥락 요약 200~300자 (검색·임베딩용)
  square_meta?: any
  isPublic: boolean
  createdAt: any
  transcript?: string
  transcriptSource?: string
  likeCount?: number
  viewCount?: number
  sortOrder?: number
  embedding?: number[]       // text-embedding-004 벡터 (768차원) — AI 유사도 검색용
}

export type AgeGroup = '10s' | '20s' | '30s' | '40s' | '50s' | '60s+'
export type Gender = 'male' | 'female' | 'other' | 'prefer_not'

export interface UserProfile {
  uid: string
  displayName: string
  photoURL: string
  avatarEmoji?: string       // 이메일 가입자 전용 이모지 아바타
  email?: string
  // 추가 프로필 정보 (온보딩에서 수집)
  ageGroup?: AgeGroup
  gender?: Gender
  interests?: string[]          // 관심 카테고리 (recipe, english, ...)
  profileCompleted?: boolean    // 온보딩 완료 여부
  profileCompletedAt?: any      // 완료 시각
  // 토큰/플랜 시스템
  tokens?: number               // 보유 토큰 잔액
  tokensEarnedTotal?: number    // 누적 획득 토큰 (통계용)
  plan?: 'free' | 'starter' | 'pro'
  planExpiresAt?: any           // 기간제 플랜 만료일
  role?: 'admin' | 'user' | 'teacher' | 'student'  // 역할
  // 클래스룸 전용 필드
  classCode?: string             // 교사/학생 공통 (소속 클래스)
  studentName?: string           // 학생 전용 (표시 이름)
  schoolName?: string            // 교사 전용
  grade?: number                 // 교사 전용
  classNum?: number              // 교사 전용
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
    visibility: 'private', // 기본값은 비공개
    createdAt: serverTimestamp()
  })
  return { id: docRef.id, userId, name, createdAt: new Date() }
}

export async function renameFolder(folderId: string, newName: string): Promise<void> {
  await updateDoc(doc(db, 'folders', folderId), { name: newName })
}

export async function updateFolderVisibility(folderId: string, visibility: 'private' | 'friends' | 'public'): Promise<void> {
  await updateDoc(doc(db, 'folders', folderId), { visibility })
}

export async function deleteFolder(folderId: string): Promise<void> {
  await deleteDoc(doc(db, 'folders', folderId))
  // 폴더 안 항목들은 folderId를 빈 문자열로 초기화 (모든 저장 항목에서는 계속 보임)
  // 별도 처리 없이 orphaned 상태로 두면 'all' 쿼리에서는 보임
}

// Firestore는 undefined 값을 거부 → 재귀적으로 null로 치환
function stripUndefined(obj: any): any {
  if (obj === undefined) return null
  if (obj === null || typeof obj !== 'object') return obj
  if (Array.isArray(obj)) return obj.map(stripUndefined)
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k, stripUndefined(v)])
  )
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
    summary: stripUndefined(summary),
    square_meta: stripUndefined(square_meta),
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
  // 1. UID로 직접 조회 시도
  const docRef = doc(db, 'users', uid)
  const snap = await getDoc(docRef)
  if (snap.exists()) return { uid: snap.id, ...snap.data() } as UserProfile

  // 2. 만약 uid가 이메일 형식이라면 이메일로 검색 시도 (ID 체계 유연화)
  if (uid.includes('@')) {
    const q = query(collection(db, 'users'), where('email', '==', uid))
    const s = await getDocs(q)
    if (!s.empty) return { uid: s.docs[0].id, ...s.docs[0].data() } as UserProfile
  }

  return null
}

// 온보딩 완료 — 추가 정보 저장 + 신규 가입 보너스 토큰 지급
export const PROFILE_COMPLETE_TOKENS = 50  // 프로필 완성 보상
export const SIGNUP_BASE_TOKENS     = 10   // 기본 지급 (신규 가입)

export async function completeUserProfile(
  uid: string,
  data: { ageGroup: AgeGroup; gender: Gender; interests: string[] }
): Promise<{ tokensAwarded: number }> {
  const existing = await getUserProfile(uid)

  // 이미 완료한 유저는 토큰 중복 지급 방지
  if (existing?.profileCompleted) return { tokensAwarded: 0 }

  const baseTokens = existing?.tokens ?? SIGNUP_BASE_TOKENS
  const newTokens  = baseTokens + PROFILE_COMPLETE_TOKENS

  await setDoc(doc(db, 'users', uid), {
    ...data,
    profileCompleted: true,
    profileCompletedAt: serverTimestamp(),
    tokens: newTokens,
    tokensEarnedTotal: (existing?.tokensEarnedTotal ?? SIGNUP_BASE_TOKENS) + PROFILE_COMPLETE_TOKENS,
    plan: existing?.plan ?? 'free',
    updatedAt: serverTimestamp(),
  }, { merge: true })

  return { tokensAwarded: PROFILE_COMPLETE_TOKENS }
}

// 신규 유저 초기 토큰 지급 (첫 로그인 시)
export async function initNewUserTokens(uid: string, displayName: string, photoURL: string, email: string): Promise<void> {
  const existing = await getUserProfile(uid)
  if (existing) return  // 이미 존재하면 스킵

  await setDoc(doc(db, 'users', uid), {
    uid,
    displayName,
    photoURL,
    email,
    tokens: SIGNUP_BASE_TOKENS,
    tokensEarnedTotal: SIGNUP_BASE_TOKENS,
    plan: 'free',
    profileCompleted: false,
    updatedAt: serverTimestamp(),
  })
}

// 이메일 회원가입 직후 호출 — 이미 exists 체크 없이 avatarEmoji 포함 초기 문서 생성
export async function setInitialUserDoc(uid: string, displayName: string, email: string, avatarEmoji: string): Promise<void> {
  await setDoc(doc(db, 'users', uid), {
    uid,
    displayName,
    photoURL: '',
    avatarEmoji,
    email,
    tokens: SIGNUP_BASE_TOKENS,
    tokensEarnedTotal: SIGNUP_BASE_TOKENS,
    plan: 'free',
    profileCompleted: false,
    updatedAt: serverTimestamp(),
  })
}

// 아바타 이모지 변경 (문서 없으면 생성)
export async function updateUserAvatar(uid: string, avatarEmoji: string): Promise<void> {
  await setDoc(doc(db, 'users', uid), { avatarEmoji, updatedAt: serverTimestamp() }, { merge: true })
}

// 프로필 사진 URL 변경
export async function updateUserPhotoURL(uid: string, photoURL: string): Promise<void> {
  await setDoc(doc(db, 'users', uid), { photoURL, updatedAt: serverTimestamp() }, { merge: true })
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

export async function updateSummaryFolder(id: string, folderId: string): Promise<void> {
  await updateDoc(doc(db, 'saved_summaries', id), { folderId })
}

export async function batchUpdateSortOrder(updates: { id: string; sortOrder: number }[]): Promise<void> {
  const batch = writeBatch(db)
  for (const { id, sortOrder } of updates) {
    batch.update(doc(db, 'saved_summaries', id), { sortOrder })
  }
  await batch.commit()
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

export async function getSavedSummaryByVideoId(userId: string, videoId: string): Promise<SavedSummary | null> {
  const q = query(
    collection(db, 'saved_summaries'),
    where('userId', '==', userId),
    where('videoId', '==', videoId)
  )
  const snap = await getDocs(q)
  if (snap.empty) return null
  return { id: snap.docs[0].id, ...snap.docs[0].data() } as SavedSummary
}

export async function updateSavedSummary(id: string, data: Partial<SavedSummary>): Promise<void> {
  const { id: _id, ...rest } = data as any
  await updateDoc(doc(db, 'saved_summaries', id), {
    ...rest,
    updatedAt: serverTimestamp(),
  })
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

  // 최신순 정렬 후 videoId 기준 dedup (같은 영상 여러 번 분석 시 가장 최근 것만 표시)
  summaries.sort((a, b) => {
    const aTime = a.createdAt?.toMillis?.() ?? a.createdAt?.getTime?.() ?? 0
    const bTime = b.createdAt?.toMillis?.() ?? b.createdAt?.getTime?.() ?? 0
    return bTime - aTime
  })
  const seen = new Set<string>()
  return summaries.filter(s => {
    const key = s.videoId || s.sessionId
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// 친구가 저장한 전체 요약 (공개 + 비공개)
export async function getAllSavedSummariesByUser(userId: string): Promise<SavedSummary[]> {
  const q = query(collection(db, 'saved_summaries'), where('userId', '==', userId))
  const snap = await getDocs(q)
  const summaries = snap.docs.map(d => ({ id: d.id, ...d.data() }) as SavedSummary)
  return summaries.sort((a, b) => {
    const aT = a.createdAt?.toMillis?.() ?? 0
    const bT = b.createdAt?.toMillis?.() ?? 0
    return bT - aT
  })
}

// ─────────────────────────────────────────────
// 친구 요청 / 친구 관계
// ─────────────────────────────────────────────

export interface FriendRequest {
  id: string
  fromUid: string
  fromDisplayName: string
  fromPhotoURL: string
  toUid: string
  status: 'pending' | 'accepted' | 'rejected'
  createdAt: any
}

function friendshipId(uid1: string, uid2: string): string {
  return [uid1, uid2].sort().join('_')
}

export async function sendFriendRequest(
  fromUid: string,
  fromDisplayName: string,
  fromPhotoURL: string,
  toUid: string
): Promise<void> {
  const fid = friendshipId(fromUid, toUid)
  // 이미 친구거나 요청 중이면 무시
  const existing = await getDoc(doc(db, 'friendships', fid))
  if (existing.exists()) return

  const reqRef = doc(db, 'friend_requests', `${fromUid}_${toUid}`)
  await setDoc(reqRef, {
    fromUid,
    fromDisplayName,
    fromPhotoURL,
    toUid,
    status: 'pending',
    createdAt: serverTimestamp(),
  })
}

export async function getFriendStatus(
  myUid: string,
  otherUid: string
): Promise<'none' | 'pending_sent' | 'pending_received' | 'friends'> {
  const fid = friendshipId(myUid, otherUid)
  const friendSnap = await getDoc(doc(db, 'friendships', fid))
  if (friendSnap.exists()) return 'friends'

  const sentSnap = await getDoc(doc(db, 'friend_requests', `${myUid}_${otherUid}`))
  if (sentSnap.exists() && sentSnap.data().status === 'pending') return 'pending_sent'

  const receivedSnap = await getDoc(doc(db, 'friend_requests', `${otherUid}_${myUid}`))
  if (receivedSnap.exists() && receivedSnap.data().status === 'pending') return 'pending_received'

  return 'none'
}

export async function acceptFriendRequest(fromUid: string, myUid: string): Promise<void> {
  const reqRef = doc(db, 'friend_requests', `${fromUid}_${myUid}`)
  const fid = friendshipId(fromUid, myUid)
  await Promise.all([
    updateDoc(reqRef, { status: 'accepted' }),
    setDoc(doc(db, 'friendships', fid), {
      uids: [fromUid, myUid],
      createdAt: serverTimestamp(),
    }),
  ])
}

export async function rejectFriendRequest(fromUid: string, myUid: string): Promise<void> {
  await updateDoc(doc(db, 'friend_requests', `${fromUid}_${myUid}`), { status: 'rejected' })
}

export async function cancelFriendRequest(myUid: string, toUid: string): Promise<void> {
  await deleteDoc(doc(db, 'friend_requests', `${myUid}_${toUid}`))
}

export async function removeFriend(myUid: string, otherUid: string): Promise<void> {
  const fid = friendshipId(myUid, otherUid)
  await deleteDoc(doc(db, 'friendships', fid))
}

export async function getPendingFriendRequests(myUid: string): Promise<FriendRequest[]> {
  const q = query(
    collection(db, 'friend_requests'),
    where('toUid', '==', myUid),
    where('status', '==', 'pending')
  )
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }) as FriendRequest)
    .sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0))
}

export async function getFriends(myUid: string): Promise<{ uid: string; displayName: string; photoURL: string }[]> {
  const q = query(collection(db, 'friendships'), where('uids', 'array-contains', myUid))
  const snap = await getDocs(q)
  const otherUids = snap.docs.map(d => {
    const uids = d.data().uids as string[]
    return uids.find(u => u !== myUid) ?? ''
  }).filter(Boolean)

  const profiles = await Promise.all(otherUids.map(uid => getUserProfile(uid)))
  return profiles
    .filter(Boolean)
    .map(p => ({ uid: p!.uid, displayName: p!.displayName, photoURL: p!.photoURL }))
}

/**
 * 특정 사용자의 공개 가능한 폴더 목록을 가져옵니다.
 * - Firestore 보안 규칙 위반을 피하기 위해 쿼리 레벨에서 필터링합니다.
 */
export async function getVisibleFolders(targetUserId: string, isOwner: boolean = false, isFriend: boolean = false) {
  const foldersRef = collection(db, 'folders')

  // 본인: 전체 조회
  if (isOwner) {
    const q = query(foldersRef, where('userId', '==', targetUserId))
    const snap = await getDocs(q)
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Folder))
  }

  // 타인: userId + visibility 복합 쿼리 (보안 규칙 준수 + Permission Denied 방지)
  // ※ Firestore 복합 인덱스 필요: folders (userId ASC, visibility ASC)
  const [snapPublic, snapFriends] = await Promise.all([
    getDocs(query(foldersRef, where('userId', '==', targetUserId), where('visibility', '==', 'public'))),
    isFriend
      ? getDocs(query(foldersRef, where('userId', '==', targetUserId), where('visibility', '==', 'friends')))
      : Promise.resolve(null),
  ])

  const folders: Folder[] = snapPublic.docs.map(d => ({ id: d.id, ...d.data() } as Folder))
  if (snapFriends) {
    snapFriends.docs.forEach(d => folders.push({ id: d.id, ...d.data() } as Folder))
  }
  return folders
}

/** 폴더 통째로 복제하기 */
export async function cloneFolder(
  originalFolderId: string,
  originalOwnerName: string,
  originalOwnerId: string,
  newName: string,
  myUid: string,
  myProfile: { displayName: string, photoURL: string }
): Promise<string> {
  // 1. 새 폴더 생성
  const folderRef = await addDoc(collection(db, 'folders'), {
    userId: myUid,
    name: newName,
    visibility: 'private',
    clonedFrom: {
      userId: originalOwnerId,
      displayName: originalOwnerName,
      originalFolderId: originalFolderId
    },
    createdAt: serverTimestamp()
  })

  // 2. 영상 목록 가져오기
  const summaries = await getSavedSummariesByFolder(originalOwnerId, originalFolderId)

  // 3. 일괄 복사
  const batch = writeBatch(db)
  for (const item of summaries) {
    const newRef = doc(collection(db, 'saved_summaries'))
    batch.set(newRef, {
      ...item,
      id: newRef.id, // 새 ID 생성
      userId: myUid,
      userDisplayName: myProfile.displayName,
      userPhotoURL: myProfile.photoURL,
      folderId: folderRef.id,
      isPublic: false, // 복제본은 기본적으로 비공개
      createdAt: serverTimestamp(),
      likeCount: 0,
      viewCount: 0
    })
  }
  await batch.commit()

  return folderRef.id
}

// ─────────────────────────────────────────────
// 폴더 공유
// ─────────────────────────────────────────────

export interface SharedFolder {
  id: string
  ownerId: string
  ownerName: string
  ownerPhotoURL: string
  folderName: string
  // 영상 메타만 저장 (복사 시 필요한 최소 정보)
  items: Array<{
    sessionId: string
    videoId: string
    title: string
    thumbnail: string
    channel: string
    category: string
    contextSummary?: string
    square_meta?: any
  }>
  createdAt: any
}

/** 공유 폴더 생성 → shareId 반환 */
export async function createSharedFolder(
  ownerId: string,
  ownerName: string,
  ownerPhotoURL: string,
  folderName: string,
  summaries: SavedSummary[]
): Promise<string> {
  const items = summaries.map(s => ({
    sessionId: s.sessionId,
    videoId: s.videoId || '',
    title: s.title,
    thumbnail: s.thumbnail || '',
    channel: s.channel || '',
    category: s.category,
    contextSummary: s.contextSummary || '',
    square_meta: stripUndefined(s.square_meta) ?? null,
  }))
  const ref = await addDoc(collection(db, 'shared_folders'), {
    ownerId,
    ownerName,
    ownerPhotoURL,
    folderName,
    items,
    createdAt: serverTimestamp(),
  })
  return ref.id
}

/** 공유 폴더 조회 */
export async function getSharedFolder(shareId: string): Promise<SharedFolder | null> {
  const snap = await getDoc(doc(db, 'shared_folders', shareId))
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() } as SharedFolder
}

/** 공유 폴더 → 내 라이브러리에 복사 */
export async function copySharedFolder(
  shareId: string,
  recipientId: string,
  recipientDisplayName: string,
  recipientPhotoURL: string
): Promise<{ folderId: string; count: number }> {
  const shared = await getSharedFolder(shareId)
  if (!shared) throw new Error('공유 폴더를 찾을 수 없습니다.')

  // 새 폴더 생성
  const folderRef = await addDoc(collection(db, 'folders'), {
    userId: recipientId,
    name: `${shared.folderName} (${shared.ownerName}님 공유)`,
    createdAt: serverTimestamp(),
  })

  // 영상 일괄 복사
  const batch = writeBatch(db)
  for (const item of shared.items) {
    const newRef = doc(collection(db, 'saved_summaries'))
    batch.set(newRef, {
      userId: recipientId,
      userDisplayName: recipientDisplayName,
      userPhotoURL: recipientPhotoURL,
      folderId: folderRef.id,
      sessionId: item.sessionId,
      videoId: item.videoId,
      title: item.title,
      thumbnail: item.thumbnail,
      channel: item.channel,
      category: item.category,
      contextSummary: item.contextSummary || '',
      square_meta: item.square_meta ?? null,
      summary: null,
      isPublic: false,
      likeCount: 0,
      viewCount: 0,
      createdAt: serverTimestamp(),
    })
  }
  await batch.commit()

  return { folderId: folderRef.id, count: shared.items.length }
}

export async function getSavedSummariesByFolder(userId: string, folderId: string): Promise<SavedSummary[]> {
  const savedRef = collection(db, 'saved_summaries')
  
  // 1. 본인 여부 확인 (Permission Denied 방지용)
  const isMe = getLocalUserId() === userId
  
  let q;
  if (isMe) {
    // 본인이면 인덱스 없이 안전하게 전체 또는 폴더별 조회
    if (folderId === 'all') {
      q = query(savedRef, where('userId', '==', userId))
    } else {
      q = query(savedRef, where('userId', '==', userId), where('folderId', '==', folderId))
    }
    const snap = await getDocs(q)
    const items = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as SavedSummary))
    // 특정 폴더: sortOrder 우선, 없으면 최신순 / 전체: 무조건 최신순
    if (folderId === 'all') {
      const sorted = items.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0))
      // 같은 영상을 다른 카테고리로 분석한 경우 가장 최근 것만 표시
      const seen = new Set<string>()
      return sorted.filter(s => {
        const key = s.videoId || s.sessionId
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
    }
    return items.sort((a, b) => {
      const aHasOrder = typeof a.sortOrder === 'number'
      const bHasOrder = typeof b.sortOrder === 'number'
      if (aHasOrder && bHasOrder) return (a.sortOrder as number) - (b.sortOrder as number)
      if (aHasOrder) return -1
      if (bHasOrder) return 1
      return (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0)
    })
  } else {
    // 타인은 반드시 isPublic == true 가 쿼리에 포함되어야 함
    const qPublic = query(savedRef, where('isPublic', '==', true))
    const snap = await getDocs(qPublic)
    const publicItems = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as SavedSummary))
    
    return publicItems.filter(item => {
      if (item.userId !== userId) return false
      if (folderId !== 'all' && item.folderId !== folderId) return false
      return true
    })
  }
}

// ─────────────────────────────────────────────
// Real-time Subscriptions (onSnapshot)
// ─────────────────────────────────────────────
import { onSnapshot } from 'firebase/firestore'

export function subscribeFolders(userId: string, callback: (folders: Folder[]) => void) {
  const q = query(collection(db, 'folders'), where('userId', '==', userId))
  return onSnapshot(q, (snap) => {
    const folders = snap.docs.map(d => ({ id: d.id, ...d.data() }) as Folder)
    callback(folders.sort((a, b) => (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0)))
  })
}

export function subscribeMessages(cid: string, callback: (messages: Message[]) => void) {
  const q = query(collection(db, 'conversations', cid, 'messages'))
  return onSnapshot(q, (snap) => {
    const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() }) as Message)
    callback(msgs.sort((a, b) => (a.createdAt?.toMillis?.() ?? 0) - (b.createdAt?.toMillis?.() ?? 0)))
  })
}

export function subscribeConversations(uid: string, callback: (conversations: Conversation[]) => void) {
  const q = query(collection(db, 'conversations'), where('participants', 'array-contains', uid))
  return onSnapshot(q, (snap) => {
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }) as Conversation)
    callback(items.sort((a, b) => (b.lastAt?.toMillis?.() ?? 0) - (a.lastAt?.toMillis?.() ?? 0)))
  })
}
