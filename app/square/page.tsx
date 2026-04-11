'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import Header from '@/components/common/Header'
import { getPublicSummaries, toggleLike, getUserLikedIds, incrementViewCount, getOrCreateConversation, SavedSummary } from '@/lib/db'
import { useAuth } from '@/providers/AuthProvider'
import { formatRelativeDate } from '@/lib/formatDate'
import { useRouter } from 'next/navigation'
import FloatingChat from '@/components/chat/FloatingChat'

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

// 추천 카드를 일반 카드와 같은 그리드 아이템으로 취급하기 위한 타입
type RecSlot = {
  __rec: true
  slotId: string
  category: string
  items: SavedSummary[]
}
type GridItem = SavedSummary | RecSlot

const RECOMMENDATION_INTERVAL = 9  // 카드 N개마다 추천 1개 삽입

type SortType = 'latest' | 'popular' | 'views'

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
function SummaryCard({ item, likedIds, likingIds, user, messagingId, onLike, onMessage }: {
  item: SavedSummary
  likedIds: Set<string>
  likingIds: Set<string>
  user: any
  messagingId: string | null
  onLike: (e: React.MouseEvent, item: SavedSummary) => void
  onMessage: (e: React.MouseEvent, item: SavedSummary) => void
}) {
  return (
    <div className="break-inside-avoid relative group mb-3">
      <Link
        href={`/result/${item.sessionId}?from=square`}
        onClick={() => incrementViewCount(item.id)}
        className="block rounded-[18px] bg-[#32302e] border border-white/5 overflow-hidden hover:border-white/20 transition-all shadow-md"
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
            <div className="flex items-center gap-1 text-[#75716e] shrink-0">
              {item.createdAt && <span className="text-[8px]">{formatRelativeDate(item.createdAt)}</span>}
              {(item.viewCount ?? 0) > 0 && <span className="text-[8px]">· 👁{item.viewCount}</span>}
            </div>
          </div>
        </div>
      </Link>

      <div className="absolute bottom-2 left-2.5 right-2.5 flex items-center justify-between">
        {user && item.userId !== user.uid ? (
          <button
            onClick={(e) => onMessage(e, item)}
            disabled={messagingId === item.id}
            className="flex items-center gap-0.5 text-[9px] text-[#75716e] hover:text-blue-400 transition-colors disabled:opacity-50"
          >✉️</button>
        ) : <span />}
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
  )
}

