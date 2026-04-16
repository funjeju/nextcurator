import {
  db
} from './firebase'
import {
  collection, doc, setDoc, getDoc, getDocs, addDoc,
  query, where, orderBy, serverTimestamp, writeBatch, limit
} from 'firebase/firestore'
import { saveSummary, getSavedSummariesByFolder } from './db'

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface ClassRoom {
  classCode: string       // 문서 ID: 'AB1C23'
  teacherId: string
  teacherName: string
  schoolName: string
  grade: number
  classNum: number
  masterFolderId?: string  // 하위호환: 단일 폴더 (deprecated)
  masterFolderIds?: string[] // 기준 폴더 목록 (복수 지원)
  createdAt: any
}

// 기준 폴더 ID 목록 반환 (단일/복수 하위호환)
export function getMasterFolderIds(classroom: ClassRoom): string[] {
  if (classroom.masterFolderIds?.length) return classroom.masterFolderIds
  if (classroom.masterFolderId) return [classroom.masterFolderId]
  return []
}

export interface ActivityLog {
  id?: string
  studentId: string
  studentName: string
  classCode: string
  type: 'login' | 'logout' | 'play' | 'quiz' | 'meta' | 'comment' | 'segment'
  videoId?: string
  sessionId?: string
  videoTitle?: string
  value: Record<string, any>  // type별 상세 데이터
  timestamp: any
}

// meta 타입 value 예시:
// { level: 'complete' | 'confused' | 'unknown' }
// quiz 타입 value 예시:
// { questionIdx: 0, selected: 'B', correct: false, attempts: 2 }
// play 타입 value 예시:
// { durationSec: 120, percentWatched: 80, completed: true }
// login 타입 value 예시:
// { device: 'mobile' | 'desktop' }

// ─────────────────────────────────────────────
// Class Code 생성: 6자리 대문자+숫자 랜덤
// ─────────────────────────────────────────────

export function generateClassCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

// 중복 확인 후 고유 코드 발급
export async function generateUniqueClassCode(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateClassCode()
    const snap = await getDoc(doc(db, 'classes', code))
    if (!snap.exists()) return code
  }
  throw new Error('클래스 코드 생성에 실패했습니다. 다시 시도해주세요.')
}

// ─────────────────────────────────────────────
// 학생 이메일 생성 (Firebase Auth 내부 식별자)
// ─────────────────────────────────────────────

export function buildStudentEmail(classCode: string, studentName: string): string {
  // UTF-8 바이트를 직접 base64로 인코딩 — 한글 자모 단위로 고유성 보장
  // 주의: encodeURIComponent + slice 방식은 비슷한 이름의 공통 prefix를 잘라내서
  //       "심지후"/"심지현"/"심지민" 등이 동일한 이메일이 되는 버그가 있었음
  const encoded = Buffer.from(studentName, 'utf8')
    .toString('base64')
    .replace(/[+/=]/g, '')
    .toLowerCase()
  return `${classCode.toLowerCase()}.${encoded}@cls.ssoktube.com`
}

// ─────────────────────────────────────────────
// 클래스 CRUD
// ─────────────────────────────────────────────

export async function createClass(data: Omit<ClassRoom, 'classCode' | 'createdAt'>): Promise<string> {
  const classCode = await generateUniqueClassCode()
  await setDoc(doc(db, 'classes', classCode), {
    ...data,
    classCode,
    masterFolderIds: data.masterFolderIds || [],
    createdAt: serverTimestamp(),
  })
  return classCode
}

export async function getClass(classCode: string): Promise<ClassRoom | null> {
  const snap = await getDoc(doc(db, 'classes', classCode.toUpperCase()))
  if (!snap.exists()) return null
  return { classCode: snap.id, ...snap.data() } as ClassRoom
}

export async function getTeacherClasses(teacherId: string): Promise<ClassRoom[]> {
  const q = query(collection(db, 'classes'), where('teacherId', '==', teacherId))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ classCode: d.id, ...d.data() }) as ClassRoom)
}

export async function setMasterFolder(classCode: string, folderId: string): Promise<void> {
  await setDoc(doc(db, 'classes', classCode), { masterFolderId: folderId }, { merge: true })
}

// 기준 폴더 토글 (추가/제거)
export async function toggleMasterFolder(
  classCode: string,
  folderId: string,
  currentIds: string[],
): Promise<string[]> {
  const newIds = currentIds.includes(folderId)
    ? currentIds.filter(id => id !== folderId)
    : [...currentIds, folderId]
  await setDoc(doc(db, 'classes', classCode), { masterFolderIds: newIds }, { merge: true })
  return newIds
}

// ─────────────────────────────────────────────
// 학생 목록 조회
// ─────────────────────────────────────────────

export async function getClassStudents(classCode: string): Promise<any[]> {
  // role 필터를 제거해 복합 인덱스 불필요 → classCode만으로 조회 후 클라이언트 필터
  const q = query(
    collection(db, 'users'),
    where('classCode', '==', classCode),
  )
  const snap = await getDocs(q)
  return snap.docs
    .map(d => ({ uid: d.id, ...d.data() }))
    .filter((u: any) => u.role === 'student')
}

// ─────────────────────────────────────────────
// 폴더 상속: 교사의 마스터 폴더 → 학생에게 복제
// ─────────────────────────────────────────────

