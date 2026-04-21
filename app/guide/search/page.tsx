import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'AI 대화로 유튜브 요약 라이브러리 검색 — "저번에 본 그 영상" 바로 찾기 | 쏙튜브',
  description: '"지난달에 본 재테크 영상 어디 갔지?" AI에게 자연어로 물어보면 내 유튜브 라이브러리에서 관련 요약을 즉시 찾아줍니다. 키워드 없이도 기억 속 영상을 찾는 AI 검색.',
  keywords: ['유튜브 저장 영상 검색', 'AI 라이브러리 검색', '유튜브 기록 찾기', '자연어 영상 검색', '유튜브 요약 검색', '내 유튜브 기록 검색', '저장한 유튜브 찾기', 'AI 채팅 검색', '유튜브 본 영상 다시 찾기', '유튜브 시청 기록 검색', '쏙튜브 AI 검색', '영상 내용으로 검색'],
}

export default function SearchGuidePage() {
  return (
    <article className="flex flex-col gap-10 max-w-2xl">
      <div>
        <div className="flex items-center gap-2 text-[#75716e] text-xs mb-4">
          <Link href="/guide" className="hover:text-white transition-colors">사용설명서</Link>
          <span>›</span>
          <span className="text-white">AI 대화 검색</span>
        </div>
        <h1 className="text-2xl font-black text-white mb-3">🔍 "저번에 본 그 동치미 영상 어디 갔지?" AI에게 물어보세요</h1>
        <p className="text-[#a4a09c] text-sm leading-relaxed">
          라이브러리에 영상이 100개, 200개 쌓이면 원하는 내용을 스크롤로 찾는 건 불가능합니다. 쏙튜브의 <strong className="text-white">AI 대화 검색</strong>은 키워드 없이 기억에 의존해 물어봐도 됩니다. "지난달에 본 일본 여행 영상", "영어 단어 정리된 TED 요약", "삼프로TV에서 본 금리 영상" — 이런 문장 그대로 입력하면 관련 요약을 찾아줍니다. 내 유튜브 시청 기록과 저장 요약을 AI가 기억해주는 개인 어시스턴트입니다.
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-bold text-white border-l-2 border-cyan-500 pl-3">이런 상황에서 특히 유용합니다</h2>
        <ul className="flex flex-col gap-2">
          {[
            '요약을 100개 이상 저장해서 스크롤로 찾기 어려울 때',
            '제목은 기억 안 나는데 내용의 일부만 기억날 때',
            '특정 주제(여행·영어·재테크)로 저장된 영상을 묶어서 보고 싶을 때',
            '요약 카테고리와 날짜가 혼재되어 찾기 번거로울 때',
            '특정 채널(삼프로TV, 신사임당 등)의 요약만 모아보고 싶을 때',
          ].map(t => (
            <li key={t} className="flex items-start gap-2 text-[#a4a09c] text-sm">
              <span className="text-cyan-400 mt-0.5 shrink-0">✓</span>{t}
            </li>
          ))}
        </ul>
      </section>

      <section className="bg-[#1c1a18] border border-white/5 rounded-2xl p-5">
        <p className="text-[#75716e] text-xs mb-3">이런 질문이 가능합니다</p>
        <ul className="flex flex-col gap-2">
          {[
            '"동치미 담그는 법 나왔던 영상 찾아줘"',
            '"지난달에 본 재테크 영상 요약 보여줘"',
            '"일본 여행 관련 저장한 거 다 보여줘"',
            '"영어 공부 영상 중에 단어 정리된 거"',
            '"삼프로TV에서 금리 얘기한 영상 있었는데"',
            '"운동 관련 영상 중 가장 최근에 저장한 거"',
          ].map(q => (
            <li key={q} className="text-[#a4a09c] text-sm bg-[#32302e] rounded-xl px-4 py-2.5">{q}</li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-base font-bold text-white border-l-2 border-cyan-500 pl-3">AI 검색 사용 방법</h2>
        <ol className="flex flex-col gap-3">
          {[
            { step: '1', title: '마이페이지 → AI 검색 탭 열기', desc: '마이페이지 상단 탭에서 "AI 검색" 또는 화면 우측 하단 채팅 버튼을 클릭합니다.' },
            { step: '2', title: '기억나는 대로 문장으로 질문', desc: '검색 키워드가 아닌 대화체 문장으로 물어보세요. "저번에 본", "~에 대한 내용", "~채널 영상" 같은 맥락 힌트를 포함하면 더 정확합니다.' },
            { step: '3', title: 'AI가 라이브러리에서 관련 요약 목록 제시', desc: '내 저장 요약 전체를 검색해 관련도 높은 순서로 결과를 보여줍니다. 여러 개가 매칭되면 한꺼번에 카드 형식으로 표시됩니다.' },
            { step: '4', title: '결과 카드 클릭 → 전체 요약 바로 이동', desc: '검색 결과 카드를 클릭하면 해당 영상의 전체 요약 결과 페이지로 즉시 이동합니다.' },
          ].map(item => (
            <li key={item.step} className="flex gap-4 bg-[#32302e] rounded-2xl p-4">
              <span className="w-7 h-7 rounded-full bg-cyan-500/20 text-cyan-400 font-bold text-sm flex items-center justify-center shrink-0">{item.step}</span>
              <div>
                <p className="text-white font-semibold text-sm">{item.title}</p>
                <p className="text-[#75716e] text-xs mt-1 leading-relaxed">{item.desc}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="bg-[#32302e] rounded-2xl p-5 flex flex-col gap-3">
        <h2 className="text-base font-bold text-white">AI 검색이 찾아주는 것들</h2>
        <ul className="grid grid-cols-2 gap-2.5">
          {[
            ['📅', '날짜·기간으로 필터링'],
            ['🏷️', '카테고리별 묶어보기'],
            ['📺', '채널명으로 검색'],
            ['🔑', '내용 키워드 검색'],
            ['📍', '여행 장소명 검색'],
            ['👤', '영상 출연자·인물'],
          ].map(([icon, label]) => (
            <li key={label as string} className="text-[#a4a09c] text-xs flex items-center gap-2">
              <span>{icon}</span>{label}
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-bold text-white border-l-2 border-cyan-500 pl-3">자주 묻는 질문</h2>
        <div className="flex flex-col gap-2">
          {[
            { q: 'AI 검색을 사용하면 비용이 발생하나요?', a: 'AI 검색은 내 라이브러리 내에서만 동작합니다. 기본 검색은 무료이며, AI가 답변을 생성하는 경우 크레딧이 소모될 수 있습니다.' },
            { q: '요약하지 않은 영상도 검색되나요?', a: '쏙튜브로 요약·저장한 영상만 검색 대상입니다. 요약한 영상이 많을수록 검색 정확도가 높아집니다.' },
          ].map(item => (
            <div key={item.q} className="bg-[#32302e] rounded-xl p-4">
              <p className="text-white text-sm font-semibold mb-1">Q. {item.q}</p>
              <p className="text-[#75716e] text-xs leading-relaxed">{item.a}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="flex items-center gap-3 pt-2 border-t border-white/5">
        <Link href="/mypage" className="px-5 py-2.5 bg-cyan-700 hover:bg-cyan-600 text-white font-bold text-sm rounded-xl transition-colors">
          라이브러리 AI 검색하기
        </Link>
        <Link href="/guide/square" className="text-[#75716e] text-sm hover:text-white transition-colors">
          스퀘어 활용법 →
        </Link>
      </div>
    </article>
  )
}
