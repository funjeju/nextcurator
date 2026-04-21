import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: '유튜브 영어 영상으로 영어 공부하는 법 — AI 워크시트 자동 생성 | 쏙튜브',
  description: 'TED, BBC, CNN 영어 유튜브 영상을 AI가 핵심 단어·주요 표현·한국어 요약으로 자동 정리합니다. CEFR 레벨별 영어 학습 자료를 10초 만에 만드세요.',
  keywords: ['유튜브 영어 공부', '유튜브 영어 요약', '영어 영상 워크시트', '유튜브 영어 학습', 'TED 영어 요약', '영어 유튜브 자막 정리', '영어 자막 단어 추출', 'CEFR 영어 학습', '유튜브 영어 스크립트 정리', '영어 듣기 공부 유튜브'],
}

export default function EnglishGuidePage() {
  return (
    <article className="flex flex-col gap-10 max-w-2xl">
      <div>
        <div className="flex items-center gap-2 text-[#75716e] text-xs mb-4">
          <Link href="/guide" className="hover:text-white transition-colors">사용설명서</Link>
          <span>›</span><span>영상 요약</span><span>›</span>
          <span className="text-white">영어 학습</span>
        </div>
        <h1 className="text-2xl font-black text-white mb-3">🔤 영어 유튜브 영상을 AI 학습 자료로 자동 변환</h1>
        <p className="text-[#a4a09c] text-sm leading-relaxed">
          영어 유튜브를 그냥 보고 끝내기엔 너무 아깝습니다. 쏙튜브는 TED 강연, BBC 뉴스, CNN 보도, 영어권 유튜버 영상을 <strong className="text-white">핵심 어휘 · 주요 표현 · 한국어 요약 · 문화 맥락</strong>으로 자동 정리합니다. 영어 자막이 있는 모든 유튜브 영상이 5분 안에 개인화된 영어 학습 자료가 됩니다. 영어 공부하는 분, 영어권 정보를 빠르게 소화해야 하는 직장인, 학생 모두에게 유용합니다.
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-bold text-white border-l-2 border-blue-500 pl-3">이런 영어 유튜브 채널에 최적화</h2>
        <div className="grid grid-cols-2 gap-2">
          {[
            ['🎤', 'TED / TED-Ed 강연'],
            ['📡', 'BBC / CNN 영어 뉴스'],
            ['💼', '비즈니스 영어 채널'],
            ['🎓', '영어 문법·회화 강의'],
            ['🌍', '다큐멘터리·교양'],
            ['🎬', '영어권 유튜버 일상·브이로그'],
          ].map(([icon, label]) => (
            <div key={label as string} className="bg-[#32302e] rounded-xl px-3 py-2.5 text-[#a4a09c] text-xs flex items-center gap-2">
              <span>{icon}</span>{label}
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-base font-bold text-white border-l-2 border-blue-500 pl-3">유튜브로 영어 공부하는 방법 — 단계별 안내</h2>
        <ol className="flex flex-col gap-3">
          {[
            { step: '1', title: '영어 유튜브 URL 붙여넣기', desc: '영어 자막(자동 생성 포함)이 있는 영상이면 모두 지원됩니다. TED.com 영상, YouTube 영어 채널 모두 가능합니다.' },
            { step: '2', title: '🔤 영어 카테고리 선택', desc: '영어 학습에 특화된 구조로 요약됩니다. 단순 번역이 아닌 어휘·표현·문화 맥락까지 포함된 학습 자료가 생성됩니다.' },
            { step: '3', title: '언어 선택 — 한국어 번역 또는 원문 영어', desc: '비한국어 자막 감지 시 한국어 번역 요약과 원문 영어 요약 중 선택할 수 있습니다. 상급자는 원문으로, 초중급자는 번역으로 선택하세요.' },
            { step: '4', title: '워크시트 저장 & 반복 학습', desc: '마이페이지 라이브러리에 저장해 언제든 복습하세요. 같은 영상을 두 번 요약하면 캐시로 즉시 불러와 API 비용 없이 재활용됩니다.' },
          ].map(item => (
            <li key={item.step} className="flex gap-4 bg-[#32302e] rounded-2xl p-4">
              <span className="w-7 h-7 rounded-full bg-blue-500/20 text-blue-400 font-bold text-sm flex items-center justify-center shrink-0">{item.step}</span>
              <div>
                <p className="text-white font-semibold text-sm">{item.title}</p>
                <p className="text-[#75716e] text-xs mt-1 leading-relaxed">{item.desc}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="bg-[#32302e] rounded-2xl p-5 flex flex-col gap-3">
        <h2 className="text-base font-bold text-white">영어 요약에 포함되는 학습 항목</h2>
        <ul className="grid grid-cols-2 gap-2.5">
          {[
            ['📚', '핵심 어휘 & 예문'],
            ['💬', '주요 표현 & 숙어'],
            ['🇰🇷', '한국어 전체 요약'],
            ['🧩', '주제별 단락 요약'],
            ['🌐', '문화 배경 & 맥락'],
            ['✏️', '토론 포인트 제시'],
          ].map(([icon, label]) => (
            <li key={label as string} className="text-[#a4a09c] text-xs flex items-center gap-2">
              <span>{icon}</span>{label}
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-bold text-white border-l-2 border-blue-500 pl-3">영어 학습 활용 시나리오</h2>
        <div className="flex flex-col gap-3">
          {[
            { icon: '🎯', title: '매일 TED 영어 공부', desc: 'TED 영상 하나를 요약해 어휘장으로 저장. 출퇴근 시간에 반복 복습하면 한 달에 30개 영어 주제를 소화할 수 있습니다.' },
            { icon: '📰', title: '영어 뉴스 빠른 소화', desc: 'BBC·CNN 뉴스 영상을 한국어 요약 + 핵심 영어 표현으로 정리. 시사 영어 실력과 배경 지식을 동시에 키울 수 있습니다.' },
            { icon: '💼', title: '비즈니스 영어 준비', desc: '외국계 기업 면접·프레젠테이션 준비에 유용한 비즈니스 영어 유튜브를 요약해 표현집으로 활용하세요.' },
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

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-bold text-white border-l-2 border-blue-500 pl-3">자주 묻는 질문</h2>
        <div className="flex flex-col gap-2">
          {[
            { q: '영어 자동 생성 자막도 인식되나요?', a: 'YouTube 자동 생성 자막도 분석 가능합니다. 단, 자동 생성 자막의 정확도에 따라 요약 품질이 다를 수 있습니다.' },
            { q: '일본어, 스페인어 등 다른 언어 영상도 되나요?', a: '현재는 한국어·영어 위주로 최적화되어 있습니다. 다른 언어 영상은 자동 분류 모드로 시도해보세요.' },
          ].map(item => (
            <div key={item.q} className="bg-[#32302e] rounded-xl p-4">
              <p className="text-white text-sm font-semibold mb-1">Q. {item.q}</p>
              <p className="text-[#75716e] text-xs leading-relaxed">{item.a}</p>
            </div>
          ))}
        </div>
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
