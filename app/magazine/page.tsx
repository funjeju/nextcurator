import Link from 'next/link'
import Header from '@/components/common/Header'
import { listCuratedPostsAdmin } from '@/lib/magazine-server'
import type { CuratedPost } from '@/lib/magazine'

const CATEGORY_LABEL: Record<string, string> = {
  recipe: '🍳 요리', english: '🔤 영어', learning: '📐 학습', news: '🗞️ 뉴스',
  selfdev: '💪 자기계발', travel: '🧳 여행', story: '🍿 스토리', tips: '💡 팁',
}

function formatDate(iso: string) {
  if (!iso) return ''
  return new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric' }).format(new Date(iso))
}

function PostCard({ post }: { post: CuratedPost }) {
  const hasThumb = post.heroThumbnail && !post.heroThumbnail.startsWith('data:')
  return (
    <Link href={`/magazine/${post.slug}`} className="group flex flex-col rounded-2xl overflow-hidden bg-[#2a2826] border border-white/6 hover:border-orange-500/30 transition-all hover:shadow-lg hover:shadow-orange-500/5">
      <div className="relative aspect-video bg-[#1c1a18] overflow-hidden">
        {hasThumb ? (
          <img src={post.heroThumbnail} alt={post.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl opacity-30">✍️</div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#2a2826]/90 via-transparent to-transparent" />
        {post.category && (
          <span className="absolute bottom-3 left-3 px-2 py-0.5 rounded-full text-[10px] font-bold bg-black/70 text-white border border-white/20">
            {CATEGORY_LABEL[post.category] ?? post.category}
          </span>
        )}
      </div>

      <div className="flex flex-col flex-1 p-4 gap-2">
        <h2 className="text-sm font-black text-white leading-snug line-clamp-2 group-hover:text-orange-300 transition-colors">
          {post.title}
        </h2>
        {post.subtitle && (
          <p className="text-xs text-[#75716e] line-clamp-2 leading-relaxed">{post.subtitle}</p>
        )}

        {post.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-auto pt-2">
            {post.tags.slice(0, 3).map(tag => (
              <span key={tag} className="px-1.5 py-0.5 rounded text-[9px] bg-[#32302e] text-[#75716e]">#{tag}</span>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 text-[10px] text-[#75716e] pt-1 border-t border-white/6">
          <span>{formatDate(post.publishedAt)}</span>
          <span>·</span>
          <span>{post.readTime}분</span>
          {post.viewCount > 0 && (
            <>
              <span>·</span>
              <span>👁 {post.viewCount.toLocaleString()}</span>
            </>
          )}
        </div>
      </div>
    </Link>
  )
}

export const dynamic = 'force-dynamic'

export default async function MagazineBoardPage() {
  let posts: CuratedPost[] = []
  try {
    const all = await listCuratedPostsAdmin()
    posts = all.filter(p => p.status === 'published')
  } catch { /* admin SDK 초기화 실패 시 빈 배열 */ }

  return (
    <div className="min-h-screen bg-[#252423]">
      <Header />
      <main className="max-w-5xl mx-auto px-4 pb-20">

        <div className="flex items-end justify-between mb-8 pt-2">
          <div>
            <p className="text-xs text-orange-400 font-bold tracking-widest mb-1">SSOKTUBE</p>
            <h1 className="text-2xl md:text-3xl font-black text-white">매거진</h1>
            <p className="text-sm text-[#75716e] mt-1">AI 에디터가 엄선한 유튜브 큐레이션</p>
          </div>
          <span className="text-xs text-[#75716e]">총 {posts.length}편</span>
        </div>

        {posts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <div className="text-5xl mb-4 opacity-30">✍️</div>
            <p className="text-[#75716e] text-sm">아직 발행된 매거진이 없습니다.</p>
            <p className="text-[#4a4845] text-xs mt-1">관리자 페이지에서 포스트를 발행해주세요.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {posts.map(post => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        )}

      </main>
    </div>
  )
}
