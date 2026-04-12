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
  personalized: boolean  // true: 좋아요 기반 / false: 인기 폴백
}
type AdSlotItem = {
  __ad: true
  slotId: string
}
type GridItem = SavedSummary | RecSlot | AdSlotItem

const RECOMMENDATION_INTERVAL = 9  // 카드 N개마다 추천 1개 삽입
const AD_INTERVAL = 13              // 카드 N개마다 광고 1개 삽입 (추천과 겹치지 않게 소수)

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
  return (
    <div className="relative group">
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
  const [searchQuery, setSearchQuery] = useState('')
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({})
  const colCount = useColumnCount()

  useEffect(() => {
    getPublicSummaries()
      .then(data => {
        setSummaries(data)
        setAllSummaries(data)
        // 댓글 수 비동기 로드 (카드 렌더링 차단 안 함)
        const sessionIds = [...new Set(data.map(s => s.sessionId))]
        getCommentCountsBySessionIds(sessionIds)
          .then(setCommentCounts)
          .catch(() => {})
      })
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

  const filtered = summaries
    .filter(s => activeCategory === 'all' || s.category === activeCategory)
    .filter(s => {
      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase()
      const tags = (s.square_meta?.tags ?? []).join(' ').toLowerCase()
      const catLabel = (CATEGORIES.find(c => c.id === s.category)?.label ?? '').toLowerCase()
      return s.title.toLowerCase().includes(q) || tags.includes(q) || catLabel.includes(q)
    })
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

  // 일반 카드 + 추천 카드 + 광고 카드를 flat 배열로 합성 — masonry가 자연스럽게 흐름
  const gridItems = useMemo<GridItem[]>(() => {
    const result: GridItem[] = []
    let recIndex = 0
    let adIndex = 0

    filtered.forEach((item, i) => {
      result.push(item)

      const pos = i + 1  // 1-based 위치

      // 추천 슬롯: RECOMMENDATION_INTERVAL 마다
      if (pos % RECOMMENDATION_INTERVAL === 0 && effectiveCats.length > 0) {
        // pool이 부족한 카테고리는 건너뛰며 순환 (recIndex 고착 방지)
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
        if (!inserted) recIndex++  // 모든 카테고리 부족 시에도 다음 순환으로 이동
      }

      // 광고 슬롯: AD_INTERVAL 마다 (추천과 같은 위치면 다음 칸으로 밀림)
      if (pos % AD_INTERVAL === 0) {
        result.push({ __ad: true, slotId: `ad-${adIndex++}` })
      }
    })

    return result
  }, [filtered, effectiveCats, isPersonalized, recommendationPool])

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

        {/* 검색창 */}
        <div className="relative mb-3">
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="제목, 태그, 카테고리로 검색..."
            className="w-full h-10 pl-9 pr-4 bg-[#32302e] border border-white/10 rounded-xl text-sm text-white placeholder:text-[#75716e] focus:outline-none focus:border-orange-500/50 transition-colors"
          />
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#75716e]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#75716e] hover:text-white text-xs"
            >✕</button>
          )}
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
            <span className="text-[#75716e] text-xs ml-auto">
              {searchQuery ? `"${searchQuery}" 결과 ${filtered.length}개` : `${filtered.length}개`}
            </span>
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
          <div className="flex gap-3 items-start">
            {columns.map((col, ci) => (
              <div key={ci} className="flex-1 flex flex-col gap-3 min-w-0">
                {col.map(item => {
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
      </div>

      <FloatingChat summaries={allSummaries} source="square" />
    </div>
  )
}
