'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import Header from '@/components/common/Header'
import { getPublicSummaries, toggleLike, getUserLikedIds, incrementViewCount, getOrCreateConversation, updateSummaryVisibility, SavedSummary } from '@/lib/db'
import { getCommentCountsBySessionIds } from '@/lib/comments'
import { useAuth } from '@/providers/AuthProvider'
import { formatRelativeDate } from '@/lib/formatDate'
import { useRouter } from 'next/navigation'
import FloatingChat from '@/components/chat/FloatingChat'
import AdBanner from '@/components/ads/AdBanner'
import { naturalSearch } from '@/lib/nlp-search'
import MagazineCard from '@/components/square/MagazineCard'
import { getPublishedPosts, CuratedPost } from '@/lib/magazine'

const CATEGORIES = [
  { id: 'all',     label: '전체' },
  { id: 'recipe',  label: '🍳 요리' },
  { id: 'english', label: '🔤 영어' },
  { id: 'learning',label: '📐 학습' },
  { id: 'news',    label: '🗞️ 뉴스' },
  { id: 'selfdev', label: '💪 자기계발' },
  { id: 'travel',  label: '🧳 여행' },
  { id: 'story',   label: '🍿 스토리' },
  { id: 'tips',    label: '💡 팁' },
]

const CATEGORY_META: Record<string, { color: string; bg: string; emoji: string }> = {
  recipe:   { color: '#fb923c', bg: '#431407', emoji: '🍳' },
  english:  { color: '#60a5fa', bg: '#1e1b4b', emoji: '🔤' },
  learning: { color: '#a78bfa', bg: '#2e1065', emoji: '📐' },
  news:     { color: '#d1d5db', bg: '#1f2937', emoji: '🗞️' },
  selfdev:  { color: '#34d399', bg: '#064e3b', emoji: '💪' },
  travel:   { color: '#22d3ee', bg: '#083344', emoji: '🧳' },
  story:    { color: '#f472b6', bg: '#4a044e', emoji: '🍿' },
  tips:     { color: '#fbbf24', bg: '#451a03', emoji: '💡' },
}

// 추천·광고 슬롯을 일반 카드와 같은 그리드 아이템으로 취급하기 위한 타입
type RecSlot = {
  __rec: true
  slotId: string
  category: string
  items: SavedSummary[]
  personalized: boolean
}
type AdSlotItem = {
  __ad: true
  slotId: string
}
type MagSlot = {
  __mag: true
  slotId: string
  post: CuratedPost
}
type GridItem = SavedSummary | RecSlot | AdSlotItem | MagSlot

const RECOMMENDATION_INTERVAL = 9
const AD_INTERVAL = 13
const MAGAZINE_INTERVAL = 7  // 카드 7개마다 매거진 포스트 1개 삽입

