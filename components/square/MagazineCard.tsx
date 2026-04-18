'use client'

import Link from 'next/link'
import { CuratedPost } from '@/lib/magazine'

const CATEGORY_COLOR: Record<string, string> = {
  recipe: '#fb923c', english: '#60a5fa', learning: '#a78bfa',
  news: '#d1d5db', selfdev: '#34d399', travel: '#22d3ee',
  story: '#f472b6', tips: '#fbbf24',
}

function formatDate(iso: string) {
  if (!iso) return ''
  return new Intl.DateTimeFormat('ko-KR', { month: 'short', day: 'numeric' }).format(new Date(iso))
}

export default function MagazineCard({ post }: { post: CuratedPost }) {
  const accentColor = CATEGORY_COLOR[post.category] ?? '#fb923c'
  const hasHero = post.heroThumbnail && !post.heroThumbnail.startsWith('data:')

  return (
    <Link
      href={`/magazine/${post.slug}`}
      className="group block rounded-[18px] overflow-hidden border border-white/8 hover:border-orange-500/40 transition-all shadow-md bg-[#2a2826]"
    >
      {/* 히어로 이미지 또는 컬러 배너 */}
      <div className="relative overflow-hidden" style={{ aspectRatio: '16/9' }}>
        {hasHero ? (
          <img
            src={post.heroThumbnail}
            alt={post.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{ background: `linear-gradient(135deg, ${accentColor}22, ${accentColor}08)` }}
          >
            <span className="text-3xl opacity-40">✍️</span>
          </div>
        )}
        {/* 오버레이 그라디언트 */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#1a1918]/80 via-transparent to-transparent" />

        {/* 매거진 배지 */}
        <div className="absolute top-2 left-2 flex items-center gap-1">
          <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-orange-500 text-white">
            ✍️ 매거진
          </span>
        </div>

        {/* 영상 수 배지 */}
        <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur text-[9px] font-bold text-white border border-white/10">
          영상 {post.videoTitles.length}개
        </div>
      </div>

      {/* 콘텐츠 */}
      <div className="p-3 pb-2.5">
        {/* 제목 */}
        <h3
          className="text-[11px] font-black leading-snug line-clamp-2 mb-1.5 group-hover:text-orange-400 transition-colors"
          style={{ color: '#f4f4f5' }}
        >
          {post.title}
        </h3>

        {/* 부제 */}
        {post.subtitle && (
          <p className="text-[9px] text-[#75716e] leading-snug line-clamp-1 mb-2">
            {post.subtitle}
          </p>
        )}

        {/* 메타 */}
        <div className="flex items-center justify-between text-[8px] text-[#75716e]">
          <span>SSOKTUBE 에디터</span>
          <div className="flex items-center gap-1.5">
            <span>{post.readTime}분 읽기</span>
            {post.publishedAt && (
              <>
                <span>·</span>
                <span>{formatDate(post.publishedAt)}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 하단 컬러 바 */}
      <div
        className="h-0.5 w-full opacity-40 group-hover:opacity-80 transition-opacity"
        style={{ backgroundColor: accentColor }}
      />
    </Link>
  )
}
