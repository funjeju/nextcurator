import { db } from './firebase'
import { getDoc, doc } from 'firebase/firestore'

/**
 * 전역 관리자 이메일 설정 (환경 변수)
 */
const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'naggu1999@gmail.com'

/**
 * 서버 사이드에서 유저가 관리자인지 확인하는 간단한 로직 (MVP용)
 * 실제 운영시에는 Firebase Admin SDK를 통한 ID 토큰 검증이 필요합니다.
 */
export async function checkIsAdmin(uid: string, email?: string): Promise<boolean> {
  if (!uid) return false

  // 1. 이메일 기반 체크
  if (email && email === ADMIN_EMAIL) return true

  // 2. DB 역할 기반 체크 (REST API 등으로 서버에서 조회 가능하도록 구성 필요)
  // 여기서는 단순히 환경 변수 이메일 매칭을 우선합니다.
  return false
}
