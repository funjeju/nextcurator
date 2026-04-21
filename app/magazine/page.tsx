import type { Metadata } from 'next'
import Link from 'next/link'
import Header from '@/components/common/Header'
import { listCuratedPostsAdmin } from '@/lib/magazine-server'
import type { CuratedPost } from '@/lib/magazine'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'AI 매거진 | SSOKTUBE — AI 뉴스·도구·활용 전문 큐레이션',
  description: 'ChatGPT, Claude, Gemini 등 최신 AI 뉴스와 생산성 도구, 실전 활용 사례를 깊이 다루는 AI 전문 매거진. 매일 3회 AI 에디터가 엄선한 유튜브 핵심 콘텐츠.',
  keywords: ['AI 매거진', 'AI 뉴스', 'AI 도구', 'ChatGPT', 'Claude', 'Gemini', '생성형AI', 'AI 활용법', 'AI 트렌드', '인공지능'],
  alternates: { canonical: 'https://ssoktube.com/magazine' },
  openGraph: {
    title: 'AI 매거진 | SSOKTUBE',
    description: 'AI 뉴스·도구·활용법을 깊이 다루는 AI 전문 매거진. 매일 3회 업데이트.',
    type: 'website',
    url: 'https://ssoktube.com/magazine',
    siteName: 'SSOKTUBE',
  },
}

const TOPIC_META: Record<string, { label: string; emoji: string; desc: string; color: string; textColor: string; borderColor: string }> = {
  'ai-news':     { label: 'AI 소식',  emoji: '📰', desc: '최신 AI 업계 뉴스·발표',  color: 'bg-blue-500/15',   textColor: 'text-blue-400',   borderColor: 'border-blue-500/30'   },
  'ai-tools':    { label: 'AI 도구',  emoji: '🛠️', desc: '생산성 AI 도구·앱 리뷰',  color: 'bg-purple-500/15', textColor: 'text-purple-400', borderColor: 'border-purple-500/30' },
  'ai-usecases': { label: 'AI 활용',  emoji: '🚀', desc: '실전 AI 활용·자동화 사례', color: 'bg-emerald-500/15', textColor: 'text-emerald-400', borderColor: 'border-emerald-500/30' },
}

function getTopicMeta(topicCluster: string) {
  return TOPIC_META[topicCluster] ?? null
}

function formatDate(iso: string) {
  if (!iso) return ''
  return new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric' }).format(new Date(iso))
}

