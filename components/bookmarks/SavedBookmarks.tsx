'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getBookmarks, deleteBookmark, VideoBookmark } from '@/lib/videoBookmark'

export default function SavedBookmarks({ userId }: { userId: string }) {
  const [bookmarks, setBookmarks] = useState<VideoBookmark[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    if (!userId || userId.startsWith('user_')) { setLoading(false); return }
    getBookmarks(userId)
      .then(setBookmarks)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [userId])

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (!confirm('이 북마크를 삭제할까요?')) return
    try {
      await deleteBookmark(id)
      setBookmarks(prev => prev.filter(b => b.id !== id))
    } catch {
      alert('삭제에 실패했습니다.')
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 rounded-full border-2 border-yellow-500/30 border-t-yellow-500 animate-spin" />
      </div>
    )
  }

  if (bookmarks.length === 0) {
    return (
      <div className="text-center py-12 text-zinc-600">
        <p className="text-3xl mb-2">🔖</p>
        <p className="text-sm">저장된 북마크가 없습니다.</p>
        <p className="text-xs mt-1 text-zinc-700">영상 시청 중 🔖 버튼으로 중요한 부분을 저장하세요.</p>
      </div>
    )
  }

  // 영상(sessionId)별 그룹핑
  const grouped: Record<string, VideoBookmark[]> = {}
  for (const bm of bookmarks) {
    if (!grouped[bm.sessionId]) grouped[bm.sessionId] = []
    grouped[bm.sessionId].push(bm)
  }
  for (const key of Object.keys(grouped)) {
    grouped[key].sort((a, b) => a.timestampSec - b.timestampSec)
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Object.entries(grouped).map(([sessionId, items]) => {
        const first = items[0]
        return (
          <div
            key={sessionId}
            onClick={() => router.push(`/result/${sessionId}`)}
            className="group bg-[#2a2826] border border-white/8 rounded-2xl overflow-hidden cursor-pointer hover:border-yellow-500/30 hover:bg-[#2f2c2a] transition-all"
          >
            {/* 썸네일 */}
            <div className="relative w-full aspect-video bg-zinc-800 overflow-hidden">
              {first.thumbnail ? (
                <img
                  src={first.thumbnail}
                  alt={first.videoTitle}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-3xl">🎬</div>
              )}
              {/* 북마크 카운트 배지 */}
              <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 bg-black/60 backdrop-blur rounded-full">
                <span className="text-yellow-400 text-xs">🔖</span>
                <span className="text-white text-xs font-bold">{items.length}</span>
              </div>
            </div>

            {/* 영상 정보 */}
            <div className="px-3 py-3">
              <p className="text-white text-sm font-semibold leading-snug line-clamp-2 group-hover:text-yellow-400 transition-colors">
                {first.videoTitle}
              </p>
              <p className="text-zinc-500 text-xs mt-1">{first.channel}</p>

              {/* 북마크 프리뷰 (최대 2개) */}
              <div className="mt-2.5 space-y-1.5">
                {items.slice(0, 2).map(bm => (
                  <div
                    key={bm.id}
                    onClick={e => { e.stopPropagation(); router.push(`/result/${sessionId}?t=${bm.timestampLabel}`) }}
                    className="flex items-center gap-2 group/bm hover:bg-white/5 rounded-lg px-1.5 py-1 -mx-1.5 transition-colors"
                  >
                    <span className="shrink-0 font-mono text-[10px] text-yellow-400 bg-yellow-500/10 px-1.5 py-0.5 rounded border border-yellow-500/15">
                      {bm.timestampLabel}
                    </span>
                    <span className="text-zinc-400 text-xs truncate">
                      {bm.memo || <span className="italic text-zinc-600">메모 없음</span>}
                    </span>
                    <button
                      onClick={e => handleDelete(e, bm.id)}
                      className="shrink-0 ml-auto text-zinc-700 hover:text-red-400 text-xs opacity-0 group-hover/bm:opacity-100 transition-all"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                {items.length > 2 && (
                  <p className="text-zinc-600 text-xs px-1.5">
                    +{items.length - 2}개 더 보기 →
                  </p>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
