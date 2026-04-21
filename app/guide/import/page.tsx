import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'YouTube 재생목록 AI 일괄 요약하기 — 쏙튜브',
  description: 'Watch Later에 쌓인 영상, 저장해둔 재생목록을 쏙튜브로 가져와 AI로 한번에 정리하세요. YouTube 재생목록 연동 방법 안내.',
  keywords: ['유튜브 재생목록 요약', 'Watch Later 정리', '유튜브 저장 영상 요약', '유튜브 재생목록 가져오기'],
}

export default function ImportGuidePage() {
  return (
    <article className="flex flex-col gap-8 max-w-2xl">
      <div>
        <div className="flex items-center gap-2 text-[#75716e] text-xs mb-4">
          <Link href="/guide" className="hover:text-white transition-colors">사용설명서</Link>
          <span>›</span>
          <span className="text-white">재생목록 가져오기</span>
        </div>
        <h1 className="text-2xl font-black text-white mb-3">📋 Watch Later 500개, 하룻밤에 다 정리</h1>
        <p className="text-[#a4a09c] text-sm leading-relaxed">
          "나중에 봐야지" 하고 저장만 해둔 영상들, 이제 쏙튜브로 가져와서 AI가 하나하나 요약해드립니다. 재생목록 단위로 폴더처럼 관리할 수 있습니다.
        </p>
      </div>

      <section className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4">
        <p className="text-amber-300 text-xs font-semibold mb-1">📌 YouTube 정책 안내</p>
        <p className="text-[#a4a09c] text-xs leading-relaxed">
          YouTube 보안 정책상 연동 인증은 브라우저 세션마다 재인증이 필요합니다. 단, <strong className="text-white">한 번 가져온 재생목록 데이터는 쏙튜브 라이브러리에 저장</strong>되어 언제든 확인할 수 있습니다.
        </p>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-base font-bold text-white">연동 방법</h2>
        <ol className="flex flex-col gap-3">
          {[
            { step: '1', title: '마이페이지 → 가져오기 탭', desc: '로그인 후 마이페이지 상단 탭에서 "가져오기"를 선택합니다.' },
            { step: '2', title: 'YouTube 연동하기 클릭', desc: 'Google 계정으로 YouTube 재생목록 읽기 권한을 허용합니다. 읽기 권한만 요청하며 영상 수정·삭제는 절대 하지 않습니다.' },
            { step: '3', title: '재생목록 선택', desc: '내 YouTube 재생목록이 폴더 형식으로 표시됩니다. 원하는 재생목록을 선택하면 영상 목록이 나타납니다.' },
            { step: '4', title: 'AI 요약하기', desc: '각 영상 카드의 "AI 요약하기" 버튼을 눌러 요약을 시작합니다. 요약 완료된 영상은 ✓ 요약완료로 표시됩니다.' },
          ].map(item => (
            <li key={item.step} className="flex gap-4 bg-[#32302e] rounded-2xl p-4">
              <span className="w-7 h-7 rounded-full bg-red-500/20 text-red-400 font-bold text-sm flex items-center justify-center shrink-0">{item.step}</span>
              <div>
                <p className="text-white font-semibold text-sm">{item.title}</p>
                <p className="text-[#75716e] text-xs mt-1">{item.desc}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-bold text-white">재동기화 (NEW 기능)</h2>
        <p className="text-[#a4a09c] text-sm leading-relaxed">
          "재동기화" 버튼을 누르면 이전에 저장된 재생목록과 비교해 새로 추가된 영상이 있는 폴더에 <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">NEW</span> 뱃지가 표시됩니다. 새 영상만 골라 요약할 수 있습니다.
        </p>
      </section>

      <div className="flex items-center gap-3 pt-2 border-t border-white/5">
        <Link href="/mypage" className="px-5 py-2.5 bg-red-500 hover:bg-red-400 text-white font-bold text-sm rounded-xl transition-colors">
          마이페이지에서 연동하기
        </Link>
        <Link href="/guide/blog" className="text-[#75716e] text-sm hover:text-white transition-colors">
          블로그 초안 생성 →
        </Link>
      </div>
    </article>
  )
}
