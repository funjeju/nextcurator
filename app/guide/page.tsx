import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: '쏙튜브 사용설명서 — 유튜브 AI 요약 전체 기능 안내',
  description: '쏙튜브의 모든 기능을 한눈에 확인하세요. 유튜브 영상 요약, 재생목록 일괄 처리, 블로그 초안 생성, 숏폼 스크립트 추출까지.',
}

const SECTIONS = [
  {
    title: '영상 요약',
    items: [
      { href: '/guide/summary/recipe', icon: '🍳', title: '요리 레시피 정리', desc: '요리 영상을 재료·단계·팁 카드로 정리' },
      { href: '/guide/summary/english', icon: '🔤', title: '영어 학습 정리', desc: '영어 영상을 레벨별 워크시트로 변환' },
      { href: '/guide/summary/news', icon: '🗞️', title: '뉴스 & 경제 브리핑', desc: '뉴스 영상을 5W1H 핵심으로 정리' },
      { href: '/guide/summary/travel', icon: '🧳', title: '여행 스팟 추출', desc: '여행 vlog에서 장소·팁·일정 자동 추출' },
    ],
  },
  {
    title: '생산성 도구',
    items: [
      { href: '/guide/import', icon: '📋', title: '재생목록 가져오기', desc: 'YouTube 재생목록을 AI로 일괄 요약' },
      { href: '/guide/blog', icon: '✍️', title: '블로그 초안 생성', desc: '영상을 SEO 최적화 블로그 글로 변환' },
      { href: '/guide/shorts', icon: '🎬', title: '숏폼 스크립트', desc: '롱폼 영상에서 숏츠 대본 자동 추출' },
      { href: '/guide/search', icon: '🔍', title: 'AI 대화 검색', desc: '내 라이브러리를 AI와 대화로 탐색' },
    ],
  },
  {
    title: '커뮤니티 & 교육',
    items: [
      { href: '/guide/square', icon: '🌐', title: '스퀘어 활용법', desc: '요약을 공유하고 다른 시청자의 해석 발견' },
      { href: '/guide/classroom', icon: '🎓', title: '클래스룸', desc: '선생님용 학습 관리 및 워크시트 배포' },
      { href: '/guide/pricing', icon: '💳', title: '요금제 안내', desc: '무료·유료 플랜 비교' },
    ],
  },
]

export default function GuidePage() {
  return (
    <div className="flex flex-col gap-10">
      <div>
        <h1 className="text-2xl font-black text-white mb-2">쏙튜브 사용설명서</h1>
        <p className="text-[#75716e] text-sm leading-relaxed max-w-xl">
          유튜브 영상을 더 스마트하게 활용하는 법. 요리·영어·뉴스·여행부터 블로그 초안 생성, 숏폼 스크립트까지 — 모든 기능을 단계별로 안내합니다.
        </p>
      </div>
      {SECTIONS.map(section => (
        <section key={section.title}>
          <h2 className="text-xs font-bold text-[#75716e] uppercase tracking-widest mb-3">{section.title}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {section.items.map(item => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-start gap-3 bg-[#32302e] hover:bg-[#3d3a38] border border-white/5 hover:border-white/15 rounded-2xl p-4 transition-all group"
              >
                <span className="text-2xl mt-0.5">{item.icon}</span>
                <div>
                  <p className="text-white font-semibold text-sm group-hover:text-orange-400 transition-colors">{item.title}</p>
                  <p className="text-[#75716e] text-xs mt-0.5">{item.desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
