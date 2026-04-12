import { db, storage } from './firebase'
import {
  collection, doc, setDoc, updateDoc, getDoc, onSnapshot,
  addDoc, query, orderBy, limit, serverTimestamp, deleteDoc,
  Timestamp, increment,
} from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'

// ── 타입 ───────────────────────────────────────────────

export interface WatchRoom {
  id: string
  sessionId: string
  videoId: string
  title: string
  thumbnail: string
  hostUid: string
  hostName: string
  hostPhotoURL: string
  password: string          // '' = 비밀번호 없음
  createdAt: Timestamp
  playerState: {
    playing: boolean
    currentTime: number
    rate: number
    syncedAt: number        // Date.now() — 참여자 보정용
  }
  participants: Record<string, RoomParticipant>  // uid → 참여자
}

export interface RoomParticipant {
  uid: string
  displayName: string
  photoURL: string
  joinedAt: number
  handRaised: boolean
}

export interface RoomMessage {
  id: string
  type: 'chat' | 'system' | 'emoji' | 'note' | 'file'
  uid: string
  displayName: string
  photoURL: string
  content: string           // 채팅/시스템 텍스트, 이모지 문자, 파일명
  videoTs?: string          // 메모: "05:23"
  videoSec?: number         // 메모: 초 단위
  fileUrl?: string          // 파일 공유: Storage URL
  fileType?: string         // MIME type
  fileSize?: number         // bytes
  createdAt: Timestamp
}

// ── 방 생성/조회 ───────────────────────────────────────

export async function createRoom(params: {
  sessionId: string
  videoId: string
  title: string
  thumbnail: string
  hostUid: string
  hostName: string
  hostPhotoURL: string
  password: string
}): Promise<string> {
  const roomId = crypto.randomUUID().slice(0, 8).toUpperCase()
  const roomRef = doc(db, 'watch_rooms', roomId)
  const hostParticipant: RoomParticipant = {
    uid: params.hostUid,
    displayName: params.hostName,
    photoURL: params.hostPhotoURL,
    joinedAt: Date.now(),
    handRaised: false,
  }
  await setDoc(roomRef, {
    sessionId: params.sessionId,
    videoId: params.videoId,
    title: params.title,
    thumbnail: params.thumbnail,
    hostUid: params.hostUid,
    hostName: params.hostName,
    hostPhotoURL: params.hostPhotoURL,
    password: params.password,
    createdAt: serverTimestamp(),
    playerState: {
      playing: false,
      currentTime: 0,
      rate: 1,
      syncedAt: Date.now(),
    },
    participants: { [params.hostUid]: hostParticipant },
  })
  // 시스템 메시지
  await addDoc(collection(db, 'watch_rooms', roomId, 'messages'), {
    type: 'system',
    uid: '',
    displayName: '',
    photoURL: '',
    content: `${params.hostName}님이 방을 개설했습니다.`,
    createdAt: serverTimestamp(),
  })
  return roomId
}

export async function getRoom(roomId: string): Promise<WatchRoom | null> {
  const snap = await getDoc(doc(db, 'watch_rooms', roomId))
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() } as WatchRoom
}

// ── 참여/퇴장 ──────────────────────────────────────────

export async function joinRoom(
  roomId: string,
  participant: Omit<RoomParticipant, 'joinedAt' | 'handRaised'>
): Promise<void> {
  const p: RoomParticipant = { ...participant, joinedAt: Date.now(), handRaised: false }
  await updateDoc(doc(db, 'watch_rooms', roomId), {
    [`participants.${participant.uid}`]: p,
  })
  await addDoc(collection(db, 'watch_rooms', roomId, 'messages'), {
    type: 'system', uid: '', displayName: '', photoURL: '',
    content: `${participant.displayName}님이 입장했습니다.`,
    createdAt: serverTimestamp(),
  })
}

export async function leaveRoom(roomId: string, uid: string, displayName: string): Promise<void> {
  const { deleteField } = await import('firebase/firestore')
  await updateDoc(doc(db, 'watch_rooms', roomId), {
    [`participants.${uid}`]: deleteField(),
  })
  await addDoc(collection(db, 'watch_rooms', roomId, 'messages'), {
    type: 'system', uid: '', displayName: '', photoURL: '',
    content: `${displayName}님이 퇴장했습니다.`,
    createdAt: serverTimestamp(),
  })
}

export async function closeRoom(roomId: string): Promise<void> {
  await updateDoc(doc(db, 'watch_rooms', roomId), {
    closed: true,
  })
  await addDoc(collection(db, 'watch_rooms', roomId, 'messages'), {
    type: 'system', uid: '', displayName: '', photoURL: '',
    content: '방장이 방을 종료했습니다.',
    createdAt: serverTimestamp(),
  })
}

// ── 플레이어 동기화 (방장 전용) ────────────────────────

