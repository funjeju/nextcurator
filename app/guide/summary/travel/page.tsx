import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: '유튜브 여행 영상에서 일정 · 스팟 자동 추출 — 쏙튜브',
  description: '여행 vlog를 보면서 장소 따로 메모 안 해도 됩니다. 쏙튜브가 방문 스팟·이동 루트·팁을 자동으로 일정표 형식으로 정리합니다.',
  keywords: ['유튜브 여행 요약', '여행 vlog 정리', '유튜브 여행 일정표', '여행 영상 스팟 추출'],
}

export default function TravelGuidePage() {
  return (
    <article className="flex flex-col gap-8 max-w-2xl">
      <div>
        <div className="flex items-center gap-2 text-[#75716e] text-xs mb-4">
          <Link href="/guide" className="hover:text-white transition-colors">사용설명서</Link>
          <span>›</span><span>영상 요약</span><span>›</span>
          <span className="text-white">여행 스팟 추출</span>
        </div>
        <h1 className="text-2xl font-black text-white mb-3">🧳 여행 vlog 속 스팟을 AI가 일정표로</h1>
        <p className="text-[#a4a09c] text-sm leading-relaxed">
          여행 유튜브를 보면서 좋은 장소를 발견해도 나중에 기억이 안 납니다. 쏙튜브가 여행 영상에서 <strong className="text-white">방문 장소 · 이동 루트 · 실용 팁</strong>을 자동으로 뽑아냅니다.
        </p>
      </div>

      <section className="bg-[#32302e] rounded-2xl p-5 flex flex-col gap-3">
        <h2 className="text-base font-bold text-white">추출되는 정보</h2>
        <ul className="grid grid-cols-2 gap-2">
          {[
            '방문 장소 목록', '이동 순서 & 루트', '숙소 정보 & 가격대',
            '맛집 추천 & 메뉴', '교통 이동 방법', '예산 & 비용 정보',
            '주의사항 & 꿀팁', '최적 방문 시기',
          ].map(t => (
            <li key={t} className="text-[#a4a09c] text-xs flex items-center gap-1.5">
              <span className="text-emerald-400">✦</span>{t}
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-base font-bold text-white">활용 시나리오</h2>
        <div className="flex flex-col gap-3">
          {[
            { icon: '🇯🇵', title: '일본 여행 준비', desc: '도쿄·오사카 vlog 10개를 한번에 정리해 나만의 일정표 완성' },
            { icon: '🏖️', title: '국내 여행 코스', desc: '제주·부산·경주 여행 영상에서 핵심 스팟만 쏙쏙 추출' },
            { icon: '✈️', title: '배낭여행 계획', desc: '유럽·동남아 배낭여행 경험담에서 실용 정보만 모아서 저장' },
          ].map(item => (
            <div key={item.title} className="flex gap-3 bg-[#32302e] rounded-2xl p-4">
              <span className="text-2xl">{item.icon}</span>
              <div>
                <p className="text-white font-semibold text-sm">{item.title}</p>
                <p className="text-[#75716e] text-xs mt-1">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="flex items-center gap-3 pt-2 border-t border-white/5">
        <Link href="/" className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm rounded-xl transition-colors">
          여행 영상 요약하기
        </Link>
        <Link href="/guide/import" className="text-[#75716e] text-sm hover:text-white transition-colors">
          재생목록 일괄 요약 →
        </Link>
      </div>
    </article>
  )
}
