import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: '유튜브 영상을 블로그 글로 자동 변환 — 쏙튜브',
  description: '유튜브 영상 하나가 SEO 최적화 블로그 초안이 됩니다. 네이버 블로그, 티스토리, 워드프레스 바로 붙여넣기 가능.',
  keywords: ['유튜브 블로그 변환', '유튜브 블로그 글 자동 생성', '영상 블로그 초안', '유튜브 티스토리 자동화'],
}

export default function BlogGuidePage() {
  return (
    <article className="flex flex-col gap-8 max-w-2xl">
      <div>
        <div className="flex items-center gap-2 text-[#75716e] text-xs mb-4">
          <Link href="/guide" className="hover:text-white transition-colors">사용설명서</Link>
          <span>›</span>
          <span className="text-white">블로그 초안 생성</span>
        </div>
        <h1 className="text-2xl font-black text-white mb-3">✍️ 유튜브 본 걸 블로그 글로 10분 만에</h1>
        <p className="text-[#a4a09c] text-sm leading-relaxed">
          영상을 보고 내용을 정리해 블로그에 올리려면 보통 1시간 이상 걸립니다. 쏙튜브는 영상 요약 결과를 <strong className="text-white">블로그 초안 형식</strong>으로 재구성해 드립니다.
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-bold text-white">이런 분께 필요합니다</h2>
        <ul className="flex flex-col gap-2">
          {[
            '유튜브를 보고 배운 내용을 블로그에 기록하는 분',
            '영상 리뷰·후기를 블로그에 연재하는 분',
            '정보성 유튜브를 보고 독자에게 쉽게 전달하고 싶은 분',
            '블로그 포스팅 시간을 줄이고 싶은 크리에이터',
          ].map(t => (
            <li key={t} className="flex items-start gap-2 text-[#a4a09c] text-sm">
              <span className="text-violet-400 mt-0.5 shrink-0">✓</span>{t}
            </li>
          ))}
        </ul>
      </section>

      <section className="bg-[#32302e] rounded-2xl p-5 flex flex-col gap-2">
        <h2 className="text-base font-bold text-white">블로그 초안에 포함되는 내용</h2>
        <ul className="grid grid-cols-2 gap-2 mt-1">
          {['SEO 제목 제안', '소제목 구조 (H2/H3)', '핵심 내용 단락', '결론 & 정리', '관련 키워드 목록', '메타 디스크립션 초안'].map(t => (
            <li key={t} className="text-[#a4a09c] text-xs flex items-center gap-1.5">
              <span className="text-violet-400">✦</span>{t}
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-bold text-white">지원 플랫폼</h2>
        <div className="grid grid-cols-3 gap-2">
          {['네이버 블로그', '티스토리', '워드프레스', 'Notion', 'Velog', '브런치'].map(t => (
            <div key={t} className="bg-[#32302e] rounded-xl px-3 py-2 text-[#a4a09c] text-xs text-center">{t}</div>
          ))}
        </div>
        <p className="text-[#4a4745] text-xs">* 마크다운 형식으로 복사 후 각 플랫폼에 붙여넣으세요</p>
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
