import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: '유튜브 뉴스 영상 핵심 요약하기 — 쏙튜브',
  description: '경제·시사·뉴스 유튜브 영상을 5W1H 형식으로 자동 정리합니다. 10개 영상을 5분 안에 브리핑.',
  keywords: ['유튜브 뉴스 요약', '경제 유튜브 요약', '유튜브 시사 정리', '뉴스 AI 요약'],
}

export default function NewsGuidePage() {
  return (
    <article className="flex flex-col gap-8 max-w-2xl">
      <div>
        <div className="flex items-center gap-2 text-[#75716e] text-xs mb-4">
          <Link href="/guide" className="hover:text-white transition-colors">사용설명서</Link>
          <span>›</span><span>영상 요약</span><span>›</span>
          <span className="text-white">뉴스 & 경제</span>
        </div>
        <h1 className="text-2xl font-black text-white mb-3">🗞️ 뉴스 10개, 5분 안에 핵심만 브리핑</h1>
        <p className="text-[#a4a09c] text-sm leading-relaxed">
          경제·시사 유튜브 채널은 많지만 다 볼 시간은 없습니다. 쏙튜브는 뉴스·경제 영상을 <strong className="text-white">누가·언제·어디서·무엇을·왜·어떻게</strong> 형식으로 핵심만 추려 정리합니다.
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-bold text-white">이런 채널에 최적화</h2>
        <div className="grid grid-cols-2 gap-2">
          {['삼프로TV', '신사임당 (경제)', 'JTBC 뉴스룸', 'KBS 뉴스', '부동산 분석 채널', '주식·재테크 채널'].map(t => (
            <div key={t} className="bg-[#32302e] rounded-xl px-3 py-2 text-[#a4a09c] text-xs flex items-center gap-1.5">
              <span className="text-slate-400">✦</span>{t}
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-bold text-white">요약 결과 예시</h2>
        <div className="bg-[#1c1a18] border border-white/5 rounded-2xl p-5 text-sm">
          <p className="text-[#75716e] text-xs mb-3">예시: 금리 인상 관련 뉴스 영상 요약 결과</p>
          <ul className="flex flex-col gap-2">
            {[
              ['📌 핵심 요약', '미국 연준이 기준금리를 0.25%p 인상. 한국 경제에 미치는 영향 분석.'],
              ['👥 주요 인물', '제롬 파월 연준 의장, 이창용 한국은행 총재'],
              ['📅 시점', '2025년 3월 FOMC 회의 결과 발표 직후'],
              ['🎯 핵심 포인트', '가계 대출 부담 증가, 환율 영향, 수출 기업 영향'],
            ].map(([label, val]) => (
              <li key={label} className="flex gap-3">
                <span className="text-[#75716e] text-xs shrink-0 w-24">{label}</span>
                <span className="text-[#a4a09c] text-xs">{val}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <div className="flex items-center gap-3 pt-2 border-t border-white/5">
        <Link href="/" className="px-5 py-2.5 bg-slate-600 hover:bg-slate-500 text-white font-bold text-sm rounded-xl transition-colors">
          뉴스 영상 요약하기
        </Link>
        <Link href="/guide/summary/travel" className="text-[#75716e] text-sm hover:text-white transition-colors">
          여행 스팟 추출 →
        </Link>
      </div>
    </article>
  )
}
