import { Metadata } from 'next'

export const metadata: Metadata = {
  title: '마이페이지 — 내 라이브러리',
  description: '내가 저장한 YouTube AI 요약을 폴더별로 관리하세요.',
  robots: { index: false, follow: false },
}

export default function MypageLayout({ children }: { children: React.ReactNode }) {
  return children
}
