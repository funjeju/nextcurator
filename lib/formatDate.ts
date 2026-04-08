/**
 * Firestore Timestamp, Date, 숫자(ms) 모두 받아서 "n일 전" 또는 "YYYY.MM.DD" 포맷 반환
 */
export function formatRelativeDate(value: unknown): string {
  if (!value) return ''

  let ms: number

  if (typeof value === 'object' && value !== null && 'toMillis' in value) {
    ms = (value as { toMillis: () => number }).toMillis()
  } else if (value instanceof Date) {
    ms = value.getTime()
  } else if (typeof value === 'number') {
    ms = value
  } else {
    return ''
  }

  const now = Date.now()
  const diff = now - ms
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (days === 0) return '오늘'
  if (days === 1) return '어제'
  if (days < 7) return `${days}일 전`

  const d = new Date(ms)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}.${m}.${day}`
}