// 반응형 컬럼 수 — window.innerWidth 기반
function useColumnCount() {
  const [cols, setCols] = useState(2)
  useEffect(() => {
    const update = () => {
      if (window.innerWidth >= 1024) setCols(4)
      else if (window.innerWidth >= 768) setCols(3)
      else setCols(2)
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])
  return cols
}

type SortType = 'latest' | 'popular' | 'views'
type ViewMode = 'grid' | 'list'

function getUserTopCategories(likedIds: Set<string>, summaries: SavedSummary[]): string[] {
  const counts: Record<string, number> = {}
  for (const id of likedIds) {
    const s = summaries.find(s => s.id === id)
    if (s?.category) counts[s.category] = (counts[s.category] ?? 0) + 1
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([cat]) => cat)
}

// 일반 요약 카드
function SummaryCard({ item, likedIds, likingIds, user, messagingId, commentCount, onLike, onMessage, onDelete }: {
  item: SavedSummary
  likedIds: Set<string>
  likingIds: Set<string>
  user: any
  messagingId: string | null
  commentCount: number
  onLike: (e: React.MouseEvent, item: SavedSummary) => void
  onMessage: (e: React.MouseEvent, item: SavedSummary) => void
  onDelete: (e: React.MouseEvent, item: SavedSummary) => void
}) {
  const router = useRouter()
  return (
    <div className="relative group rounded-[18px] bg-[#32302e] border border-white/5 overflow-hidden hover:border-white/20 transition-all shadow-md cursor-pointer"
      onClick={() => {
        incrementViewCount(item.id)
        router.push(`/result/${item.sessionId}?from=square`)
      }}
    >
      <div className="relative overflow-hidden bg-[#23211f]">
        <img
          src={item.thumbnail}
          alt={item.title}
          className="w-full object-cover aspect-video group-hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-sm text-[9px] font-bold text-white border border-white/10">
          {CATEGORIES.find(c => c.id === item.category)?.label ?? '분석됨'}
        </div>
      </div>

      <div className="p-2.5 pb-9">
        <h3 className="text-[#f4f4f5] text-[11px] font-bold leading-snug line-clamp-2 mb-2">
          {item.title}
        </h3>
        <div className="flex items-center justify-between">
          <Link
            href={`/profile/${item.userId}`}
            onClick={e => e.stopPropagation()}
            className="flex items-center gap-1 min-w-0 group/profile relative z-10"
          >
            {item.userPhotoURL ? (
              <img src={item.userPhotoURL} alt="" className="w-4 h-4 rounded-full shrink-0 border border-white/10" />
            ) : (
              <div className="w-4 h-4 rounded-full bg-[#3d3a38] shrink-0 flex items-center justify-center text-[8px] text-white/40">👤</div>
            )}
            <span className="text-[9px] text-[#75716e] group-hover/profile:text-white truncate transition-colors">
              {item.userDisplayName || '익명'}
            </span>
          </Link>
          <div className="flex items-center gap-1 text-[#75716e] shrink-0">
            {item.createdAt && <span className="text-[8px]">{formatRelativeDate(item.createdAt)}</span>}
            {(item.viewCount ?? 0) > 0 && <span className="text-[8px]">· 👁{item.viewCount}</span>}
          </div>
        </div>
      </div>

      <div className="absolute bottom-2 left-2.5 right-2.5 flex items-center justify-between">
        {user && item.userId === user.uid ? (
          <button
            onClick={(e) => onDelete(e, item)}
            className="flex items-center gap-0.5 text-[9px] text-[#75716e] hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
            title="삭제"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        ) : user && item.userId !== user.uid ? (
          <button
            onClick={(e) => onMessage(e, item)}
            disabled={messagingId === item.id}
            className="flex items-center gap-0.5 text-[9px] text-[#75716e] hover:text-blue-400 transition-colors disabled:opacity-50"
          >✉️</button>
        ) : <span />}

        {/* 댓글 + 좋아요 */}
        <div className="flex items-center gap-1">
          {/* 댓글 말풍선 */}
          <Link
            href={`/result/${item.sessionId}?from=square#comments`}
            onClick={e => e.stopPropagation()}
            className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] bg-black/40 text-white/40 border border-white/10 hover:text-blue-400 hover:border-blue-500/30 transition-all"
          >
            <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <span>{commentCount}</span>
          </Link>

          {/* 좋아요 */}
          <button
            onClick={(e) => onLike(e, item)}
            disabled={likingIds.has(item.id)}
            className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold transition-all ${
              likedIds.has(item.id)
                ? 'bg-pink-500/20 text-pink-400 border border-pink-500/30'
                : 'bg-black/40 text-white/40 border border-white/10 hover:text-pink-400 hover:border-pink-500/30'
            } disabled:opacity-50`}
          >
            <span className="text-[10px]">{likedIds.has(item.id) ? '❤️' : '🤍'}</span>
            <span>{item.likeCount ?? 0}</span>
          </button>
        </div>
      </div>
    </div>
  )
}

// 매거진 게시판
function MagazineBoard({ posts }: { posts: CuratedPost[] }) {
  if (posts.length === 0) {
    return (
      <div className="bg-[#32302e]/50 rounded-[32px] p-16 text-center border border-white/5">
        <span className="text-4xl mb-4 block">✍️</span>
        <h2 className="text-xl text-white font-bold mb-2">아직 발행된 매거진이 없습니다</h2>
        <p className="text-[#75716e] text-sm">AI가 영상들을 분석해 블로그 포스트를 자동으로 작성합니다.</p>
      </div>
    )
  }

  const [featured, ...rest] = posts

  return (
    <div className="space-y-4">
      {/* 피처드 — 첫 번째 글을 크게 */}
      <Link
        href={`/magazine/${featured.slug}`}
        className="group block rounded-2xl overflow-hidden bg-[#32302e] border border-white/5 hover:border-white/20 transition-all shadow-md"
      >
        {featured.heroThumbnail && !featured.heroThumbnail.startsWith('data:') ? (
          <div className="relative overflow-hidden h-52 sm:h-64 bg-[#23211f]">
            <img
              src={featured.heroThumbnail}
              alt={featured.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-500/90 text-white">✍️ 매거진</span>
                <span className="text-[10px] text-white/60">{featured.readTime}분 읽기 · 영상 {featured.videoTitles?.length ?? 0}개</span>
              </div>
              <h2 className="text-white text-lg sm:text-xl font-black leading-tight line-clamp-2 mb-1">{featured.title}</h2>
              {featured.subtitle && <p className="text-white/70 text-sm line-clamp-1">{featured.subtitle}</p>}
            </div>
          </div>
        ) : (
          <div className="p-5">
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-500/20 text-orange-400 border border-orange-500/30">✍️ 매거진</span>
              <span className="text-[10px] text-[#75716e]">{featured.readTime}분 읽기 · 영상 {featured.videoTitles?.length ?? 0}개</span>
            </div>
            <h2 className="text-white text-lg font-black leading-tight line-clamp-2 mb-1">{featured.title}</h2>
            {featured.subtitle && <p className="text-[#a4a09c] text-sm line-clamp-2">{featured.subtitle}</p>}
          </div>
        )}
        {(featured.seoDescription || featured.subtitle) && (
          <div className="px-4 py-3">
            <p className="text-[#a4a09c] text-[13px] leading-relaxed line-clamp-2">
              {featured.seoDescription || featured.subtitle}
            </p>
            <div className="flex items-center gap-2 mt-2">
              {featured.tags?.slice(0, 4).map(tag => (
                <span key={tag} className="text-[10px] text-[#75716e] bg-white/5 px-1.5 py-0.5 rounded">#{tag}</span>
              ))}
              {featured.publishedAt && (
                <span className="text-[10px] text-[#75716e] ml-auto">
                  {new Intl.DateTimeFormat('ko-KR', { month: 'short', day: 'numeric' }).format(new Date(featured.publishedAt))}
                </span>
              )}
            </div>
          </div>
        )}
      </Link>

      {/* 나머지 글 — 목록형 */}
      {rest.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {rest.map(post => (
            <Link
              key={post.id}
              href={`/magazine/${post.slug}`}
              className="group flex gap-3 rounded-xl bg-[#32302e] border border-white/5 hover:border-white/20 transition-all shadow-sm p-3"
            >
              {post.heroThumbnail && !post.heroThumbnail.startsWith('data:') && (
                <div className="relative shrink-0 w-24 h-16 rounded-lg overflow-hidden bg-[#23211f]">
                  <img src={post.heroThumbnail} alt={post.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-[9px] font-bold text-orange-400">✍️ 매거진</span>
                  <span className="text-[9px] text-[#75716e]">{post.readTime}분 · {post.videoTitles?.length ?? 0}개 영상</span>
                </div>
                <h3 className="text-[#f4f4f5] text-[12px] font-bold leading-snug line-clamp-2 mb-1">{post.title}</h3>
                <p className="text-[10px] text-[#75716e] line-clamp-1">{post.seoDescription || post.subtitle}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

// 목록형 행
function SummaryListRow({ item, likedIds, likingIds, user, messagingId, commentCount, onLike, onMessage, onDelete }: {
  item: SavedSummary
  likedIds: Set<string>
  likingIds: Set<string>
  user: any
  messagingId: string | null
  commentCount: number
  onLike: (e: React.MouseEvent, item: SavedSummary) => void
  onMessage: (e: React.MouseEvent, item: SavedSummary) => void
  onDelete: (e: React.MouseEvent, item: SavedSummary) => void
}) {
  const router = useRouter()
  const catMeta = CATEGORY_META[item.category]
  const catLabel = CATEGORIES.find(c => c.id === item.category)?.label ?? '분석됨'

  return (
    <div
      className="flex gap-3 rounded-[14px] bg-[#32302e] border border-white/5 hover:border-white/20 transition-all shadow-sm cursor-pointer p-2.5"
      onClick={() => { incrementViewCount(item.id); router.push(`/result/${item.sessionId}?from=square`) }}
    >
      {/* 썸네일 */}
      <div className="relative shrink-0 w-28 sm:w-36 rounded-lg overflow-hidden bg-[#23211f] aspect-video self-start">
        <img src={item.thumbnail} alt={item.title} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
      </div>

      {/* 내용 */}
      <div className="flex-1 min-w-0 flex flex-col justify-between gap-1 py-0.5">
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <span
              className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
              style={catMeta ? { color: catMeta.color, background: `${catMeta.bg}cc` } : { color: '#a4a09c', background: '#3d3a38' }}
            >{catLabel}</span>
            {item.createdAt && <span className="text-[9px] text-[#75716e]">{formatRelativeDate(item.createdAt)}</span>}
          </div>
          <h3 className="text-[#f4f4f5] text-[12px] sm:text-[13px] font-bold leading-snug line-clamp-2 mb-1">
            {item.title}
          </h3>
          {item.contextSummary ? (
            <p className="text-[10px] sm:text-[11px] text-[#a4a09c] leading-relaxed line-clamp-2">{item.contextSummary}</p>
          ) : (
            <p className="text-[10px] text-[#75716e]">{item.channel}</p>
          )}
        </div>

        {/* 하단 액션 */}
        <div className="flex items-center justify-between mt-1">
          <Link
            href={`/profile/${item.userId}`}
            onClick={e => e.stopPropagation()}
            className="flex items-center gap-1 min-w-0 group/profile"
          >
            {item.userPhotoURL ? (
              <img src={item.userPhotoURL} alt="" className="w-4 h-4 rounded-full shrink-0 border border-white/10" />
            ) : (
              <div className="w-4 h-4 rounded-full bg-[#3d3a38] shrink-0 flex items-center justify-center text-[8px] text-white/40">👤</div>
            )}
            <span className="text-[9px] text-[#75716e] group-hover/profile:text-white truncate transition-colors">
              {item.userDisplayName || '익명'}
            </span>
          </Link>

          <div className="flex items-center gap-1.5">
            {(item.viewCount ?? 0) > 0 && (
              <span className="text-[9px] text-[#75716e]">👁 {item.viewCount}</span>
            )}
            <Link
              href={`/result/${item.sessionId}?from=square#comments`}
              onClick={e => e.stopPropagation()}
              className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] bg-black/40 text-white/40 border border-white/10 hover:text-blue-400 hover:border-blue-500/30 transition-all"
            >
              <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <span>{commentCount}</span>
            </Link>
            <button
              onClick={(e) => onLike(e, item)}
              disabled={likingIds.has(item.id)}
              className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold transition-all ${
                likedIds.has(item.id)
                  ? 'bg-pink-500/20 text-pink-400 border border-pink-500/30'
                  : 'bg-black/40 text-white/40 border border-white/10 hover:text-pink-400 hover:border-pink-500/30'
              } disabled:opacity-50`}
            >
              <span className="text-[10px]">{likedIds.has(item.id) ? '❤️' : '🤍'}</span>
              <span>{item.likeCount ?? 0}</span>
            </button>
            {user && item.userId === user.uid ? (
              <button
                onClick={(e) => onDelete(e, item)}
                className="text-[9px] text-[#75716e] hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                title="삭제"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            ) : user && item.userId !== user.uid ? (
              <button
                onClick={(e) => onMessage(e, item)}
                disabled={messagingId === item.id}
                className="text-[9px] text-[#75716e] hover:text-blue-400 transition-colors disabled:opacity-50"
              >✉️</button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

// 취향 추천 카드 — 일반 카드와 동일한 크기, masonry 그리드 안에 삽입
function RecommendationCard({ slot }: { slot: RecSlot }) {
  const meta = CATEGORY_META[slot.category] ?? CATEGORY_META.news
  const catLabel = CATEGORIES.find(c => c.id === slot.category)?.label ?? slot.category
  const thumbs = slot.items.slice(0, 4)

  return (
    <div
      className="rounded-[18px] overflow-hidden border shadow-md"
      style={{ borderColor: `${meta.color}44`, background: `${meta.bg}dd` }}
    >
      {/* 헤더 */}
      <div className="flex items-center gap-2 px-3 pt-3 pb-2">
        <span className="text-sm leading-none">{meta.emoji}</span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold leading-tight" style={{ color: meta.color }}>
            {slot.personalized ? `${catLabel} 취향 추천` : `${catLabel} 인기 콘텐츠`}
          </p>
          <p className="text-[9px] text-white/40">
            {slot.personalized ? 'AI가 고른 콘텐츠' : '지금 인기있는 콘텐츠'}
          </p>
        </div>
      </div>

      {/* 썸네일 2×2 */}
      <div className="px-2.5 pb-2.5 grid grid-cols-2 gap-1">
        {thumbs.map(item => (
          <Link
            key={item.id}
            href={`/result/${item.sessionId}?from=square`}
            onClick={() => incrementViewCount(item.id)}
            className="rounded-lg overflow-hidden group"
            title={item.title}
          >
            <div className="relative overflow-hidden bg-[#32302e]">
              <img
                src={item.thumbnail}
                alt={item.title}
                className="w-full aspect-video object-cover group-hover:scale-105 transition-transform duration-300"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
            </div>
            <p className="text-[8px] text-white/60 leading-snug line-clamp-1 px-1 pt-0.5 pb-1">
              {item.title}
            </p>
          </Link>
        ))}
      </div>
    </div>
  )
}

// 광고 카드 — 일반 카드 사이즈, 나중에 실제 광고 SDK로 교체
function AdCard({ slot }: { slot: AdSlotItem }) {
  const hasAdsense = !!process.env.NEXT_PUBLIC_ADSENSE_CLIENT
  if (hasAdsense) {
    return (
      <div key={slot.slotId} className="rounded-[18px] overflow-hidden">
        <AdBanner adSlot="SQUARE_CARD" adFormat="rectangle" />
      </div>
    )
  }
  // AdSense 미설정 시 플레이스홀더
  return (
    <div
      key={slot.slotId}
      className="rounded-[18px] border border-dashed border-white/10 bg-[#32302e]/40 flex flex-col items-center justify-center gap-2 aspect-[4/3] text-[#75716e]"
    >
      <span className="text-2xl opacity-30">📢</span>
      <span className="text-[9px] opacity-30 tracking-widest uppercase">AD</span>
    </div>
  )
}

export default function SquareClient({ initialSummaries = [], initialMagazinePosts = [] }: {
  initialSummaries?: SavedSummary[]
  initialMagazinePosts?: CuratedPost[]
}) {
  const { user } = useAuth()
  const router = useRouter()
  const [summaries, setSummaries] = useState<SavedSummary[]>(initialSummaries)
  const [allSummaries, setAllSummaries] = useState<SavedSummary[]>(initialSummaries)
  const [magazinePosts, setMagazinePosts] = useState<CuratedPost[]>(initialMagazinePosts)
  const [loading, setLoading] = useState(initialSummaries.length === 0)
  const [activeCategory, setActiveCategory] = useState('all')
  const [sortType, setSortType] = useState<SortType>('latest')
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set())
  const [likingIds, setLikingIds] = useState<Set<string>>(new Set())
  const [messagingId, setMessagingId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [committedQuery, setCommittedQuery] = useState('')
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({})
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window !== 'undefined') return (localStorage.getItem('squareViewMode') as ViewMode) ?? 'grid'
    return 'grid'
  })
  const [activeTab, setActiveTab] = useState<'feed' | 'magazine'>('feed')
  const colCount = useColumnCount()

  const toggleViewMode = (mode: ViewMode) => {
    setViewMode(mode)
    localStorage.setItem('squareViewMode', mode)
  }

  useEffect(() => {
    // 서버 초기 데이터가 있으면 댓글 수만 보완, 없으면 전체 로드
    if (initialSummaries.length > 0) {
      const sessionIds = [...new Set(initialSummaries.map(s => s.sessionId))]
      getCommentCountsBySessionIds(sessionIds).then(setCommentCounts).catch(() => {})
      // 좋아요 등 실시간 데이터는 백그라운드 갱신
      getPublicSummaries().then(data => {
        setSummaries(data)
        setAllSummaries(data)
      }).catch(() => {})
      return
    }
    Promise.all([
      getPublicSummaries(),
      getPublishedPosts(10),
    ]).then(([data, posts]) => {
      setSummaries(data)
      setAllSummaries(data)
      setMagazinePosts(posts)
      const sessionIds = [...new Set(data.map(s => s.sessionId))]
      getCommentCountsBySessionIds(sessionIds).then(setCommentCounts).catch(() => {})
    }).catch(e => console.error('Failed to load square data:', e))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!user) { setLikedIds(new Set()); return }
    getUserLikedIds(user.uid).then(setLikedIds).catch(() => {})
  }, [user])

  const handleMessage = async (e: React.MouseEvent, item: SavedSummary) => {
    e.preventDefault(); e.stopPropagation()
    if (!user) { alert('쪽지는 로그인 후 이용할 수 있습니다.'); return }
    if (item.userId === user.uid) return
    if (messagingId) return
    setMessagingId(item.id)
    try {
      const cid = await getOrCreateConversation(
        user.uid,
        { displayName: user.displayName || '', photoURL: user.photoURL || '' },
        item.userId,
        { displayName: item.userDisplayName || '익명', photoURL: item.userPhotoURL || '' }
      )
      router.push(`/messages/${cid}`)
    } catch { alert('오류가 발생했습니다.') }
    finally { setMessagingId(null) }
  }

  const handleDelete = async (e: React.MouseEvent, item: SavedSummary) => {
    e.preventDefault(); e.stopPropagation()
    if (!user || user.uid !== item.userId) return
    if (!confirm(`스퀘어에서 이 카드를 내립니다.\n내 마이페이지에는 그대로 유지됩니다.`)) return
    try {
      await updateSummaryVisibility(item.id, false)
      setSummaries(prev => prev.filter(s => s.id !== item.id))
      setAllSummaries(prev => prev.filter(s => s.id !== item.id))
    } catch {
      alert('삭제에 실패했습니다.')
    }
  }

  const handleLike = async (e: React.MouseEvent, item: SavedSummary) => {
    e.preventDefault()
    e.stopPropagation()
    if (!user) { alert('좋아요는 로그인 후 이용할 수 있습니다.'); return }
    if (likingIds.has(item.id)) return

    setLikingIds(prev => new Set(prev).add(item.id))
    const wasLiked = likedIds.has(item.id)

    setLikedIds(prev => {
      const next = new Set(prev)
      wasLiked ? next.delete(item.id) : next.add(item.id)
      return next
    })
    setSummaries(prev => prev.map(s =>
      s.id === item.id ? { ...s, likeCount: (s.likeCount ?? 0) + (wasLiked ? -1 : 1) } : s
    ))

    try {
      await toggleLike(user.uid, item.id)
    } catch {
      setLikedIds(prev => {
        const next = new Set(prev)
        wasLiked ? next.add(item.id) : next.delete(item.id)
        return next
      })
      setSummaries(prev => prev.map(s =>
        s.id === item.id ? { ...s, likeCount: (s.likeCount ?? 0) + (wasLiked ? 1 : -1) } : s
      ))
    } finally {
      setLikingIds(prev => { const next = new Set(prev); next.delete(item.id); return next })
    }
  }

  const categoryFiltered = summaries
    .filter(s => activeCategory === 'all' || s.category === activeCategory)

  const searched = committedQuery.trim()
    ? naturalSearch(
        categoryFiltered.map(s => ({
          ...s,
          categoryLabel: CATEGORIES.find(c => c.id === s.category)?.label ?? s.category,
          tags: s.square_meta?.tags ?? [],
          topicCluster: s.square_meta?.topic_cluster ?? '',
        })),
        committedQuery,
      )
    : categoryFiltered

  const handleSearch = () => {
    setCommittedQuery(searchQuery)
  }
  const handleClear = () => {
    setSearchQuery('')
    setCommittedQuery('')
  }

  const getMs = (v: any) => {
    if (typeof v === 'number') return v
    return v?.toMillis?.() ?? v?.getTime?.() ?? (v?.seconds ? v.seconds * 1000 : 0)
  }

  const filtered = searched
    .sort((a, b) => {
      if (sortType === 'popular') return (b.likeCount ?? 0) - (a.likeCount ?? 0)
      if (sortType === 'views')   return (b.viewCount ?? 0) - (a.viewCount ?? 0)
      return getMs(b.createdAt) - getMs(a.createdAt)
    })

  const topCategories = useMemo(
    () => getUserTopCategories(likedIds, allSummaries),
    [likedIds, allSummaries]
  )

  // 좋아요 기반 카테고리, 없으면 전체 카테고리 순환 (폴백)
  const ALL_CATS = Object.keys(CATEGORY_META)
  const effectiveCats = topCategories.length > 0 ? topCategories : ALL_CATS
  const isPersonalized = topCategories.length > 0

  const recommendationPool = useMemo(() => {
    const pool: Record<string, SavedSummary[]> = {}
    for (const cat of effectiveCats) {
      pool[cat] = allSummaries
        .filter(s => s.category === cat && !likedIds.has(s.id))
        .sort((a, b) => (b.likeCount ?? 0) - (a.likeCount ?? 0))
        .slice(0, 4)  // 최대 4개 (2×2 그리드용)
    }
    return pool
  }, [effectiveCats, allSummaries, likedIds])

  // 일반 카드 + 추천 + 광고 + 매거진 카드를 flat 배열로 합성
  const gridItems = useMemo<GridItem[]>(() => {
    const result: GridItem[] = []
    let recIndex = 0
    let adIndex = 0
    let magIndex = 0

    filtered.forEach((item, i) => {
      result.push(item)

      const pos = i + 1

      // 매거진 슬롯: MAGAZINE_INTERVAL 마다
      if (pos % MAGAZINE_INTERVAL === 0 && magazinePosts.length > 0) {
        const post = magazinePosts[magIndex % magazinePosts.length]
        result.push({ __mag: true, slotId: `mag-${magIndex}`, post })
        magIndex++
      }

      // 추천 슬롯
      if (pos % RECOMMENDATION_INTERVAL === 0 && effectiveCats.length > 0) {
        let inserted = false
        for (let attempt = 0; attempt < effectiveCats.length; attempt++) {
          const cat = effectiveCats[(recIndex + attempt) % effectiveCats.length]
          const pool = recommendationPool[cat] ?? []
          if (pool.length >= 2) {
            result.push({ __rec: true, slotId: `rec-${cat}-${pos}`, category: cat, items: pool, personalized: isPersonalized })
            recIndex += attempt + 1
            inserted = true
            break
          }
        }
        if (!inserted) recIndex++
      }

      // 광고 슬롯
      if (pos % AD_INTERVAL === 0) {
        result.push({ __ad: true, slotId: `ad-${adIndex++}` })
      }
    })

    return result
  }, [filtered, effectiveCats, isPersonalized, recommendationPool, magazinePosts])

  // flat 배열 → N열에 행 우선(좌→우) 순서로 분배
  // CSS columns는 열 우선이라 추천/광고 카드 위치가 틀어지므로, 직접 분배
  const columns = useMemo<GridItem[][]>(() => {
    const cols: GridItem[][] = Array.from({ length: colCount }, () => [])
    gridItems.forEach((item, i) => cols[i % colCount].push(item))
    return cols
  }, [gridItems, colCount])

  return (
    <div className="min-h-screen bg-[#252423] font-sans">
      <Header title="🎬 Next Curator" />

      <div className="max-w-7xl mx-auto px-3 pb-12">

        {/* 탭 바 */}
        <div className="flex items-center gap-1 mb-5 border-b border-white/8">
          <button
            onClick={() => setActiveTab('feed')}
            className={`px-4 py-2.5 text-sm font-bold transition-all border-b-2 -mb-px ${
              activeTab === 'feed'
                ? 'border-orange-500 text-white'
                : 'border-transparent text-[#75716e] hover:text-white'
            }`}
          >
            피드
          </button>
          <button
            onClick={() => setActiveTab('magazine')}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-bold transition-all border-b-2 -mb-px ${
              activeTab === 'magazine'
                ? 'border-orange-500 text-white'
                : 'border-transparent text-[#75716e] hover:text-white'
            }`}
          >
            ✍️ 매거진
            {magazinePosts.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-orange-500/20 text-orange-400 border border-orange-500/30">
                {magazinePosts.length}
              </span>
            )}
          </button>
        </div>

        {activeTab === 'magazine' ? (
          <MagazineBoard posts={magazinePosts} />
        ) : (
        <>

        {/* 검색창 */}
        <div className="flex gap-2 mb-3">
          <div className="relative flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSearch() }}
              placeholder="검색어 입력 후 버튼을 누르세요 (예: 당근 요리, 영어 발음 팁)"
              className={`w-full h-10 pl-9 pr-8 bg-[#32302e] border rounded-xl text-sm text-white placeholder:text-[#75716e] focus:outline-none transition-colors ${
                committedQuery ? 'border-orange-500/50' : 'border-white/10 focus:border-orange-500/40'
              }`}
            />
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#75716e]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {(searchQuery || committedQuery) && (
              <button
                onClick={handleClear}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#75716e] hover:text-white text-xs"
              >✕</button>
            )}
          </div>
          <button
            onClick={handleSearch}
            className="h-10 px-4 bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold rounded-xl transition-colors shrink-0"
          >
            검색
          </button>
        </div>

        {/* 필터 바 */}
        <div className="flex flex-col gap-2 mb-5">
          <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
            {CATEGORIES.map(cat => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  activeCategory === cat.id
                    ? 'bg-orange-500 text-white'
                    : 'bg-[#32302e] text-[#a4a09c] hover:text-white'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            {(['latest', 'popular', 'views'] as SortType[]).map(type => {
              const labels: Record<SortType, string> = { latest: '최신순', popular: '인기순', views: '조회수순' }
              return (
                <button
                  key={type}
                  onClick={() => setSortType(type)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                    sortType === type
                      ? 'bg-white text-black'
                      : 'bg-[#32302e] text-[#a4a09c] hover:text-white'
                  }`}
                >
                  {labels[type]}
                </button>
              )
            })}
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-[#75716e] text-xs">
                {committedQuery ? `"${committedQuery}" 결과 ${filtered.length}개` : `${filtered.length}개`}
              </span>
              {/* 뷰 모드 토글 */}
              <div className="flex items-center gap-0.5 bg-[#32302e] rounded-lg p-0.5">
                <button
                  onClick={() => toggleViewMode('grid')}
                  title="그리드 보기"
                  className={`p-1.5 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-white/10 text-white' : 'text-[#75716e] hover:text-white'}`}
                >
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 16 16">
                    <rect x="1" y="1" width="6" height="6" rx="1"/><rect x="9" y="1" width="6" height="6" rx="1"/>
                    <rect x="1" y="9" width="6" height="6" rx="1"/><rect x="9" y="9" width="6" height="6" rx="1"/>
                  </svg>
                </button>
                <button
                  onClick={() => toggleViewMode('list')}
                  title="목록 보기"
                  className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-white/10 text-white' : 'text-[#75716e] hover:text-white'}`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 16 16">
                    <line x1="2" y1="4" x2="14" y2="4"/><line x1="2" y1="8" x2="14" y2="8"/><line x1="2" y1="12" x2="14" y2="12"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 피드 */}
        {loading ? (
          <div className="flex items-center justify-center py-32">
            <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-pink-500" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-[#32302e]/50 rounded-[32px] p-16 text-center border border-white/5">
            <span className="text-4xl mb-4 block">🌍</span>
            <h2 className="text-xl text-white font-bold mb-2">
              {activeCategory === 'all' ? '아직 공개된 요약이 없습니다' : '해당 카테고리의 요약이 없습니다'}
            </h2>
            <Link href="/" className="inline-block mt-6 px-6 py-3 bg-gradient-to-r from-orange-500 to-pink-500 text-white font-bold rounded-2xl">
              새 영상 분석하기
            </Link>
          </div>
        ) : viewMode === 'list' ? (
          <div className="flex flex-col gap-2">
            {filtered.map(item => (
              <SummaryListRow
                key={item.id}
                item={item}
                likedIds={likedIds}
                likingIds={likingIds}
                user={user}
                messagingId={messagingId}
                commentCount={commentCounts[item.sessionId] ?? 0}
                onLike={handleLike}
                onMessage={handleMessage}
                onDelete={handleDelete}
              />
            ))}
          </div>
        ) : (
          <div className="flex gap-3 items-start">
            {columns.map((col, ci) => (
              <div key={ci} className="flex-1 flex flex-col gap-3 min-w-0">
                {col.map(item => {
                  if ('__mag' in item) return <MagazineCard key={item.slotId} post={item.post} />
                  if ('__rec' in item) return <RecommendationCard key={item.slotId} slot={item} />
                  if ('__ad'  in item) return <AdCard key={item.slotId} slot={item} />
                  return (
                    <SummaryCard
                      key={item.id}
                      item={item}
                      likedIds={likedIds}
                      likingIds={likingIds}
                      user={user}
                      messagingId={messagingId}
                      commentCount={commentCounts[item.sessionId] ?? 0}
                      onLike={handleLike}
                      onMessage={handleMessage}
                      onDelete={handleDelete}
                    />
                  )
                })}
              </div>
            ))}
          </div>
        )}
        </> {/* feed tab end */}
        )}
      </div>

      <FloatingChat summaries={allSummaries} source="square" />
    </div>
  )
}
