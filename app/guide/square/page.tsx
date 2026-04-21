import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: '스퀘어 — 유튜브 요약 공유 커뮤니티 · 같은 영상 다른 시각 발견 | 쏙튜브',
  description: '내가 요약한 유튜브 영상을 스퀘어에 공유하고 다른 시청자의 해석을 발견하세요. 유튜브 요약 커뮤니티에서 좋은 영상과 인사이트를 함께 나눕니다.',
  keywords: ['유튜브 요약 공유', '유튜브 커뮤니티', '영상 요약 피드', '쏙튜브 스퀘어', '유튜브 인사이트 공유', '영상 요약 SNS', '유튜브 요약 피드', '유튜브 지식 공유', '영상 정보 공유 앱', '유튜브 스터디 커뮤니티', '유튜브 리뷰 공유', '영상 요약 소셜'],
}

export default function SquareGuidePage() {
  return (
    <article className="flex flex-col gap-10 max-w-2xl">
      <div>
        <div className="flex items-center gap-2 text-[#75716e] text-xs mb-4">
          <Link href="/guide" className="hover:text-white transition-colors">사용설명서</Link>
          <span>›</span>
          <span className="text-white">스퀘어 활용법</span>
        </div>
        <h1 className="text-2xl font-black text-white mb-3">🌐 같은 영상, 다른 시청자의 해석까지 한눈에</h1>
        <p className="text-[#a4a09c] text-sm leading-relaxed">
          유익한 유튜브 영상을 혼자만 보고 끝내기엔 아깝습니다. <strong className="text-white">스퀘어</strong>는 쏙튜브 유저들이 자신의 요약을 공개 피드에 올리고, 다른 시청자가 같은 영상을 어떻게 해석했는지 발견하는 공간입니다. 내가 놓친 관점, 더 깊은 분석, 다른 카테고리로 요약된 결과를 만날 수 있습니다. 유튜브 인사이트를 혼자 소비하지 말고 커뮤니티와 함께 나누세요.
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-bold text-white border-l-2 border-amber-500 pl-3">스퀘어에서 할 수 있는 것들</h2>
        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: '📤', title: '요약 공유', desc: '내 요약 결과를 스퀘어에 공개 게시해 다른 사람에게 유익한 정보를 나눕니다.' },
            { icon: '🔎', title: '발견', desc: '다른 유저가 요약한 유익한 영상을 피드에서 탐색합니다. 관심 분야 영상을 새롭게 발견할 수 있습니다.' },
            { icon: '📌', title: '저장', desc: '마음에 드는 요약을 내 라이브러리에 복사합니다. 직접 요약하지 않아도 좋은 요약을 내 것으로 가질 수 있습니다.' },
            { icon: '💬', title: '소통', desc: '요약에 댓글·공감으로 반응하고, 같은 영상을 본 사람들과 의견을 나눕니다.' },
          ].map(item => (
            <div key={item.title} className="bg-[#32302e] rounded-2xl p-4">
              <span className="text-2xl">{item.icon}</span>
              <p className="text-white font-semibold text-sm mt-2">{item.title}</p>
              <p className="text-[#75716e] text-xs mt-1 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-base font-bold text-white border-l-2 border-amber-500 pl-3">스퀘어 활용 시나리오</h2>
        <div className="flex flex-col gap-3">
          {[
            { icon: '📚', title: '스터디 그룹 요약 공유', desc: '같은 강의나 책 관련 유튜브를 스터디원끼리 공유해 각자의 요약을 비교합니다. 서로 다른 핵심 포인트를 발견할 수 있습니다.' },
            { icon: '💡', title: '인사이트 피드로 활용', desc: '스퀘어 피드를 구독하면 내가 보지 않은 유익한 영상들의 요약을 매일 읽을 수 있습니다. 추천 알고리즘 대신 사람이 큐레이션한 콘텐츠.' },
            { icon: '🤝', title: '비슷한 관심사 유저 발견', desc: '여행·요리·재테크·영어 등 같은 카테고리를 요약하는 유저를 팔로우하면 관심 분야 인사이트가 자동으로 쌓입니다.' },
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
        <h2 className="text-base font-bold text-white border-l-2 border-amber-500 pl-3">공개 범위 설정</h2>
        <div className="flex flex-col gap-2">
          {[
            { label: '🔒 비공개', desc: '나만 볼 수 있습니다. 개인 메모·공부용으로 저장할 때 사용합니다. (기본값)' },
            { label: '👥 친구 공개', desc: '서로 팔로우한 친구만 볼 수 있습니다. 소규모 스터디 그룹 공유에 적합합니다.' },
            { label: '🌐 전체 공개', desc: '스퀘어 피드에 노출됩니다. 유익한 요약을 더 많은 사람과 나누고 싶을 때 선택하세요.' },
          ].map(item => (
            <div key={item.label} className="flex items-start gap-3 bg-[#32302e] rounded-xl px-4 py-3">
              <span className="text-sm font-semibold text-white w-24 shrink-0">{item.label}</span>
              <span className="text-[#75716e] text-xs leading-relaxed">{item.desc}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-[#32302e] rounded-2xl p-5 flex flex-col gap-3">
        <h2 className="text-base font-bold text-white">스퀘어에서 인기 있는 요약 카테고리</h2>
        <div className="grid grid-cols-3 gap-2">
          {['재테크·주식', '영어 학습', '여행 정보', '요리 레시피', '자기계발', '뉴스·시사', '건강·운동', '기술·IT', '역사·교양'].map(t => (
            <div key={t} className="bg-[#1c1a18] rounded-xl px-3 py-2 text-[#a4a09c] text-xs text-center">{t}</div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-bold text-white border-l-2 border-amber-500 pl-3">자주 묻는 질문</h2>
        <div className="flex flex-col gap-2">
          {[
            { q: '다른 사람의 요약을 내 라이브러리에 저장하면 원본 영상도 요약되나요?', a: '저장 시 해당 요약 내용이 내 라이브러리에 복사됩니다. 직접 영상을 다시 요약할 필요 없이 바로 활용할 수 있습니다.' },
            { q: '공개 범위는 나중에 변경할 수 있나요?', a: '요약 결과 페이지에서 언제든지 공개 범위를 비공개·친구·전체로 변경할 수 있습니다.' },
          ].map(item => (
            <div key={item.q} className="bg-[#32302e] rounded-xl p-4">
              <p className="text-white text-sm font-semibold mb-1">Q. {item.q}</p>
              <p className="text-[#75716e] text-xs leading-relaxed">{item.a}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="flex items-center gap-3 pt-2 border-t border-white/5">
        <Link href="/square" className="px-5 py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-bold text-sm rounded-xl transition-colors">
          스퀘어 둘러보기
        </Link>
        <Link href="/guide/classroom" className="text-[#75716e] text-sm hover:text-white transition-colors">
          클래스룸 →
        </Link>
      </div>
    </article>
  )
}
