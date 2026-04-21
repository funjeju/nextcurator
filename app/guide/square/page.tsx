import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: '스퀘어 — 유튜브 요약 공유 커뮤니티 — 쏙튜브',
  description: '내가 요약한 유튜브 영상을 스퀘어에 공유하고, 같은 영상을 본 다른 시청자의 해석을 발견하세요.',
  keywords: ['유튜브 요약 공유', '유튜브 커뮤니티', '영상 요약 피드', '쏙튜브 스퀘어'],
}

export default function SquareGuidePage() {
  return (
    <article className="flex flex-col gap-8 max-w-2xl">
      <div>
        <div className="flex items-center gap-2 text-[#75716e] text-xs mb-4">
          <Link href="/guide" className="hover:text-white transition-colors">사용설명서</Link>
          <span>›</span>
          <span className="text-white">스퀘어 활용법</span>
        </div>
        <h1 className="text-2xl font-black text-white mb-3">🌐 같은 영상, 다른 시청자의 해석까지 한눈에</h1>
        <p className="text-[#a4a09c] text-sm leading-relaxed">
          혼자 요약하고 끝내지 않아도 됩니다. 스퀘어는 쏙튜브 유저들이 <strong className="text-white">요약을 공유하고 발견하는</strong> 피드입니다. 같은 영상을 다른 관점으로 본 요약을 만날 수 있습니다.
        </p>
      </div>

      <section className="grid grid-cols-2 gap-3">
        {[
          { icon: '📤', title: '요약 공유', desc: '내 요약 결과를 스퀘어에 공개 게시' },
          { icon: '🔎', title: '발견', desc: '다른 유저가 요약한 유익한 영상 탐색' },
          { icon: '📌', title: '저장', desc: '마음에 드는 요약을 내 라이브러리에 복사' },
          { icon: '💬', title: '반응', desc: '요약에 댓글·공감으로 소통' },
        ].map(item => (
          <div key={item.title} className="bg-[#32302e] rounded-2xl p-4">
            <span className="text-2xl">{item.icon}</span>
            <p className="text-white font-semibold text-sm mt-2">{item.title}</p>
            <p className="text-[#75716e] text-xs mt-1">{item.desc}</p>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-bold text-white">공개 설정</h2>
        <div className="flex flex-col gap-2">
          {[
            { label: '🔒 비공개', desc: '나만 볼 수 있습니다 (기본값)' },
            { label: '👥 친구 공개', desc: '서로 팔로우한 친구만 볼 수 있습니다' },
            { label: '🌐 전체 공개', desc: '스퀘어 피드에 노출됩니다' },
          ].map(item => (
            <div key={item.label} className="flex items-center gap-3 bg-[#32302e] rounded-xl px-4 py-3">
              <span className="text-sm font-semibold text-white w-24 shrink-0">{item.label}</span>
              <span className="text-[#75716e] text-xs">{item.desc}</span>
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
