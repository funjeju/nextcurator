'use client'

import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import Header from '@/components/common/Header'
import { CuratedPost } from '@/lib/magazine'

const CATEGORY_LABEL: Record<string, string> = {
  recipe: '🍳 요리', english: '🔤 영어', learning: '📐 학습', news: '🗞️ 뉴스',
  selfdev: '💪 자기계발', travel: '🧳 여행', story: '🍿 스토리', tips: '💡 팁',
}

function formatDate(iso: string) {
  if (!iso) return ''
  return new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(iso))
}

export default function MagazinePostClient({ post }: { post: CuratedPost }) {
  return (
    <div className="min-h-screen bg-[#252423]">
      <Header />

      <article className="max-w-3xl mx-auto px-4 pb-20">

        {/* 브레드크럼 */}
        <nav className="flex items-center gap-2 text-xs text-[#75716e] mb-6">
          <Link href="/square" className="hover:text-orange-400 transition-colors">SQUARE K</Link>
          <span>/</span>
          <span className="text-[#a4a09c]">매거진</span>
        </nav>

        {/* 히어로 */}
        {post.heroThumbnail && !post.heroThumbnail.startsWith('data:') && (
          <div className="relative w-full aspect-video rounded-2xl overflow-hidden mb-8 bg-[#1c1a18]">
            <img
              src={post.heroThumbnail}
              alt={post.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#252423]/80 via-transparent to-transparent" />
            <div className="absolute bottom-4 left-4 flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-500 text-white">
                ✍️ SSOKTUBE 매거진
              </span>
              {post.category && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-black/60 text-white border border-white/20">
                  {CATEGORY_LABEL[post.category] ?? post.category}
                </span>
              )}
            </div>
          </div>
        )}

        {/* 헤더 */}
        <header className="mb-10">
          {!post.heroThumbnail && (
            <div className="flex items-center gap-2 mb-4">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-500 text-white">
                ✍️ SSOKTUBE 매거진
              </span>
              {post.category && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#32302e] text-[#a4a09c] border border-white/10">
                  {CATEGORY_LABEL[post.category] ?? post.category}
                </span>
              )}
            </div>
          )}

          <h1 className="text-2xl md:text-3xl font-black text-white leading-tight mb-3">
            {post.title}
          </h1>
          {post.subtitle && (
            <p className="text-lg text-[#a4a09c] font-medium mb-4">{post.subtitle}</p>
          )}

          <div className="flex items-center gap-3 text-xs text-[#75716e]">
            <span>SSOKTUBE 에디터</span>
            <span>·</span>
            <span>{formatDate(post.publishedAt)}</span>
            <span>·</span>
            <span>읽는 시간 {post.readTime}분</span>
            {post.viewCount > 0 && (
              <>
                <span>·</span>
                <span>👁 {post.viewCount}</span>
              </>
            )}
          </div>

          {/* 태그 */}
          {post.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-4">
              {post.tags.slice(0, 8).map(tag => (
                <span key={tag} className="px-2 py-0.5 rounded-full text-[10px] bg-[#32302e] text-[#a4a09c] border border-white/8">
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </header>

        {/* 본문 — 마크다운 렌더링 */}
        <div className="prose prose-invert prose-sm md:prose-base max-w-none
          prose-headings:text-white prose-headings:font-black
          prose-h2:text-xl prose-h2:mt-10 prose-h2:mb-4 prose-h2:border-b prose-h2:border-white/10 prose-h2:pb-2
          prose-h3:text-base prose-h3:mt-6 prose-h3:mb-2 prose-h3:text-orange-400
          prose-p:text-[#c4c0bc] prose-p:leading-relaxed prose-p:my-3
          prose-strong:text-white prose-strong:font-bold
          prose-li:text-[#c4c0bc] prose-ul:my-3 prose-ol:my-3
          prose-blockquote:border-l-orange-500 prose-blockquote:bg-[#2a2826] prose-blockquote:rounded-r-lg prose-blockquote:py-1
          prose-blockquote:text-[#a4a09c]">
          <ReactMarkdown>{post.body}</ReactMarkdown>
        </div>

        {/* 포함된 영상 목록 */}
        <section className="mt-14">
          <h2 className="text-base font-black text-white mb-4 flex items-center gap-2">
            <span className="w-1 h-4 rounded-full bg-orange-500" />
            이 포스트에 포함된 영상 ({post.videoTitles.length}개)
          </h2>
          <div className="space-y-2">
            {post.videoTitles.map((title, i) => (
              <Link
                key={post.summaryIds[i]}
                href={`/result/${post.summaryIds[i]}`}
                className="flex items-center gap-3 p-3 rounded-xl bg-[#2a2826] border border-white/6 hover:border-orange-500/30 hover:bg-[#32302e] transition-all group"
              >
                <span className="shrink-0 w-5 h-5 rounded-full bg-orange-500/20 flex items-center justify-center text-[10px] font-black text-orange-400">
                  {i + 1}
                </span>
                <span className="text-sm text-[#c4c0bc] group-hover:text-white transition-colors line-clamp-1">
                  {title}
                </span>
                <svg className="shrink-0 ml-auto w-3.5 h-3.5 text-[#75716e] group-hover:text-orange-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            ))}
          </div>
        </section>

        {/* 하단 CTA */}
        <div className="mt-12 p-6 rounded-2xl bg-gradient-to-br from-orange-500/10 to-amber-500/5 border border-orange-500/20 text-center">
          <p className="text-white font-bold mb-1">더 많은 큐레이션이 궁금하다면?</p>
          <p className="text-[#a4a09c] text-sm mb-4">SQUARE K에서 다른 사람들의 요약을 둘러보세요.</p>
          <Link
            href="/square"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold transition-colors"
          >
            SQUARE K 둘러보기 →
          </Link>
        </div>

      </article>
    </div>
  )
}