export async function syncPlayerState(
  roomId: string,
  state: { playing: boolean; currentTime: number; rate: number }
): Promise<void> {
  await updateDoc(doc(db, 'watch_rooms', roomId), {
    playerState: { ...state, syncedAt: Date.now() },
  })
}

// ── 손들기 ─────────────────────────────────────────────

export async function setHandRaised(roomId: string, uid: string, raised: boolean): Promise<void> {
  await updateDoc(doc(db, 'watch_rooms', roomId), {
    [`participants.${uid}.handRaised`]: raised,
  })
}

// ── 메시지 ─────────────────────────────────────────────

export async function sendMessage(
  roomId: string,
  msg: Omit<RoomMessage, 'id' | 'createdAt'>
): Promise<void> {
  await addDoc(collection(db, 'watch_rooms', roomId, 'messages'), {
    ...msg,
    createdAt: serverTimestamp(),
  })
}

export function subscribeMessages(
  roomId: string,
  callback: (msgs: RoomMessage[]) => void
) {
  const q = query(
    collection(db, 'watch_rooms', roomId, 'messages'),
    orderBy('createdAt', 'asc'),
    limit(200)
  )
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() } as RoomMessage)))
  })
}

export function subscribeRoom(
  roomId: string,
  callback: (room: WatchRoom | null) => void
) {
  return onSnapshot(doc(db, 'watch_rooms', roomId), snap => {
    callback(snap.exists() ? ({ id: snap.id, ...snap.data() } as WatchRoom) : null)
  })
}

// ── 파일 공유 ───────────────────────────────────────────

export async function uploadRoomFile(
  roomId: string,
  uid: string,
  displayName: string,
  photoURL: string,
  file: File
): Promise<void> {
  const safeName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
  const storageRef = ref(storage, `room_files/${roomId}/${safeName}`)
  await uploadBytes(storageRef, file, { contentType: file.type })
  const url = await getDownloadURL(storageRef)
  await sendMessage(roomId, {
    type: 'file',
    uid,
    displayName,
    photoURL,
    content: file.name,
    fileUrl: url,
    fileType: file.type,
    fileSize: file.size,
  })
}

// ── 음성 청크 업로드 (방장) ──────────────────────────────

export async function uploadVoiceChunk(
  roomId: string,
  chunkIndex: number,
  blob: Blob
): Promise<void> {
  const storageRef = ref(storage, `voice/${roomId}/chunk_${chunkIndex}.webm`)
  await uploadBytes(storageRef, blob, { contentType: 'audio/webm' })
  const url = await getDownloadURL(storageRef)
  await updateDoc(doc(db, 'watch_rooms', roomId), {
    'voice.chunkIndex': chunkIndex,
    'voice.chunkUrl': url,
    'voice.updatedAt': Date.now(),
    'voice.active': true,
  })
}

export async function stopVoice(roomId: string): Promise<void> {
  await updateDoc(doc(db, 'watch_rooms', roomId), {
    'voice.active': false,
  })
}

// ── 투표 ────────────────────────────────────────────────

export interface RoomPoll {
  id: string
  question: string
  options: string[]
  votes: Record<string, number>   // uid → option index
  results: number[]               // options별 득표수 배열
  closed: boolean
  createdAt: Timestamp
}

export async function createPoll(
  roomId: string,
  question: string,
  options: string[]
): Promise<string> {
  const ref2 = await addDoc(collection(db, 'watch_rooms', roomId, 'polls'), {
    question,
    options,
    votes: {},
    results: options.map(() => 0),
    closed: false,
    createdAt: serverTimestamp(),
  })
  // 시스템 메시지로 투표 알림
  await addDoc(collection(db, 'watch_rooms', roomId, 'messages'), {
    type: 'system', uid: '', displayName: '', photoURL: '',
    content: `📊 새 투표가 열렸습니다: "${question}"`,
    createdAt: serverTimestamp(),
  })
  return ref2.id
}

export async function votePoll(
  roomId: string,
  pollId: string,
  uid: string,
  optionIndex: number,
  prevOptionIndex?: number
): Promise<void> {
  const pollRef = doc(db, 'watch_rooms', roomId, 'polls', pollId)
  const updates: Record<string, any> = {
    [`votes.${uid}`]: optionIndex,
    [`results.${optionIndex}`]: increment(1),
  }
  if (prevOptionIndex !== undefined) {
    updates[`results.${prevOptionIndex}`] = increment(-1)
  }
  await updateDoc(pollRef, updates)
}

export async function closePoll(roomId: string, pollId: string): Promise<void> {
  await updateDoc(doc(db, 'watch_rooms', roomId, 'polls', pollId), { closed: true })
}

export function subscribePolls(
  roomId: string,
  callback: (polls: RoomPoll[]) => void
) {
  const q = query(
    collection(db, 'watch_rooms', roomId, 'polls'),
    orderBy('createdAt', 'desc'),
    limit(20)
  )
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() } as RoomPoll)))
  })
}
