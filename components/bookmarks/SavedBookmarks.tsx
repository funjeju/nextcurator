'use client'

import { useEffect, useState } from 'react'
import { getBookmarks, deleteBookmark, VideoBookmark } from '@/lib/videoBookmark'
import Link from 'next/link'

export default function SavedBookmarks({ userId }: { userId: string }) {
  const [bookmarks, setBookmarks] = useState<VideoBookmark[]>([])
  const [loading, setLoading] = useState(true)

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

  // 영상별로 그룹화
  const grouped: Record<string, VideoBookmark[]> = {}
  for (const bm of bookmarks) {
    const key = bm.sessionId
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(bm)
  }
  // 그룹 내 타임스탬프 오름차순 정렬
  for (const key of Object.keys(grouped)) {
    grouped[key].sort((a, b) => a.timestampSec - b.timestampSec)
  }

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([sessionId, items]) => {
        const first = items[0]
        return (
          <div key={sessionId} className="bg-[#2a2826] border border-white/8 rounded-2xl overflow-hidden">
            {/* 영상 헤더 */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5">
              {first.thumbnail && (
                <img src={first.thumbnail} alt="" className="w-16 h-10 rounded-lg object-cover shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <Link
                  href={`/result/${sessionId}`}
                  className="text-white font-semibold text-sm hover:text-orange-400 transition-colors truncate block"
                >
                  {first.videoTitle}
                </Link>
                <p className="text-zinc-500 text-xs">{first.channel} · {items.length}개 북마크</p>
              </div>
              <Link
                href={`/result/${sessionId}`}
                className="shrink-0 text-xs px-3 py-1.5 rounded-xl bg-orange-500/15 text-orange-400 hover:bg-orange-500/25 font-bold transition-colors"
              >
                영상 보기 →
              </Link>
            </div>

            {/* 북마크 목록 */}
            <div className="divide-y divide-white/5">
              {items.map(bm => (
                <div key={bm.id} className="flex items-start gap-3 px-4 py-3 group hover:bg-white/3 transition-colors">
                  {/* 타임스탬프 버튼 */}
                  <Link
                    href={`/result/${sessionId}?t=${bm.timestampLabel}`}
                    className="shrink-0 font-mono text-xs text-orange-400 hover:text-orange-300 bg-orange-500/10 px-2 py-1 rounded-lg border border-orange-500/15 hover:border-orange-500/30 transition-all mt-0.5"
                  >
                    ▶ {bm.timestampLabel}
                  </Link>

                  {/* 메모 */}
                  <div className="flex-1 min-w-0">
                    {bm.memo ? (
                      <p className="text-zinc-300 text-sm leading-relaxed">{bm.memo}</p>
                    ) : (
                      <p className="text-zinc-600 text-xs italic">메모 없음</p>
                    )}
                  </div>

                  {/* 삭제 */}
                  <button
                    onClick={e => handleDelete(e, bm.id)}
                    className="shrink-0 w-6 h-6 rounded-lg flex items-center justify-center text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100 text-xs"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