export async function inheritMasterFolder(
  teacherId: string,
  masterFolderId: string,
  studentId: string,
  studentName: string,
  teacherName: string,
): Promise<string> {
  // 1. 마스터 폴더 내 저장된 영상들 가져오기
  const items = await getSavedSummariesByFolder(teacherId, masterFolderId)

  // 2. 학생에게 새 폴더 생성
  const folderRef = await addDoc(collection(db, 'folders'), {
    userId: studentId,
    name: `📚 ${teacherName} 선생님의 수업자료`,
    visibility: 'private',
    isClassFolder: true,
    classCode: null,          // 이후 set으로 채워짐
    clonedFrom: {
      userId: teacherId,
      displayName: teacherName,
      originalFolderId: masterFolderId,
    },
    createdAt: serverTimestamp(),
  })

  // 3. 영상들 복사 (batch write)
  if (items.length > 0) {
    const batch = writeBatch(db)
    for (const item of items) {
      const newRef = doc(collection(db, 'saved_summaries'))
      batch.set(newRef, {
        userId: studentId,
        userDisplayName: studentName,
        userPhotoURL: '',
        folderId: folderRef.id,
        sessionId: item.sessionId,
        videoId: item.videoId,
        title: item.title,
        channel: item.channel || '',
        thumbnail: item.thumbnail,
        category: item.category,
        summary: item.summary || null,
        contextSummary: item.contextSummary || '',
        isPublic: false,
        transcript: item.transcript || '',
        transcriptSource: item.transcriptSource || '',
        likeCount: 0,
        viewCount: 0,
        createdAt: serverTimestamp(),
      })
    }
    await batch.commit()
  }

  return folderRef.id
}

// 교사가 새 영상을 클래스 학생 전체에게 배포
export async function pushVideoToClass(
  classCode: string,
  teacherFolderId: string,
  teacherId: string,
  teacherName: string,
  savedSummaryItem: any,
): Promise<void> {
  const students = await getClassStudents(classCode)

  const batch = writeBatch(db)

  for (const student of students) {
    // 학생의 수업자료 폴더 찾기
    const q = query(
      collection(db, 'folders'),
      where('userId', '==', student.uid),
      where('clonedFrom.originalFolderId', '==', teacherFolderId)
    )
    const folderSnap = await getDocs(q)
    const studentFolderId = folderSnap.empty ? null : folderSnap.docs[0].id

    if (!studentFolderId) continue

    const newRef = doc(collection(db, 'saved_summaries'))
    batch.set(newRef, {
      userId: student.uid,
      userDisplayName: student.studentName || student.displayName || '',
      userPhotoURL: '',
      folderId: studentFolderId,
      sessionId: savedSummaryItem.sessionId,
      videoId: savedSummaryItem.videoId,
      title: savedSummaryItem.title,
      channel: savedSummaryItem.channel || '',
      thumbnail: savedSummaryItem.thumbnail,
      category: savedSummaryItem.category,
      summary: savedSummaryItem.summary || null,
      contextSummary: savedSummaryItem.contextSummary || '',
      isPublic: false,
      transcript: '',
      transcriptSource: '',
      likeCount: 0,
      viewCount: 0,
      createdAt: serverTimestamp(),
    })
  }

  await batch.commit()
}

// ─────────────────────────────────────────────
// 활동 로그
// ─────────────────────────────────────────────

export async function logActivity(log: Omit<ActivityLog, 'id' | 'timestamp'>): Promise<void> {
  await addDoc(collection(db, 'activity_logs'), {
    ...log,
    timestamp: serverTimestamp(),
  })
}

export async function getStudentLogs(
  studentId: string,
  limitCount = 100
): Promise<ActivityLog[]> {
  const q = query(
    collection(db, 'activity_logs'),
    where('studentId', '==', studentId),
    orderBy('timestamp', 'desc'),
    limit(limitCount)
  )
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }) as ActivityLog)
}

export async function getClassLogs(
  classCode: string,
  limitCount = 500
): Promise<ActivityLog[]> {
  const q = query(
    collection(db, 'activity_logs'),
    where('classCode', '==', classCode),
    orderBy('timestamp', 'desc'),
    limit(limitCount)
  )
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }) as ActivityLog)
}

// 학생별 활동 요약 (대시보드용)
export function summarizeStudentLogs(logs: ActivityLog[]): {
  loginCount: number
  metaComplete: number
  metaConfused: number
  metaUnknown: number
  quizAttempts: number
  quizCorrect: number
  lastActive: any
} {
  const result = {
    loginCount: 0,
    metaComplete: 0,
    metaConfused: 0,
    metaUnknown: 0,
    quizAttempts: 0,
    quizCorrect: 0,
    lastActive: null as any,
  }
  for (const log of logs) {
    if (!result.lastActive && log.timestamp) result.lastActive = log.timestamp
    if (log.type === 'login') result.loginCount++
    if (log.type === 'meta') {
      if (log.value.metaLevel === 'complete') result.metaComplete++
      else if (log.value.metaLevel === 'confused') result.metaConfused++
      else if (log.value.metaLevel === 'unknown') result.metaUnknown++
    }
    if (log.type === 'quiz') {
      result.quizAttempts++
      if (log.value.correct) result.quizCorrect++
    }
  }
  return result
}
