import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: '유튜브 뉴스·경제 영상 핵심 요약 — 5W1H 자동 정리 | 쏙튜브',
  description: '삼프로TV, 신사임당, KBS·JTBC 뉴스 유튜브를 AI가 5W1H 형식으로 자동 정리합니다. 경제 시사 영상 10개를 5분 안에 브리핑하세요.',
  keywords: ['유튜브 뉴스 요약', '경제 유튜브 요약', '시사 유튜브 정리', '삼프로TV 요약', '유튜브 경제 브리핑', '뉴스 AI 요약', '유튜브 주식 영상 요약', '재테크 유튜브 정리', '경제 뉴스 자동 요약', '유튜브 뉴스 핵심 정리'],
}

export default function NewsGuidePage() {
  return (
    <article className="flex flex-col gap-10 max-w-2xl">
      <div>
        <div className="flex items-center gap-2 text-[#75716e] text-xs mb-4">
          <Link href="/guide" className="hover:text-white transition-colors">사용설명서</Link>
          <span>›</span><span>영상 요약</span><span>›</span>
          <span className="text-white">뉴스 & 경제</span>
        </div>
        <h1 className="text-2xl font-black text-white mb-3">🗞️ 경제·뉴스 유튜브 10개, 5분 안에 핵심 브리핑</h1>
        <p className="text-[#a4a09c] text-sm leading-relaxed">
          삼프로TV, 신사임당, KBS 뉴스룸, JTBC 뉴스 등 경제·시사 유튜브 채널은 많지만 다 볼 시간이 없습니다. 쏙튜브는 뉴스·경제 영상을 <strong className="text-white">누가(Who) · 언제(When) · 어디서(Where) · 무엇을(What) · 왜(Why) · 어떻게(How)</strong> 형식으로 핵심만 추려 정리합니다. 주식·부동산·경제 지표 영상도 요점만 빠르게 파악할 수 있습니다.
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-bold text-white border-l-2 border-slate-400 pl-3">이런 뉴스·경제 채널에 최적화</h2>
        <div className="grid grid-cols-2 gap-2">
          {['삼프로TV', '신사임당 (경제·부동산)', 'JTBC 뉴스룸', 'KBS·MBC·SBS 뉴스', '주식·ETF 분석 채널', '부동산·경매 강의 채널', '세계 경제·환율 해설', '연준·금리 분석 영상'].map(t => (
            <div key={t} className="bg-[#32302e] rounded-xl px-3 py-2 text-[#a4a09c] text-xs flex items-center gap-1.5">
              <span className="text-slate-400">✦</span>{t}
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-bold text-white border-l-2 border-slate-400 pl-3">AI 뉴스 요약 결과 예시</h2>
        <div className="bg-[#1c1a18] border border-white/5 rounded-2xl p-5 text-sm">
          <p className="text-[#75716e] text-xs mb-3">예시: 미국 연준 금리 인상 관련 경제 유튜브 요약</p>
          <ul className="flex flex-col gap-2.5">
            {[
              ['📌 3줄 핵심 요약', '미국 연준이 기준금리를 0.25%p 인상. 한국 가계대출 이자 부담 증가 예상. 환율 및 수출 기업 영향 분석.'],
              ['👥 Who', '제롬 파월 연준 의장, 이창용 한국은행 총재'],
              ['📅 When', '2025년 3월 FOMC 정례회의 결과 발표'],
              ['🎯 Why', '미국 인플레이션 대응 통화 긴축 정책 지속'],
              ['💡 시사점', '한국 기준금리 동결 가능성, 원·달러 환율 상승 압력'],
            ].map(([label, val]) => (
              <li key={label as string} className="flex gap-3">
                <span className="text-[#75716e] text-xs shrink-0 w-28">{label}</span>
                <span className="text-[#a4a09c] text-xs leading-relaxed">{val}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-base font-bold text-white border-l-2 border-slate-400 pl-3">경제·뉴스 영상 활용 시나리오</h2>
        <div className="flex flex-col gap-3">
          {[
            { icon: '📈', title: '아침 경제 브리핑', desc: '출근 전 경제 뉴스 유튜브 3~5개를 요약해 핵심만 읽으면 전날 주요 경제 이슈를 10분 안에 파악할 수 있습니다.' },
            { icon: '🏠', title: '부동산·주식 투자 공부', desc: '삼프로TV·신사임당 채널의 전문가 분석 영상을 요약·저장해 나만의 투자 인사이트 라이브러리를 만드세요.' },
            { icon: '📋', title: '직장인 업무 보고서 준비', desc: '시장 동향·산업 분석 유튜브를 요약해 보고서 작성 시 근거 자료로 활용하세요. 5W1H 구조로 정리된 내용은 보고서에 바로 적용할 수 있습니다.' },
          ].map(item => (
            <div key={item.title} className="flex gap-3 bg-[#32302e] rounded-2xl p-4">
              <span className="text-xl shrink-0">{item.icon}</span>
              <div>
                <p className="text-white font-semibold text-sm">{item.title}</p>
                <p className="text-[#75716e] text-xs mt-1 leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-[#32302e] rounded-2xl p-5 flex flex-col gap-2">
        <h2 className="text-base font-bold text-white">뉴스·경제 요약에 포함되는 내용</h2>
        <ul className="grid grid-cols-2 gap-2.5 mt-1">
          {['헤드라인 & 3줄 요약', '5W1H 핵심 분석', '주요 인물 & 발언', '시장 영향 & 시사점', '배경 지식 보충 설명', '관련 키워드 정리'].map(t => (
            <li key={t} className="text-[#a4a09c] text-xs flex items-center gap-1.5">
              <span className="text-slate-400">✦</span>{t}
            </li>
          ))}
        </ul>
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