// 취향 추천 카드 — 일반 카드와 동일한 크기, masonry 그리드 안에 삽입
function RecommendationCard({ slot }: { slot: RecSlot }) {
  const meta = CATEGORY_META[slot.category] ?? CATEGORY_META.news
  const catLabel = CATEGORIES.find(c => c.id === slot.category)?.label ?? slot.category
  const [t1, t2, t3] = slot.items.slice(0, 3)

  return (
    <div
      className="break-inside-avoid mb-3 rounded-[18px] overflow-hidden border shadow-md"
      style={{ borderColor: `${meta.color}44`, background: `${meta.bg}dd` }}
    >
      {/* 헤더 */}
      <div className="flex items-center gap-2 px-3 pt-3 pb-2">
        <span className="text-sm leading-none">{meta.emoji}</span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold leading-tight" style={{ color: meta.color }}>
            {catLabel} 취향 추천
          </p>
          <p className="text-[9px] text-white/40">AI가 고른 콘텐츠</p>
        </div>
      </div>

      {/* 썸네일 영역: 상단 2개 / 하단 좌1 + 우 더보기 */}
      <div className="px-2.5 pb-2.5 space-y-1">
        {/* 상단 2개 */}
        <div className="grid grid-cols-2 gap-1">
          {[t1, t2].filter(Boolean).map(item => (
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

        {/* 하단: 썸네일 1개 + 더보기 */}
        <div className="grid grid-cols-2 gap-1 items-stretch">
          {t3 ? (
            <Link
              href={`/result/${t3.sessionId}?from=square`}
              onClick={() => incrementViewCount(t3.id)}
              className="rounded-lg overflow-hidden group"
              title={t3.title}
            >
              <div className="relative overflow-hidden bg-[#32302e]">
                <img
                  src={t3.thumbnail}
                  alt={t3.title}
                  className="w-full aspect-video object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
              </div>
              <p className="text-[8px] text-white/60 leading-snug line-clamp-1 px-1 pt-0.5 pb-1">
                {t3.title}
              </p>
            </Link>
          ) : <div />}

          {/* 더보기 버튼 */}
          <div className="flex items-center justify-center">
            <button
              className="w-full h-full min-h-[52px] rounded-lg flex flex-col items-center justify-center gap-1 border transition-colors hover:opacity-80 active:scale-95"
              style={{
                borderColor: `${meta.color}44`,
                background: `${meta.color}11`,
                color: meta.color,
              }}
            >
              <span className="text-base leading-none">{meta.emoji}</span>
              <span className="text-[9px] font-bold">더보기</span>
              <span className="text-[8px] opacity-60">→</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function SquarePage() {
  const { user } = useAuth()
  const router = useRouter()
  const [summaries, setSummaries] = useState<SavedSummary[]>([])
  const [allSummaries, setAllSummaries] = useState<SavedSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState('all')
  const [sortType, setSortType] = useState<SortType>('latest')
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set())
  const [likingIds, setLikingIds] = useState<Set<string>>(new Set())
  const [messagingId, setMessagingId] = useState<string | null>(null)

  useEffect(() => {
    getPublicSummaries()
      .then(data => { setSummaries(data); setAllSummaries(data) })
      .catch(e => console.error('Failed to load square data:', e))
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

  const filtered = summaries
    .filter(s => activeCategory === 'all' || s.category === activeCategory)
    .sort((a, b) => {
      if (sortType === 'popular') return (b.likeCount ?? 0) - (a.likeCount ?? 0)
      if (sortType === 'views')   return (b.viewCount ?? 0) - (a.viewCount ?? 0)
      const aT = a.createdAt?.toMillis?.() ?? 0
      const bT = b.createdAt?.toMillis?.() ?? 0
      return bT - aT
    })

  const topCategories = useMemo(
    () => getUserTopCategories(likedIds, allSummaries),
    [likedIds, allSummaries]
  )

  const recommendationPool = useMemo(() => {
    const pool: Record<string, SavedSummary[]> = {}
    for (const cat of topCategories) {
      pool[cat] = allSummaries
        .filter(s => s.category === cat && !likedIds.has(s.id))
        .sort((a, b) => (b.likeCount ?? 0) - (a.likeCount ?? 0))
        .slice(0, 8)
    }
    return pool
  }, [topCategories, allSummaries, likedIds])

  // 일반 카드 + 추천 카드를 flat 배열로 합성 — masonry가 자연스럽게 흐름
  const gridItems = useMemo<GridItem[]>(() => {
    if (topCategories.length === 0) return filtered

    const result: GridItem[] = []
    let recIndex = 0

    filtered.forEach((item, i) => {
      result.push(item)

      // N개마다 추천 슬롯 1개 끼워 넣기
      if ((i + 1) % RECOMMENDATION_INTERVAL === 0) {
        const cat = topCategories[recIndex % topCategories.length]
        const pool = recommendationPool[cat] ?? []
        if (pool.length >= 2) {
          result.push({ __rec: true, slotId: `rec-${cat}-${i}`, category: cat, items: pool })
          recIndex++
        }
      }
    })

    return result
  }, [filtered, topCategories, recommendationPool])

  return (
    <div className="min-h-screen bg-[#252423] font-sans">
      <Header title="🎬 Next Curator" />

      <div className="max-w-7xl mx-auto px-3 pb-12">

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
            <span className="text-[#75716e] text-xs ml-auto">{filtered.length}개</span>
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
        ) : (
          <div className="columns-2 md:columns-3 lg:columns-4 gap-3">
            {gridItems.map(item =>
              '__rec' in item ? (
                <RecommendationCard key={item.slotId} slot={item} />
              ) : (
                <SummaryCard
                  key={item.id}
                  item={item}
                  likedIds={likedIds}
                  likingIds={likingIds}
                  user={user}
                  messagingId={messagingId}
                  onLike={handleLike}
                  onMessage={handleMessage}
                />
              )
            )}
          </div>
        )}
      </div>

      <FloatingChat summaries={allSummaries} source="square" />
    </div>
  )
}
