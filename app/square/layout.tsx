import { Metadata } from 'next'

export const metadata: Metadata = {
  title: '광장 — 공개 요약 모아보기',
  description: '다른 사용자들이 공개한 YouTube AI 요약을 탐색하고 인사이트를 나눠보세요.',
  keywords: ['유튜브 요약 모음', '공개 요약', 'AI 요약 광장', '유튜브 라이브러리 공유'],
  alternates: {
    canonical: 'https://ssoktube.com/square',
  },
  openGraph: {
    title: '광장 — 공개 요약 모아보기 | SSOKTUBE',
    description: '다른 사용자들이 공개한 YouTube AI 요약을 탐색하고 인사이트를 나눠보세요.',
    url: 'https://ssoktube.com/square',
    type: 'website',
  },
}

export default function SquareLayout({ children }: { children: React.ReactNode }) {
  return children
}
