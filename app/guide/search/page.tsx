import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'AI 대화로 내 유튜브 라이브러리 검색 — 쏙튜브',
  description: '"저번에 본 동치미 영상 어디 갔지?" AI에게 물어보세요. 쏙튜브 라이브러리를 자연어로 검색합니다.',
  keywords: ['유튜브 저장 영상 검색', 'AI 라이브러리 검색', '유튜브 기록 찾기', '자연어 영상 검색'],
}

export default function SearchGuidePage() {
  return (
    <article className="flex flex-col gap-8 max-w-2xl">
      <div>
        <div className="flex items-center gap-2 text-[#75716e] text-xs mb-4">
          <Link href="/guide" className="hover:text-white transition-colors">사용설명서</Link>
          <span>›</span>
          <span className="text-white">AI 대화 검색</span>
        </div>
        <h1 className="text-2xl font-black text-white mb-3">🔍 "저번에 본 동치미 영상 어디 갔지?"</h1>
        <p className="text-[#a4a09c] text-sm leading-relaxed">
          라이브러리에 영상이 쌓일수록 원하는 내용을 찾기 어려워집니다. 쏙튜브의 AI 채팅으로 <strong className="text-white">자연어로 질문</strong>하면 관련 요약을 바로 찾아드립니다.
        </p>
      </div>

      <section className="bg-[#1c1a18] border border-white/5 rounded-2xl p-5">
        <p className="text-[#75716e] text-xs mb-3">이런 질문이 가능합니다</p>
        <ul className="flex flex-col gap-2">
          {[
            '"동치미 담그는 법 나왔던 영상 찾아줘"',
            '"지난달에 본 재테크 영상 요약 보여줘"',
            '"일본 여행 관련 저장한 거 다 보여줘"',
            '"영어 공부 영상 중에 단어 정리된 거"',
          ].map(q => (
            <li key={q} className="text-[#a4a09c] text-sm bg-[#32302e] rounded-xl px-4 py-2.5">{q}</li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-bold text-white">사용 방법</h2>
        <ol className="flex flex-col gap-3">
          {[
            { step: '1', title: '마이페이지 채팅 아이콘 클릭', desc: '우측 하단 떠있는 채팅 버튼 또는 마이페이지 내 AI 검색 탭을 엽니다.' },
            { step: '2', title: '자연어로 질문', desc: '검색 키워드가 아닌 문장으로 물어보세요. AI가 내 라이브러리에서 관련 요약을 찾아줍니다.' },
            { step: '3', title: '결과 바로 이동', desc: '찾은 요약 카드를 클릭하면 전체 요약 결과 페이지로 이동합니다.' },
          ].map(item => (
            <li key={item.step} className="flex gap-4 bg-[#32302e] rounded-2xl p-4">
              <span className="w-7 h-7 rounded-full bg-cyan-500/20 text-cyan-400 font-bold text-sm flex items-center justify-center shrink-0">{item.step}</span>
              <div>
                <p className="text-white font-semibold text-sm">{item.title}</p>
                <p className="text-[#75716e] text-xs mt-1">{item.desc}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <div className="flex items-center gap-3 pt-2 border-t border-white/5">
        <Link href="/mypage" className="px-5 py-2.5 bg-cyan-700 hover:bg-cyan-600 text-white font-bold text-sm rounded-xl transition-colors">
          라이브러리 검색하기
        </Link>
        <Link href="/guide/square" className="text-[#75716e] text-sm hover:text-white transition-colors">
          스퀘어 활용법 →
        </Link>
      </div>
    </article>
  )
}
