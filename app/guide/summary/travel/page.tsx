import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: '유튜브 여행 영상에서 일정·스팟·맛집 자동 추출 — 여행 vlog 정리 | 쏙튜브',
  description: '여행 vlog 보면서 장소 메모 안 해도 됩니다. 쏙튜브가 방문 스팟·이동 루트·숙소·맛집 정보를 일정표 형식으로 자동 추출합니다.',
  keywords: ['유튜브 여행 영상 요약', '여행 vlog 정리', '유튜브 여행 일정표', '여행 영상 스팟 추출', '유튜브 일본 여행 정리', '여행 유튜브 맛집 추출', '여행 브이로그 자동 정리', '해외여행 유튜브 요약', '국내 여행 유튜브 정리', '여행 코스 자동 생성'],
}

export default function TravelGuidePage() {
  return (
    <article className="flex flex-col gap-10 max-w-2xl">
      <div>
        <div className="flex items-center gap-2 text-[#75716e] text-xs mb-4">
          <Link href="/guide" className="hover:text-white transition-colors">사용설명서</Link>
          <span>›</span><span>영상 요약</span><span>›</span>
          <span className="text-white">여행 스팟 추출</span>
        </div>
        <h1 className="text-2xl font-black text-white mb-3">🧳 여행 vlog 속 스팟·맛집·일정을 AI가 자동 정리</h1>
        <p className="text-[#a4a09c] text-sm leading-relaxed">
          여행 유튜브를 보면서 좋은 장소를 발견해도 나중에 기억이 안 납니다. 쏙튜브는 여행 vlog에서 <strong className="text-white">방문 장소 · 이동 루트 · 숙소 정보 · 맛집 추천 · 실용 팁</strong>을 자동으로 뽑아내 일정표 형식으로 정리합니다. 일본 여행 준비, 제주 코스, 유럽 배낭 여행까지 — 보기만 했던 vlog가 실제 여행 가이드북이 됩니다.
        </p>
      </div>

      <section className="bg-[#32302e] rounded-2xl p-5 flex flex-col gap-3">
        <h2 className="text-base font-bold text-white">여행 영상에서 추출되는 정보</h2>
        <ul className="grid grid-cols-2 gap-2.5">
          {[
            ['📍', '방문 장소 & 주소 정보'],
            ['🗺', '이동 순서 & 동선'],
            ['🏨', '숙소 정보 & 가격대'],
            ['🍜', '맛집 & 추천 메뉴'],
            ['🚌', '교통 이동 방법'],
            ['💰', '예산 & 비용 정보'],
            ['⚠️', '주의사항 & 꿀팁'],
            ['📅', '최적 방문 시기'],
          ].map(([icon, label]) => (
            <li key={label as string} className="text-[#a4a09c] text-xs flex items-center gap-2">
              <span>{icon}</span>{label}
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-base font-bold text-white border-l-2 border-emerald-500 pl-3">여행 vlog 정리 방법</h2>
        <ol className="flex flex-col gap-3">
          {[
            { step: '1', title: '여행 유튜브 URL 복사', desc: 'YouTube에서 보고 싶은 여행 vlog, 여행 코스 영상, 맛집 탐방 영상의 URL을 복사합니다.' },
            { step: '2', title: '🧳 여행 카테고리 선택', desc: '여행 카테고리를 선택하면 장소·동선·팁에 최적화된 구조로 정리됩니다. AI가 영상 자막을 분석해 지명·식당명·숙소명을 자동으로 인식합니다.' },
            { step: '3', title: 'AI가 일정표 형식으로 자동 정리', desc: '방문 순서대로 장소를 나열하고, 각 장소별 소요 시간·이동 방법·팁을 정리합니다. 맛집은 메뉴·가격 정보까지 추출됩니다.' },
            { step: '4', title: '여행 위시리스트에 저장', desc: '마이페이지 여행 탭에 저장하면 나중에 실제 여행 시 꺼내볼 수 있습니다. 여러 영상을 쌓아두면 나만의 여행 가이드북이 완성됩니다.' },
          ].map(item => (
            <li key={item.step} className="flex gap-4 bg-[#32302e] rounded-2xl p-4">
              <span className="w-7 h-7 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-sm flex items-center justify-center shrink-0">{item.step}</span>
              <div>
                <p className="text-white font-semibold text-sm">{item.title}</p>
                <p className="text-[#75716e] text-xs mt-1 leading-relaxed">{item.desc}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-base font-bold text-white border-l-2 border-emerald-500 pl-3">여행 유형별 활용 시나리오</h2>
        <div className="flex flex-col gap-3">
          {[
            { icon: '🇯🇵', title: '일본 여행 준비', desc: '도쿄·오사카·교토 여행 vlog 10개를 쏙튜브로 요약하면 핵심 스팟과 이동 동선이 자동으로 정리됩니다. 일본 여행 일정 짤 때 유용합니다.' },
            { icon: '🏝', title: '제주·부산 국내 여행 코스', desc: '제주 올레길, 부산 맛집 투어, 경주 역사 여행 등 국내 여행 vlog에서 코스별 장소를 추출해 나만의 국내 여행 코스를 만드세요.' },
            { icon: '✈️', title: '유럽·동남아 배낭여행 계획', desc: '유럽 배낭여행, 베트남·태국 여행 브이로그에서 실용적인 예산·이동·숙소 정보를 모아 자신만의 배낭여행 가이드를 만들 수 있습니다.' },
            { icon: '🍽', title: '맛집 탐방 & 식도락 여행', desc: '맛집 탐방 유튜브에서 가게명·메뉴·가격·웨이팅 팁을 자동 추출합니다. 내 취향 맛집 리스트를 라이브러리로 관리하세요.' },
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
        <h2 className="text-base font-bold text-white border-l-2 border-emerald-500 pl-3">자주 묻는 질문</h2>
        <div className="flex flex-col gap-2">
          {[
            { q: '해외 여행 영상 (영어·일본어)도 한국어로 정리되나요?', a: '영어 영상은 한국어 번역 요약을 선택하면 됩니다. 일본어 등 다른 언어는 자동 분류 모드로 시도해보세요.' },
            { q: '여행 영상 여러 개를 한번에 요약할 수 있나요?', a: '마이페이지에서 재생목록 가져오기 기능을 사용하면 여행 관련 재생목록을 일괄 요약할 수 있습니다.' },
          ].map(item => (
            <div key={item.q} className="bg-[#32302e] rounded-xl p-4">
              <p className="text-white text-sm font-semibold mb-1">Q. {item.q}</p>
              <p className="text-[#75716e] text-xs leading-relaxed">{item.a}</p>
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
