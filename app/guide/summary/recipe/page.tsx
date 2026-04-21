import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: '유튜브 요리 영상 레시피 자동 정리 — 손 안 대고 레시피 카드로 | 쏙튜브',
  description: '백종원·승우아빠·자취요리 유튜브 영상을 AI가 재료·조리 단계·팁으로 자동 정리합니다. 요리하면서 영상 멈추고 메모하는 번거로움을 없애드립니다.',
  keywords: ['유튜브 요리 영상 요약', '유튜브 레시피 정리', '요리 영상 자동 메모', '백종원 레시피 정리', '유튜브 요리 AI 요약', '요리 영상 자막 추출', '유튜브 요리 카테고리', '요리 영상 단계별 정리'],
}

export default function RecipeGuidePage() {
  return (
    <article className="flex flex-col gap-10 max-w-2xl">
      <div>
        <div className="flex items-center gap-2 text-[#75716e] text-xs mb-4">
          <Link href="/guide" className="hover:text-white transition-colors">사용설명서</Link>
          <span>›</span><span>영상 요약</span><span>›</span>
          <span className="text-white">요리 레시피</span>
        </div>
        <h1 className="text-2xl font-black text-white mb-3">🍳 유튜브 요리 영상, 손 안 대고 레시피 카드로</h1>
        <p className="text-[#a4a09c] text-sm leading-relaxed">
          요리 유튜브를 보면서 영상을 멈추고, 재료를 받아 적고, 다시 재생하는 번거로움을 경험해 보신 적 있으신가요? 쏙튜브의 <strong className="text-white">유튜브 요리 영상 AI 요약</strong> 기능은 영상 자막을 분석해 <strong className="text-white">재료 목록 · 조리 단계 · 핵심 팁</strong>을 카드 형식으로 자동 정리합니다. 백종원, 승우아빠, 자취요리 채널 등 어떤 요리 유튜브든 URL 하나로 레시피 카드가 완성됩니다.
        </p>
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="text-base font-bold text-white border-l-2 border-orange-500 pl-3">이런 분께 꼭 필요한 기능입니다</h2>
        <ul className="flex flex-col gap-2.5">
          {[
            '요리하면서 영상을 계속 멈춰가며 확인하는 게 번거로운 분',
            '레시피를 따로 메모장에 옮겨 적다가 나중에 찾기 힘든 분',
            '백종원·승우아빠·쿠킹하루 등 요리 유튜버 영상을 즐겨 보는 분',
            '재료만 쏙 뽑아서 장보기 목록으로 활용하고 싶은 분',
            '영상을 다시 처음부터 보지 않고 특정 단계만 빠르게 찾고 싶은 분',
            '요리 영상 라이브러리를 쌓아두고 요리별로 꺼내 쓰고 싶은 분',
          ].map(t => (
            <li key={t} className="flex items-start gap-2 text-[#a4a09c] text-sm">
              <span className="text-orange-400 mt-0.5 shrink-0">✓</span>{t}
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-base font-bold text-white border-l-2 border-orange-500 pl-3">유튜브 요리 영상 레시피 정리하는 방법</h2>
        <ol className="flex flex-col gap-3">
          {[
            { step: '1', title: '유튜브에서 요리 영상 URL 복사', desc: '보고 싶은 요리 영상의 주소를 복사합니다. PC에서는 주소창, 모바일에서는 공유 버튼을 눌러 링크를 복사하세요.' },
            { step: '2', title: '쏙튜브 메인에 URL 붙여넣기 + 🍳 요리 선택', desc: '분석 모드에서 요리 카테고리를 선택하면 요리에 특화된 구조(재료·단계·팁)로 정리됩니다. 자동 분류 모드도 요리 영상을 잘 인식합니다.' },
            { step: '3', title: 'Start Now 클릭 — AI가 자막 분석 시작', desc: 'AI가 영상 자막 전문을 분석해 재료 목록, 조리 단계별 설명, 핵심 팁, 예상 조리 시간을 카드 형식으로 정리합니다. 평균 20~40초 내 완성.' },
            { step: '4', title: '라이브러리에 저장 → 언제든 꺼내 보기', desc: '로그인 사용자는 요약 결과가 자동 저장됩니다. 마이페이지 → 요리 폴더에서 언제든 꺼내 볼 수 있어 레시피 모음집이 자동으로 만들어집니다.' },
          ].map(item => (
            <li key={item.step} className="flex gap-4 bg-[#32302e] rounded-2xl p-4">
              <span className="w-7 h-7 rounded-full bg-orange-500/20 text-orange-400 font-bold text-sm flex items-center justify-center shrink-0">{item.step}</span>
              <div>
                <p className="text-white font-semibold text-sm">{item.title}</p>
                <p className="text-[#75716e] text-xs mt-1 leading-relaxed">{item.desc}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="bg-[#32302e] rounded-2xl p-5 flex flex-col gap-3">
        <h2 className="text-base font-bold text-white">요약 결과에 포함되는 내용</h2>
        <ul className="grid grid-cols-2 gap-2.5 mt-1">
          {[
            ['🥬', '재료 목록 & 정확한 분량'],
            ['📝', '단계별 조리 방법 설명'],
            ['⏱', '조리 단계별 예상 시간'],
            ['💡', '셰프 팁 & 실패 방지 포인트'],
            ['🔄', '대체 재료 & 변형 레시피'],
            ['⭐', '난이도 & 전체 조리 시간'],
          ].map(([icon, label]) => (
            <li key={label as string} className="text-[#a4a09c] text-xs flex items-center gap-2">
              <span>{icon}</span>{label}
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-bold text-white border-l-2 border-orange-500 pl-3">지원하는 요리 유튜브 채널 유형</h2>
        <p className="text-[#a4a09c] text-sm leading-relaxed">
          자막이 제공되는 모든 유튜브 요리 채널을 지원합니다. <strong className="text-white">백종원의 요리비책, 승우아빠, 쿠킹하루, 자취요리신, 만개의레시피</strong> 채널은 물론, 해외 요리 채널(Gordon Ramsay, Tasty, Bon Appétit)도 영어 자막 기반으로 요약할 수 있습니다. 자동 생성 자막도 분석 가능합니다.
        </p>
        <div className="grid grid-cols-3 gap-2">
          {['한식 요리', '양식·파스타', '일식·스시', '중식 볶음', '베이킹·디저트', '다이어트 식단'].map(t => (
            <div key={t} className="bg-[#32302e] rounded-xl px-3 py-2 text-[#a4a09c] text-xs text-center">{t}</div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-bold text-white border-l-2 border-orange-500 pl-3">자주 묻는 질문</h2>
        <div className="flex flex-col gap-2">
          {[
            { q: '자막이 없는 요리 영상도 되나요?', a: 'YouTube 자동 생성 자막도 분석 가능합니다. 단, 자막이 전혀 없는 영상은 요약이 어렵습니다.' },
            { q: '요약된 레시피를 인쇄하거나 저장할 수 있나요?', a: '로그인 후 라이브러리에 저장하면 언제든 다시 볼 수 있습니다. 화면 캡처나 브라우저 인쇄 기능으로 출력도 가능합니다.' },
            { q: '영어 요리 채널 영상도 한국어로 요약되나요?', a: '영어 영상 감지 시 한국어 번역 요약과 원문 요약 중 선택할 수 있습니다.' },
          ].map(item => (
            <div key={item.q} className="bg-[#32302e] rounded-xl p-4">
              <p className="text-white text-sm font-semibold mb-1">Q. {item.q}</p>
              <p className="text-[#75716e] text-xs leading-relaxed">{item.a}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="flex items-center gap-3 pt-2 border-t border-white/5">
        <Link href="/" className="px-5 py-2.5 bg-orange-500 hover:bg-orange-400 text-white font-bold text-sm rounded-xl transition-colors">
          지금 요리 영상 요약하기
        </Link>
        <Link href="/guide/import" className="text-[#75716e] text-sm hover:text-white transition-colors">
          재생목록 일괄 요약 →
        </Link>
      </div>
    </article>
  )
}
