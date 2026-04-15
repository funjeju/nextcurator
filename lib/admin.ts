const ADMIN_EMAIL = process.env.ADMIN_EMAIL   // 서버 전용 (NEXT_PUBLIC_ 아님)
const API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY!

/**
 * Firebase ID 토큰을 검증하고 관리자 여부를 반환합니다.
 * 클라이언트가 보낸 이메일을 신뢰하지 않고, Firebase Auth에서 직접 확인합니다.
 */
export async function checkIsAdminByToken(idToken: string): Promise<boolean> {
  if (!idToken || !ADMIN_EMAIL) return false

  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      }
    )
    if (!res.ok) return false
    const data = await res.json()
    const email: string = data?.users?.[0]?.email ?? ''
    return email === ADMIN_EMAIL
  } catch {
    return false
  }
}

/** @deprecated 클라이언트 제공 email 신뢰 방식 — 레거시 호환용 */
export async function checkIsAdmin(uid: string, email?: string): Promise<boolean> {
  if (!uid || !email || !ADMIN_EMAIL) return false
  return email === ADMIN_EMAIL
}
