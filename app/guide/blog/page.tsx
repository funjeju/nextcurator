import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: '유튜브 영상을 블로그 글로 자동 변환 — SEO 초안 10분 완성 | 쏙튜브',
  description: '유튜브 영상 URL 하나로 네이버 블로그·티스토리·워드프레스 SEO 최적화 글 초안을 자동 생성합니다. 유튜브 본 걸 블로그 글로 10분 만에.',
  keywords: ['유튜브 블로그 변환', '유튜브 블로그 글 자동 생성', '영상 블로그 초안', '유튜브 티스토리 자동화', '유튜브 네이버 블로그', '영상 요약 블로그', '유튜브 SEO 블로그', '콘텐츠 자동 생성', '유튜브 글쓰기 도구', '블로그 포스팅 자동화'],
}

export default function BlogGuidePage() {
  return (
    <article className="flex flex-col gap-10 max-w-2xl">
      <div>
        <div className="flex items-center gap-2 text-[#75716e] text-xs mb-4">
          <Link href="/guide" className="hover:text-white transition-colors">사용설명서</Link>
          <span>›</span>
          <span className="text-white">블로그 초안 생성</span>
        </div>
        <h1 className="text-2xl font-black text-white mb-3">✍️ 유튜브 본 걸 SEO 블로그 글로 10분 만에</h1>
        <p className="text-[#a4a09c] text-sm leading-relaxed">
          유튜브를 보고 배운 내용을 블로그에 정리하려면 보통 1~2시간이 걸립니다. 쏙튜브는 영상 요약 결과를 <strong className="text-white">SEO 최적화 블로그 초안</strong>으로 자동 변환합니다. 제목·소제목 구조·본문·결론·메타 디스크립션까지 완성된 초안이 생성되어 네이버 블로그, 티스토리, 워드프레스에 바로 붙여넣기 할 수 있습니다.
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-bold text-white border-l-2 border-violet-500 pl-3">이런 분께 필요한 기능입니다</h2>
        <ul className="flex flex-col gap-2">
          {[
            '유튜브를 보고 배운 내용을 블로그에 기록·정리하는 분',
            '정보성 유튜브를 보고 독자에게 쉽게 전달하고 싶은 블로거',
            '영상 리뷰·후기를 블로그에 꾸준히 연재하고 싶은 분',
            '네이버 블로그 애드포스트, 티스토리 애드센스를 운영하는 분',
            '블로그 포스팅에 많은 시간을 쓰지 않고 콘텐츠를 늘리고 싶은 분',
          ].map(t => (
            <li key={t} className="flex items-start gap-2 text-[#a4a09c] text-sm">
              <span className="text-violet-400 mt-0.5 shrink-0">✓</span>{t}
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-base font-bold text-white border-l-2 border-violet-500 pl-3">유튜브 → 블로그 초안 만드는 방법</h2>
        <ol className="flex flex-col gap-3">
          {[
            { step: '1', title: '유튜브 URL 입력 후 요약 생성', desc: '먼저 유튜브 영상을 요약합니다. 어떤 카테고리든 요약 완료 후 블로그 초안 생성이 가능합니다.' },
            { step: '2', title: '결과 페이지에서 "블로그 초안" 클릭', desc: '요약 결과 페이지 하단 또는 도구 메뉴에서 블로그 초안 생성 버튼을 클릭합니다.' },
            { step: '3', title: 'AI가 SEO 최적화 초안 자동 생성', desc: 'AI가 요약 내용을 기반으로 검색에 최적화된 블로그 글 구조(H2·H3 소제목, 본문, 결론)로 재구성합니다. 키워드도 자연스럽게 배치됩니다.' },
            { step: '4', title: '마이페이지 "블로그 초안" 탭에 저장', desc: '생성된 초안은 마이페이지 블로그 초안 탭에 저장됩니다. 원하는 플랫폼에 복사 붙여넣기 후 수정해 발행하세요.' },
          ].map(item => (
            <li key={item.step} className="flex gap-4 bg-[#32302e] rounded-2xl p-4">
              <span className="w-7 h-7 rounded-full bg-violet-500/20 text-violet-400 font-bold text-sm flex items-center justify-center shrink-0">{item.step}</span>
              <div>
                <p className="text-white font-semibold text-sm">{item.title}</p>
                <p className="text-[#75716e] text-xs mt-1 leading-relaxed">{item.desc}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="bg-[#32302e] rounded-2xl p-5 flex flex-col gap-3">
        <h2 className="text-base font-bold text-white">블로그 초안에 포함되는 내용</h2>
        <ul className="grid grid-cols-2 gap-2.5">
          {[
            ['🎯', 'SEO 최적화 제목 제안'],
            ['📑', 'H2·H3 소제목 구조'],
            ['📝', '본문 섹션별 내용'],
            ['✅', '결론 & 독자 행동 유도'],
            ['🔑', '핵심 키워드 목록'],
            ['📊', '메타 디스크립션 초안'],
          ].map(([icon, label]) => (
            <li key={label as string} className="text-[#a4a09c] text-xs flex items-center gap-2">
              <span>{icon}</span>{label}
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-bold text-white border-l-2 border-violet-500 pl-3">지원 블로그 플랫폼</h2>
        <div className="grid grid-cols-3 gap-2">
          {['네이버 블로그', '티스토리', '워드프레스', 'Notion', 'Velog', '브런치'].map(t => (
            <div key={t} className="bg-[#32302e] rounded-xl px-3 py-2 text-[#a4a09c] text-xs text-center">{t}</div>
          ))}
        </div>
        <p className="text-[#4a4745] text-xs">마크다운 형식으로 복사 후 각 플랫폼에 붙여넣어 사용하세요.</p>
      </section>

      <div className="flex items-center gap-3 pt-2 border-t border-white/5">
        <Link href="/" className="px-5 py-2.5 bg-violet-600 hover:bg-violet-500 text-white font-bold text-sm rounded-xl transition-colors">
          블로그 초안 만들기
        </Link>
        <Link href="/guide/shorts" className="text-[#75716e] text-sm hover:text-white transition-colors">
          숏폼 스크립트 →
        </Link>
      </div>
    </article>
  )
}