function FeaturedCard({ post }: { post: CuratedPost }) {
  const topic = getTopicMeta(post.topicCluster)
  const hasThumb = post.heroThumbnail && !post.heroThumbnail.startsWith('data:')
  return (
    <Link
      href={`/magazine/${post.slug}`}
      className="group relative flex flex-col md:flex-row rounded-2xl overflow-hidden bg-[#2a2826] border border-white/8 hover:border-orange-500/30 transition-all hover:shadow-xl hover:shadow-orange-500/5"
    >
      <div className="relative md:w-[55%] aspect-video md:aspect-auto bg-[#1c1a18] overflow-hidden shrink-0">
        {hasThumb ? (
          <img
            src={post.heroThumbnail}
            alt={post.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-5xl opacity-20">🤖</div>
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-[#2a2826]/80 hidden md:block" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#2a2826]/90 via-transparent to-transparent md:hidden" />
      </div>
      <div className="flex flex-col justify-center p-6 md:p-8 flex-1">
        {topic && (
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black border w-fit mb-3 ${topic.color} ${topic.textColor} ${topic.borderColor}`}>
            {topic.emoji} {topic.label}
          </span>
        )}
        <h2 className="text-xl md:text-2xl font-black text-white leading-tight mb-3 group-hover:text-orange-300 transition-colors">
          {post.title}
        </h2>
        {post.subtitle && (
          <p className="text-sm text-[#a4a09c] leading-relaxed mb-4 line-clamp-2">{post.subtitle}</p>
        )}
        <div className="flex items-center gap-3 text-[11px] text-[#75716e]">
          <span>{formatDate(post.publishedAt)}</span>
          <span>·</span>
          <span>{post.readTime}분 읽기</span>
          {post.viewCount > 0 && <><span>·</span><span>👁 {post.viewCount.toLocaleString()}</span></>}
        </div>
        {post.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {post.tags.slice(0, 4).map(tag => (
              <span key={tag} className="px-2 py-0.5 rounded text-[10px] bg-[#32302e] text-[#75716e]">#{tag}</span>
            ))}
          </div>
        )}
      </div>
    </Link>
  )
}

function PostCard({ post }: { post: CuratedPost }) {
  const topic = getTopicMeta(post.topicCluster)
  const hasThumb = post.heroThumbnail && !post.heroThumbnail.startsWith('data:')
  return (
    <Link
      href={`/magazine/${post.slug}`}
      className="group flex flex-col rounded-2xl overflow-hidden bg-[#2a2826] border border-white/6 hover:border-orange-500/30 transition-all hover:shadow-lg hover:shadow-orange-500/5"
    >
      <div className="relative aspect-video bg-[#1c1a18] overflow-hidden">
        {hasThumb ? (
          <img src={post.heroThumbnail} alt={post.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-3xl opacity-20">🤖</div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#2a2826]/80 via-transparent to-transparent" />
        {topic && (
          <span className={`absolute bottom-3 left-3 px-2 py-0.5 rounded-full text-[10px] font-bold border ${topic.color} ${topic.textColor} ${topic.borderColor}`}>
            {topic.emoji} {topic.label}
          </span>
        )}
      </div>
      <div className="flex flex-col flex-1 p-4 gap-2">
        <h3 className="text-sm font-black text-white leading-snug line-clamp-2 group-hover:text-orange-300 transition-colors">
          {post.title}
        </h3>
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
          {post.viewCount > 0 && <><span>·</span><span>👁 {post.viewCount.toLocaleString()}</span></>}
        </div>
      </div>
    </Link>
  )
}

export default async function MagazineBoardPage() {
  let posts: CuratedPost[] = []
  try {
    const all = await listCuratedPostsAdmin()
    posts = all.filter(p => p.status === 'published')
  } catch { /* admin SDK 초기화 실패 */ }

  const featured = posts[0] ?? null
  const rest = posts.slice(1)

  // JSON-LD: Blog + BreadcrumbList
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'Blog',
      name: 'SSOKTUBE AI 매거진',
      description: 'AI 뉴스, 도구, 활용 사례를 깊이 다루는 AI 전문 매거진',
      url: 'https://ssoktube.com/magazine',
      publisher: {
        '@type': 'Organization',
        name: 'SSOKTUBE',
        url: 'https://ssoktube.com',
        logo: { '@type': 'ImageObject', url: 'https://ssoktube.com/icon.png' },
      },
      blogPost: posts.slice(0, 10).map(p => ({
        '@type': 'BlogPosting',
        headline: p.title,
        description: p.seoDescription,
        url: `https://ssoktube.com/magazine/${p.slug}`,
        datePublished: p.publishedAt,
        ...(p.heroThumbnail && !p.heroThumbnail.startsWith('data:') ? { image: p.heroThumbnail } : {}),
      })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: '홈', item: 'https://ssoktube.com' },
        { '@type': 'ListItem', position: 2, name: 'AI 매거진', item: 'https://ssoktube.com/magazine' },
      ],
    },
  ]

  return (
    <>
      {jsonLd.map((ld, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      ))}

      <div className="min-h-screen bg-[#252423]">
        <Header />
        <main className="max-w-5xl mx-auto px-4 pb-24">

          {/* 브레드크럼 */}
          <nav aria-label="breadcrumb" className="flex items-center gap-2 text-xs text-[#75716e] pt-4 mb-6">
            <Link href="/" className="hover:text-orange-400 transition-colors">홈</Link>
            <span>/</span>
            <span className="text-[#a4a09c]">AI 매거진</span>
          </nav>

          {/* 헤더 */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-orange-500 text-white tracking-wide">AI MAGAZINE</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-black text-white mb-2">AI 매거진</h1>
            <p className="text-[#a4a09c] text-sm max-w-xl leading-relaxed">
              ChatGPT, Claude, Gemini 등 최신 AI 뉴스와 생산성 도구, 실전 활용 사례를 AI 에디터가 엄선해 깊이 있게 다룹니다. 매일 3회 업데이트.
            </p>
          </div>

          {/* 카테고리 사일로 네비 */}
          <nav aria-label="카테고리" className="flex items-stretch gap-3 mb-10 overflow-x-auto pb-1">
            <Link
              href="/magazine"
              className="shrink-0 flex flex-col justify-center px-5 py-3 rounded-2xl bg-orange-500/20 border border-orange-500/40 text-orange-400 text-sm font-black hover:bg-orange-500/30 transition-colors"
            >
              <span>전체</span>
              <span className="text-[10px] font-normal text-orange-400/70 mt-0.5">{posts.length}편</span>
            </Link>
            {Object.entries(TOPIC_META).map(([cluster, meta]) => {
              const count = posts.filter(p => p.topicCluster === cluster).length
              return (
                <Link
                  key={cluster}
                  href={`/magazine/topic/${cluster}`}
                  className={`shrink-0 flex flex-col justify-center px-5 py-3 rounded-2xl border ${meta.color} ${meta.borderColor} ${meta.textColor} text-sm font-bold hover:opacity-80 transition-opacity`}
                >
                  <span>{meta.emoji} {meta.label}</span>
                  <span className="text-[10px] font-normal opacity-70 mt-0.5">{count}편 · {meta.desc}</span>
                </Link>
              )
            })}
          </nav>

          {posts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-32 text-center">
              <div className="text-5xl mb-4 opacity-30">🤖</div>
              <p className="text-[#75716e] text-sm">아직 발행된 AI 매거진이 없습니다.</p>
              <p className="text-[#4a4845] text-xs mt-1">관리자 페이지에서 파이프라인을 실행해주세요.</p>
            </div>
          ) : (
            <>
              {/* 피처드 포스트 */}
              {featured && (
                <section className="mb-10">
                  <FeaturedCard post={featured} />
                </section>
              )}

              {/* 나머지 그리드 */}
              {rest.length > 0 && (
                <section>
                  <h2 className="text-xs font-black text-[#75716e] uppercase tracking-widest mb-4">최신 기사</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {rest.map(post => (
                      <PostCard key={post.id} post={post} />
                    ))}
                  </div>
                </section>
              )}
            </>
          )}

        </main>
      </div>
    </>
  )
}
