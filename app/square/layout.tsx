import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'SQUARE K — 지식 광장',
  description: '엿보고 나누는 지식 광장. 다른 사람들이 요약한 YouTube·PDF·음성을 탐색하고 내 라이브러리에 담아보세요.',
  keywords: ['유튜브 요약 모음', '공개 요약', 'AI 요약 광장', '유튜브 라이브러리 공유', 'SQUARE K', '지식 광장'],
  alternates: {
    canonical: 'https://ssoktube.com/square',
  },
  openGraph: {
    title: 'SQUARE K — 지식 광장 | SSOKTUBE',
    description: '엿보고 나누는 지식 광장. 다른 사람들이 요약한 YouTube·PDF·음성을 탐색하고 내 라이브러리에 담아보세요.',
    url: 'https://ssoktube.com/square',
    type: 'website',
  },
}

export default function SquareLayout({ children }: { children: React.ReactNode }) {
  return children
}
