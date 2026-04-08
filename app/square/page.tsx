'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Header from '@/components/common/Header'
import { getPublicSummaries, toggleLike, getUserLikedIds, incrementViewCount, getOrCreateConversation, SavedSummary } from '@/lib/db'
import { useAuth } from '@/providers/AuthProvider'
import { formatRelativeDate } from '@/lib/formatDate'
import { useRouter } from 'next/navigation'

const CATEGORIES = [
  { id: 'all',     label: '전체' },
  { id: 'recipe',  label: '🍳 요리' },
  { id: 'english', label: '🔤 영어' },
  { id: 'learning',label: '📐 학습' },
  { id: 'news',    label: '🗞️ 뉴스' },
  { id: 'selfdev', label: '💪 자기계발' },
  { id: 'travel',  label: '🧳 여행' },
  { id: 'story',   label: '🍿 스토리' },
]

type SortType = 'latest' | 'popular' | 'views'

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
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    getPublicSummaries()
      .then(data => { setSummaries(data); setAllSummaries(data) })
      .catch(e => console.error('Failed to load square data:', e))
      .finally(() => setLoading(false))
  }, [])

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchQuery.trim()) { setSummaries(allSummaries); return }
    setSearching(true)
    try {
      const payload = allSummaries.map(s => ({
        id: s.id,
        title: s.title,
        category: s.category,
        tags: s.square_meta?.tags ?? [],
        topic_cluster: s.square_meta?.topic_cluster ?? '',
        vibe: s.square_meta?.vibe ?? '',
      }))
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery, summaries: payload }),
      })
      const { results } = await res.json()
      const ordered = results
        .map((id: string) => allSummaries.find(s => s.id === id))
        .filter(Boolean) as SavedSummary[]
      setSummaries(ordered)
    } catch {
      alert('검색에 실패했습니다.')
    } finally {
      setSearching(false)
    }
  }

  const handleClearSearch = () => {
    setSearchQuery('')
    setSummaries(allSummaries)
  }

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
    if (!user) {
      alert('좋아요는 로그인 후 이용할 수 있습니다.')
      return
    }
    if (likingIds.has(item.id)) return

    setLikingIds(prev => new Set(prev).add(item.id))
    const wasLiked = likedIds.has(item.id)

    // 낙관적 업데이트
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
      // 롤백
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

  return (
    <div className="min-h-screen bg-[#252423] font-sans">
      <Header title="🎬 Next Curator" />

      <div className="max-w-7xl mx-auto px-3 pb-12">

        {/* AI 검색 바 */}
        <div className="mb-4">
          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="자연어로 검색... (예: 초보용 요리 영상 추천해줘)"
              className="flex-1 h-10 px-4 bg-[#32302e] border border-white/10 rounded-xl text-sm text-white placeholder:text-[#75716e] focus:outline-none focus:border-orange-500/50 transition-colors"
            />
            {searchQuery && (
              <button type="button" onClick={handleClearSearch} className="h-10 px-3 bg-[#32302e] border border-white/10 rounded-xl text-[#75716e] hover:text-white transition-colors text-sm">
                ✕
              </button>
            )}
            <button
              type="submit"
              disabled={searching || !searchQuery.trim()}
              className="h-10 px-4 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-sm disabled:opacity-40 transition-colors whitespace-nowrap"
            >
              {searching ? '검색 중...' : '🔍'}
            </button>
          </form>
        </div>

        {/* 필터 바 */}
        <div className="flex flex-col gap-2 mb-5">
          {/* 카테고리 탭 */}
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

          {/* 정렬 버튼 */}
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

        {/* 카드 그리드 */}
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
          // columns-2: 자연스러운 masonry 효과 (카드 높이 차이로 좌2우1, 좌1우2 번갈아 보임)
          <div className="columns-2 md:columns-3 lg:columns-4 gap-3 space-y-3">
            {filtered.map(item => (
              <div key={item.id} className="break-inside-avoid relative group">
                <Link
                  href={`/result/${item.sessionId}`}
                  onClick={() => incrementViewCount(item.id)}
                  className="block rounded-[18px] bg-[#32302e] border border-white/5 overflow-hidden hover:border-white/20 transition-all shadow-md"
                >
                  {/* 썸네일 */}
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

                  {/* 콘텐츠 */}
                  <div className="p-2.5 pb-9">
                    <h3 className="text-[#f4f4f5] text-[11px] font-bold leading-snug line-clamp-2 mb-2">
                      {item.title}
                    </h3>

                    {/* 프로필 행 */}
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
                        {item.createdAt && (
                          <span className="text-[8px]">{formatRelativeDate(item.createdAt)}</span>
                        )}
                        {(item.viewCount ?? 0) > 0 && (
                          <span className="text-[8px]">· 👁{item.viewCount}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>

                {/* 하단 버튼 행 */}
                <div className="absolute bottom-2 left-2.5 right-2.5 flex items-center justify-between">
                  {/* 쪽지 버튼 */}
                  {user && item.userId !== user.uid ? (
                    <button
                      onClick={(e) => handleMessage(e, item)}
                      disabled={messagingId === item.id}
                      className="flex items-center gap-0.5 text-[9px] text-[#75716e] hover:text-blue-400 transition-colors disabled:opacity-50"
                    >
                      ✉️
                    </button>
                  ) : <span />}

                  {/* 하트 버튼 */}
                  <button
                    onClick={(e) => handleLike(e, item)}
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
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
