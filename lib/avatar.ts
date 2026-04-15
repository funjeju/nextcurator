export const AVATARS = [
  { emoji: '🦊', bg: '#7c3a10' },  // 주황 여우
  { emoji: '🐻', bg: '#5c3d1e' },  // 갈색 곰
  { emoji: '🦁', bg: '#7a5c00' },  // 사자
  { emoji: '🐼', bg: '#3a3a3a' },  // 판다
  { emoji: '🐯', bg: '#7a4a00' },  // 호랑이
  { emoji: '🐨', bg: '#3a5c5c' },  // 코알라
  { emoji: '🦋', bg: '#5c2a7a' },  // 나비
  { emoji: '🐸', bg: '#2a5c2a' },  // 개구리
  { emoji: '🦉', bg: '#5c4a1e' },  // 부엉이
  { emoji: '🐺', bg: '#2a3a5c' },  // 늑대
  { emoji: '🦝', bg: '#4a4a4a' },  // 너구리
  { emoji: '🐧', bg: '#1a4a5c' },  // 펭귄
]

export function getRandomAvatarEmoji(): string {
  return AVATARS[Math.floor(Math.random() * AVATARS.length)].emoji
}

export function getAvatarBg(emoji: string): string {
  return AVATARS.find(a => a.emoji === emoji)?.bg ?? '#3d3a38'
}
