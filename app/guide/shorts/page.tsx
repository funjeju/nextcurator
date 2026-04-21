import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: '유튜브 영상에서 쇼츠·릴스·틱톡 대본 자동 추출 — 1분 숏폼 스크립트 | 쏙튜브',
  description: '롱폼 유튜브 영상에서 바이럴 포인트와 쇼츠 대본을 자동으로 추출합니다. 30분 강의에서 1분 숏폼 스크립트를 10초 만에. 유튜브 쇼츠, 인스타 릴스, 틱톡 모두 지원.',
  keywords: ['유튜브 숏폼 스크립트', '유튜브 쇼츠 대본 자동 생성', '롱폼 숏폼 변환', '유튜브 릴스 스크립트 자동 생성', '유튜브 쇼츠 만들기', '틱톡 대본 자동화', '숏폼 콘텐츠 제작', '유튜브 쇼츠 스크립트', '인스타그램 릴스 대본', '바이럴 포인트 추출', '유튜브 영상 대본 추출', '숏폼 영상 제작 도구'],
}

export default function ShortsGuidePage() {
  return (
    <article className="flex flex-col gap-10 max-w-2xl">
      <div>
        <div className="flex items-center gap-2 text-[#75716e] text-xs mb-4">
          <Link href="/guide" className="hover:text-white transition-colors">사용설명서</Link>
          <span>›</span>
          <span className="text-white">숏폼 스크립트</span>
        </div>
        <h1 className="text-2xl font-black text-white mb-3">🎬 롱폼 유튜브에서 바이럴 숏폼 대본을 10초 만에</h1>
        <p className="text-[#a4a09c] text-sm leading-relaxed">
          30분짜리 강의·인터뷰·다큐멘터리에서 가장 임팩트 있는 순간을 찾아내고, <strong className="text-white">유튜브 쇼츠 · 인스타그램 릴스 · 틱톡</strong>에 최적화된 60초 이내 대본으로 재구성합니다. 영상을 처음부터 끝까지 다시 볼 필요 없이, AI가 바이럴 포인트를 골라 숏폼 제작 준비를 끝냅니다. 영상 편집자, 크리에이터, 마케터 모두에게 강력한 콘텐츠 리퍼포징 도구입니다.
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-bold text-white border-l-2 border-pink-500 pl-3">이런 분께 필요한 기능입니다</h2>
        <ul className="flex flex-col gap-2">
          {[
            '롱폼 영상 콘텐츠를 숏폼으로 리퍼포징하고 싶은 크리에이터',
            '유튜브 쇼츠·인스타 릴스 채널을 따로 운영하는 분',
            '회사 세미나·강의 영상을 짧게 잘라 SNS에 활용하려는 마케터',
            '바이럴 가능성 높은 포인트를 빠르게 찾고 싶은 영상 편집자',
            '인터뷰·팟캐스트 영상에서 명언·인사이트 클립을 뽑고 싶은 분',
          ].map(t => (
            <li key={t} className="flex items-start gap-2 text-[#a4a09c] text-sm">
              <span className="text-pink-400 mt-0.5 shrink-0">✓</span>{t}
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-base font-bold text-white border-l-2 border-pink-500 pl-3">숏폼 스크립트 추출 방법</h2>
        <ol className="flex flex-col gap-3">
          {[
            { step: '1', title: '유튜브 URL 붙여넣기', desc: '숏폼으로 만들고 싶은 롱폼 유튜브 영상 URL을 복사합니다. 강의, 인터뷰, 브이로그, 다큐멘터리 등 모든 포맷 지원.' },
            { step: '2', title: '🎬 숏폼 카테고리 선택', desc: '숏폼 콘텐츠에 특화된 분석 모드로 전환됩니다. AI가 영상 자막에서 훅·핵심 메시지·클라이맥스 포인트를 추출합니다.' },
            { step: '3', title: 'AI가 바이럴 포인트 선별', desc: '영상 전체에서 감정적 반응을 유발하는 구간, 정보 밀도가 높은 구간, 서프라이즈 팩트가 있는 구간을 자동으로 식별합니다.' },
            { step: '4', title: '60초 대본 & 해시태그 완성', desc: '플랫폼별(쇼츠/릴스/틱톡) 포맷에 맞게 재구성된 대본과 바이럴 해시태그까지 한 번에 완성됩니다.' },
          ].map(item => (
            <li key={item.step} className="flex gap-4 bg-[#32302e] rounded-2xl p-4">
              <span className="w-7 h-7 rounded-full bg-pink-500/20 text-pink-400 font-bold text-sm flex items-center justify-center shrink-0">{item.step}</span>
              <div>
                <p className="text-white font-semibold text-sm">{item.title}</p>
                <p className="text-[#75716e] text-xs mt-1 leading-relaxed">{item.desc}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="bg-[#32302e] rounded-2xl p-5 flex flex-col gap-3">
        <h2 className="text-base font-bold text-white">숏폼 스크립트에 포함되는 내용</h2>
        <ul className="grid grid-cols-2 gap-2.5">
          {[
            ['⚡', '훅 (Hook) — 첫 3초 오프닝'],
            ['🎯', '핵심 메시지 1~3가지'],
            ['📝', '60초 이내 전체 대본'],
            ['🔥', '바이럴 포인트 타임스탬프'],
            ['🏷️', '플랫폼별 추천 해시태그'],
            ['📱', '자막용 텍스트 포맷'],
          ].map(([icon, label]) => (
            <li key={label as string} className="text-[#a4a09c] text-xs flex items-center gap-2">
              <span>{icon}</span>{label}
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-base font-bold text-white border-l-2 border-pink-500 pl-3">콘텐츠 유형별 리퍼포징 시나리오</h2>
        <div className="flex flex-col gap-3">
          {[
            { icon: '🎓', title: '강의 영상 → 핵심 1줄 쇼츠 시리즈', desc: '50분짜리 마케팅 강의에서 "절대 하면 안 되는 SNS 실수 3가지"처럼 충격적 인사이트만 뽑아 쇼츠 시리즈로 만드세요.' },
            { icon: '🎤', title: '인터뷰 영상 → 명언·인사이트 클립', desc: '유명인·전문가 인터뷰에서 가장 인상적인 발언을 15~30초 클립으로 추출. 링크드인, 인스타, 유튜브 쇼츠에 공유하세요.' },
            { icon: '🎬', title: '다큐멘터리 → 충격적 사실 숏폼', desc: '"사실 ~라는 걸 알고 있었나요?" 형식의 훅으로 시작하는 교육형 숏폼 대본. 알고리즘에 최적화된 정보성 콘텐츠.' },
            { icon: '🏃', title: '브이로그 → 하이라이트 릴스', desc: '여행 브이로그, 일상 기록에서 가장 감동적·재미있는 순간을 선별해 릴스·틱톡 하이라이트 대본으로 변환합니다.' },
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
        <h2 className="text-base font-bold text-white border-l-2 border-pink-500 pl-3">자주 묻는 질문</h2>
        <div className="flex flex-col gap-2">
          {[
            { q: '한 영상에서 여러 개의 숏폼 아이디어를 얻을 수 있나요?', a: '네, AI가 복수의 바이럴 포인트를 추출하므로 하나의 롱폼에서 3~5개의 숏폼 아이디어를 동시에 확인할 수 있습니다.' },
            { q: '대본 그대로 녹음해도 되나요?', a: '생성된 대본은 초안입니다. 내 목소리·톤·캐릭터에 맞게 수정해 사용하는 것을 권장합니다.' },
          ].map(item => (
            <div key={item.q} className="bg-[#32302e] rounded-xl p-4">
              <p className="text-white text-sm font-semibold mb-1">Q. {item.q}</p>
              <p className="text-[#75716e] text-xs leading-relaxed">{item.a}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="flex items-center gap-3 pt-2 border-t border-white/5">
        <Link href="/" className="px-5 py-2.5 bg-pink-600 hover:bg-pink-500 text-white font-bold text-sm rounded-xl transition-colors">
          숏폼 스크립트 추출하기
        </Link>
        <Link href="/guide/search" className="text-[#75716e] text-sm hover:text-white transition-colors">
          AI 대화 검색 →
        </Link>
      </div>
    </article>
  )
}
