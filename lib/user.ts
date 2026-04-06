import { auth } from '@/lib/firebase'

export function getLocalUserId(): string {
  if (typeof window === 'undefined') return ''
  
  // 1. Firebase Auth 우선
  if (auth.currentUser) {
    return auth.currentUser.uid
  }

  // 2. 비로그인 시 로컬 스토리지 익명 ID (Phase 1,2 호환용)
  let uid = localStorage.getItem('nextcurator_uid')
  if (!uid) {
    uid = 'user_' + Math.random().toString(36).substr(2, 9)
    localStorage.setItem('nextcurator_uid', uid)
  }
  return uid
}
