import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: '유튜브 요리 영상 레시피로 정리하기 — 쏙튜브',
  description: '백종원, 승우아빠 영상 보면서 레시피 따로 메모 안 해도 됩니다. 쏙튜브가 재료·조리 단계·팁을 카드로 자동 정리합니다.',
  keywords: ['유튜브 요리 요약', '유튜브 레시피 정리', '요리 영상 자동 메모', '유튜브 요리 AI 요약'],
}

export default function RecipeGuidePage() {
  return (
    <article className="flex flex-col gap-8 max-w-2xl">
      <div>
        <div className="flex items-center gap-2 text-[#75716e] text-xs mb-4">
          <Link href="/guide" className="hover:text-white transition-colors">사용설명서</Link>
          <span>›</span>
          <span>영상 요약</span>
          <span>›</span>
          <span className="text-white">요리 레시피</span>
        </div>
        <h1 className="text-2xl font-black text-white mb-3">🍳 요리 중에 손 안 대고 "다음 단계"만 외치세요</h1>
        <p className="text-[#a4a09c] text-sm leading-relaxed">
          요리 영상을 보면서 영상을 멈추고, 재료를 받아 적고, 다시 재생하는 번거로움. 쏙튜브가 요리 영상을 <strong className="text-white">재료 목록 · 조리 단계 · 핵심 팁</strong>으로 자동 정리합니다.
        </p>
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="text-base font-bold text-white">이런 분께 필요합니다</h2>
        <ul className="flex flex-col gap-2">
          {[
            '요리하면서 영상을 계속 멈춰가며 확인하는 게 번거로운 분',
            '레시피를 따로 메모했다가 나중에 찾기 힘든 분',
            '백종원, 승우아빠, 자취요리 채널 영상을 즐겨 보는 분',
            '요리 영상을 라이브러리에 저장해두고 필요할 때 꺼내 쓰고 싶은 분',
          ].map(t => (
            <li key={t} className="flex items-start gap-2 text-[#a4a09c] text-sm">
              <span className="text-orange-400 mt-0.5 shrink-0">✓</span>
              {t}
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-base font-bold text-white">사용 방법</h2>
        <ol className="flex flex-col gap-4">
          {[
            { step: '1', title: '유튜브에서 요리 영상 URL 복사', desc: '보고 싶은 요리 영상의 주소를 복사합니다.' },
            { step: '2', title: '쏙튜브 메인에 URL 붙여넣기', desc: '분석 모드에서 🍳 요리 카테고리를 선택하세요. 자동 분류도 요리 영상을 잘 인식합니다.' },
            { step: '3', title: 'Start Now 클릭', desc: 'AI가 영상 자막을 분석해 재료·단계·팁을 카드 형식으로 정리합니다.' },
            { step: '4', title: '라이브러리에 저장', desc: '로그인 유저는 요약 결과가 자동 저장됩니다. 나중에 마이페이지에서 언제든 꺼내 볼 수 있습니다.' },
          ].map(item => (
            <li key={item.step} className="flex gap-4 bg-[#32302e] rounded-2xl p-4">
              <span className="w-7 h-7 rounded-full bg-orange-500/20 text-orange-400 font-bold text-sm flex items-center justify-center shrink-0">{item.step}</span>
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
          {['재료 목록 & 분량', '조리 단계별 설명', '핵심 팁 & 주의사항', '예상 조리 시간', '난이도 정보', '대체 재료 안내'].map(t => (
            <li key={t} className="text-[#a4a09c] text-xs flex items-center gap-1.5">
              <span className="text-orange-400">✦</span>{t}
            </li>
          ))}
        </ul>
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
