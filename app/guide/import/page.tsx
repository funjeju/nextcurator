import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'YouTube 재생목록 AI 일괄 요약 — Watch Later 정리법 | 쏙튜브',
  description: 'YouTube 재생목록·Watch Later에 쌓인 영상을 쏙튜브로 가져와 AI로 한번에 정리하세요. 나중에 볼 영상 500개, 하룻밤에 정리 가능합니다.',
  keywords: ['유튜브 재생목록 요약', 'Watch Later 정리', '유튜브 저장 영상 요약', '유튜브 재생목록 가져오기', '유튜브 나중에볼 영상 정리', '유튜브 플레이리스트 요약', '유튜브 영상 일괄 정리', 'YouTube 재생목록 AI', '유튜브 저장목록 정리 앱'],
}

export default function ImportGuidePage() {
  return (
    <article className="flex flex-col gap-10 max-w-2xl">
      <div>
        <div className="flex items-center gap-2 text-[#75716e] text-xs mb-4">
          <Link href="/guide" className="hover:text-white transition-colors">사용설명서</Link>
          <span>›</span>
          <span className="text-white">재생목록 가져오기</span>
        </div>
        <h1 className="text-2xl font-black text-white mb-3">📋 YouTube 재생목록 AI 일괄 요약 — Watch Later 500개 정리</h1>
        <p className="text-[#a4a09c] text-sm leading-relaxed">
          "나중에 봐야지" 하고 저장만 해둔 YouTube 영상들이 수백 개 쌓여 있지 않으신가요? 쏙튜브의 <strong className="text-white">YouTube 재생목록 가져오기</strong> 기능으로 내 재생목록을 연동하면, AI가 각 영상을 요약해 폴더별로 정리해드립니다. 요약 완료된 영상은 별도로 표시되어 관리도 편리합니다.
        </p>
      </div>

      <section className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4">
        <p className="text-amber-300 text-xs font-semibold mb-1">📌 YouTube 보안 정책 안내</p>
        <p className="text-[#a4a09c] text-xs leading-relaxed">
          YouTube 보안 정책상 재생목록 연동 인증은 브라우저 세션마다 재인증이 필요합니다. 단, <strong className="text-white">한 번 가져온 재생목록 데이터는 쏙튜브 서버에 저장</strong>되어 재인증 없이 언제든 확인할 수 있습니다. <strong className="text-white">읽기 전용 권한만 요청</strong>하며 재생목록 수정·삭제는 절대 하지 않습니다.
        </p>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-base font-bold text-white border-l-2 border-red-500 pl-3">YouTube 재생목록 가져오는 방법</h2>
        <ol className="flex flex-col gap-3">
          {[
            { step: '1', title: '마이페이지 → 가져오기 탭 이동', desc: '로그인 후 마이페이지 상단 탭에서 "가져오기"를 선택합니다. 기존에 저장된 재생목록이 있으면 바로 표시됩니다.' },
            { step: '2', title: 'YouTube 연동하기 클릭 → Google 인증', desc: 'Google 계정으로 YouTube 재생목록 읽기 권한을 허용합니다. 처음 연동 시 Google 보안 확인 화면이 나올 수 있습니다 — 고급 설정에서 계속 진행하세요.' },
            { step: '3', title: '재생목록 선택 → 영상 목록 확인', desc: '내 YouTube 재생목록이 폴더 형식으로 표시됩니다. 원하는 재생목록을 클릭하면 포함된 영상 목록이 나타납니다.' },
            { step: '4', title: '각 영상 AI 요약하기', desc: '"AI 요약하기" 버튼을 누르면 해당 영상의 요약 페이지로 이동합니다. 요약이 완료된 영상은 ✓ 요약완료 뱃지로 구분됩니다.' },
          ].map(item => (
            <li key={item.step} className="flex gap-4 bg-[#32302e] rounded-2xl p-4">
              <span className="w-7 h-7 rounded-full bg-red-500/20 text-red-400 font-bold text-sm flex items-center justify-center shrink-0">{item.step}</span>
              <div>
                <p className="text-white font-semibold text-sm">{item.title}</p>
                <p className="text-[#75716e] text-xs mt-1 leading-relaxed">{item.desc}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-bold text-white border-l-2 border-red-500 pl-3">재동기화 — 새로 추가된 영상만 골라 요약</h2>
        <p className="text-[#a4a09c] text-sm leading-relaxed">
          "재동기화" 버튼을 누르면 이전에 저장된 재생목록과 비교해 <strong className="text-white">새로 추가된 영상이 있는 재생목록에 <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">NEW</span> 뱃지</strong>가 표시됩니다. 이미 요약된 영상은 건너뛰고 새 영상만 골라 요약할 수 있어 효율적으로 관리됩니다.
        </p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: '✅', label: '요약완료 영상', desc: '초록 뱃지 표시 — 이미 요약 완료' },
            { icon: '🆕', label: 'NEW 영상', desc: '빨간 뱃지 표시 — 새로 추가된 영상' },
          ].map(item => (
            <div key={item.label} className="bg-[#32302e] rounded-xl p-3">
              <p className="text-white text-sm font-semibold">{item.icon} {item.label}</p>
              <p className="text-[#75716e] text-xs mt-1">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-bold text-white border-l-2 border-red-500 pl-3">이런 재생목록 관리에 유용합니다</h2>
        <div className="flex flex-col gap-2">
          {[
            '나중에볼 영상(Watch Later)이 500개 이상 쌓인 분',
            '주제별 재생목록(요리·영어·경제·여행)을 만들어 둔 분',
            '좋아요 누른 영상을 체계적으로 정리하고 싶은 분',
            '구독 채널의 신규 영상을 자동으로 요약·저장하고 싶은 분',
          ].map(t => (
            <div key={t} className="flex items-center gap-2 bg-[#32302e] rounded-xl px-4 py-2.5 text-[#a4a09c] text-xs">
              <span className="text-red-400 shrink-0">✓</span>{t}
            </div>
          ))}
        </div>
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
