import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: '유튜브 영상에서 숏폼 스크립트 자동 추출 — 쏙튜브',
  description: '롱폼 유튜브 영상에서 유튜브 쇼츠, 인스타그램 릴스, 틱톡용 바이럴 포인트와 스크립트를 자동으로 뽑아냅니다.',
  keywords: ['유튜브 숏폼 스크립트', '유튜브 쇼츠 대본', '롱폼 숏폼 변환', '유튜브 릴스 스크립트 자동 생성'],
}

export default function ShortsGuidePage() {
  return (
    <article className="flex flex-col gap-8 max-w-2xl">
      <div>
        <div className="flex items-center gap-2 text-[#75716e] text-xs mb-4">
          <Link href="/guide" className="hover:text-white transition-colors">사용설명서</Link>
          <span>›</span>
          <span className="text-white">숏폼 스크립트</span>
        </div>
        <h1 className="text-2xl font-black text-white mb-3">🎬 롱폼에서 바이럴 포인트 뽑아 숏츠 대본으로</h1>
        <p className="text-[#a4a09c] text-sm leading-relaxed">
          30분짜리 강의 영상에서 가장 임팩트 있는 3분을 찾아내고, 숏폼에 맞는 스크립트로 재구성합니다. <strong className="text-white">유튜브 쇼츠 · 인스타 릴스 · 틱톡</strong> 대본으로 바로 활용하세요.
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-bold text-white">추출되는 내용</h2>
        <div className="grid grid-cols-1 gap-3">
          {[
            { icon: '⚡', title: '훅 (Hook)', desc: '첫 3초 안에 시청자를 잡을 강렬한 오프닝 문장' },
            { icon: '🎯', title: '핵심 메시지', desc: '영상의 가장 가치 있는 인사이트 1~3가지' },
            { icon: '📝', title: '숏폼 스크립트', desc: '60초 이내 숏폼에 최적화된 전체 대본' },
            { icon: '🏷️', title: '추천 해시태그', desc: '플랫폼별 바이럴 가능성 높은 해시태그' },
          ].map(item => (
            <div key={item.title} className="flex gap-3 bg-[#32302e] rounded-xl p-3">
              <span className="text-xl">{item.icon}</span>
              <div>
                <p className="text-white font-semibold text-sm">{item.title}</p>
                <p className="text-[#75716e] text-xs mt-0.5">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-bold text-white">활용 시나리오</h2>
        <ul className="flex flex-col gap-2">
          {[
            '강의 영상 → 핵심 1줄 쇼츠 시리즈',
            '인터뷰 영상 → 명언·인사이트 클립 대본',
            '다큐멘터리 → 충격적 사실 숏폼 대본',
            '브이로그 → 하이라이트 릴스 스크립트',
          ].map(t => (
            <li key={t} className="flex items-start gap-2 text-[#a4a09c] text-sm">
              <span className="text-pink-400 mt-0.5 shrink-0">✓</span>{t}
            </li>
          ))}
        </ul>
      </section>

      <div className="flex items-center gap-3 pt-2 border-t border-white/5">
        <Link href="/" className="px-5 py-2.5 bg-pink-600 hover:bg-pink-500 text-white font-bold text-sm rounded-xl transition-colors">
          숏폼 스크립트 추출하기
        </Link>
        <Link href="/guide/search" className="text-[#75716e] text-sm hover:text-white transition-colors">
          AI 대화 검색 →
        </Link>
      </div>
    </article>
  )
}
