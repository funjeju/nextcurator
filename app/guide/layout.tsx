import type { Metadata } from 'next'
import Header from '@/components/common/Header'
import GuideNav from '@/components/guide/GuideNav'

export const metadata: Metadata = {
  title: { default: '쏙튜브 사용설명서', template: '%s | 쏙튜브 가이드' },
  description: '유튜브 AI 요약 서비스 쏙튜브의 기능별 사용설명서입니다. 재생목록 가져오기, 블로그 초안 생성, 숏폼 스크립트, 영어 학습까지 모든 기능을 안내합니다.',
}

export default function GuideLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#252423] font-sans">
      <Header />
      <div className="max-w-6xl mx-auto px-4 py-8 flex gap-8">
        <aside className="hidden md:block w-56 shrink-0">
          <GuideNav />
        </aside>
        <main className="flex-1 min-w-0">
          {children}
        </main>
      </div>
    </div>
  )
}
