import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: '유튜브 영어 영상으로 영어 공부하기 — 쏙튜브',
  description: '영어 유튜브 영상을 CEFR 레벨별 워크시트로 자동 변환합니다. 단어장, 핵심 문장, 요약까지 한번에 정리.',
  keywords: ['유튜브 영어 공부', '유튜브 영어 요약', '영어 영상 워크시트', '유튜브 영어 학습'],
}

export default function EnglishGuidePage() {
  return (
    <article className="flex flex-col gap-8 max-w-2xl">
      <div>
        <div className="flex items-center gap-2 text-[#75716e] text-xs mb-4">
          <Link href="/guide" className="hover:text-white transition-colors">사용설명서</Link>
          <span>›</span><span>영상 요약</span><span>›</span>
          <span className="text-white">영어 학습</span>
        </div>
        <h1 className="text-2xl font-black text-white mb-3">🔤 영어 영상, 레벨별 워크시트로 자동 변환</h1>
        <p className="text-[#a4a09c] text-sm leading-relaxed">
          영어 유튜브를 그냥 보고 끝내기엔 아깝습니다. 쏙튜브는 영어 영상을 <strong className="text-white">핵심 단어 · 주요 문장 · 한국어 요약</strong>으로 정리해 학습 자료로 만들어 줍니다.
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-bold text-white">추천 영상 유형</h2>
        <div className="grid grid-cols-2 gap-2">
          {['TED / TED-Ed 강연', '영어 뉴스 (BBC, CNN)', '비즈니스 영어 채널', '영어 토론 & 인터뷰', '영어 다큐멘터리', '영어권 유튜버 브이로그'].map(t => (
            <div key={t} className="bg-[#32302e] rounded-xl px-3 py-2 text-[#a4a09c] text-xs flex items-center gap-1.5">
              <span className="text-blue-400">✦</span>{t}
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-base font-bold text-white">사용 방법</h2>
        <ol className="flex flex-col gap-3">
          {[
            { step: '1', title: '영어 유튜브 URL 붙여넣기', desc: '영어 자막이 있는 영상이면 모두 지원됩니다.' },
            { step: '2', title: '🔤 영어 카테고리 선택', desc: '영어 학습에 최적화된 구조로 요약됩니다.' },
            { step: '3', title: '언어 선택', desc: '원문 영어로 요약받거나, 한국어로 번역해 요약받을 수 있습니다.' },
            { step: '4', title: '워크시트 저장', desc: '마이페이지 라이브러리에 저장해 언제든 복습하세요.' },
          ].map(item => (
            <li key={item.step} className="flex gap-4 bg-[#32302e] rounded-2xl p-4">
              <span className="w-7 h-7 rounded-full bg-blue-500/20 text-blue-400 font-bold text-sm flex items-center justify-center shrink-0">{item.step}</span>
              <div>
                <p className="text-white font-semibold text-sm">{item.title}</p>
                <p className="text-[#75716e] text-xs mt-1">{item.desc}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="bg-[#32302e] rounded-2xl p-5 flex flex-col gap-2">
        <h2 className="text-base font-bold text-white">요약 결과에 포함되는 내용</h2>
        <ul className="grid grid-cols-2 gap-2 mt-1">
          {['핵심 어휘 & 예문', '주요 표현 정리', '한국어 전체 요약', '주제별 단락 요약', '토론 포인트', '배경지식 보충'].map(t => (
            <li key={t} className="text-[#a4a09c] text-xs flex items-center gap-1.5">
              <span className="text-blue-400">✦</span>{t}
            </li>
          ))}
        </ul>
      </section>

      <div className="flex items-center gap-3 pt-2 border-t border-white/5">
        <Link href="/" className="px-5 py-2.5 bg-blue-500 hover:bg-blue-400 text-white font-bold text-sm rounded-xl transition-colors">
          영어 영상 요약하기
        </Link>
        <Link href="/guide/summary/news" className="text-[#75716e] text-sm hover:text-white transition-colors">
          뉴스 요약 →
        </Link>
      </div>
    </article>
  )
}
