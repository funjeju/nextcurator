'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface ReviewItem {
  id: string
  sessionId: string
  videoTitle: string
  questionIdx: number
  question: string
  nextReviewDate: string
  repetition: number
}

interface Props {
  studentId: string
}

export default function ReviewBanner({ studentId }: Props) {
  const [items, setItems] = useState<ReviewItem[]>([])
  const [dismissed, setDismissed] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!studentId) return
    fetch(`/api/review-schedule?uid=${studentId}`)
      .then(r => r.json())
      .then(d => { setItems(d.items || []); setLoaded(true) })
      .catch(() => setLoaded(true))
  }, [studentId])

  if (!loaded || dismissed || items.length === 0) return null

  // 영상별로 그룹핑
  const byVideo: Record<string, { videoTitle: string; sessionId: string; count: number }> = {}
  for (const item of items) {
    if (!byVideo[item.sessionId]) byVideo[item.sessionId] = { videoTitle: item.videoTitle, sessionId: item.sessionId, count: 0 }
    byVideo[item.sessionId].count++
  }
  const videos = Object.values(byVideo)

  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40 w-[calc(100vw-2rem)] max-w-md animate-in slide-in-from-bottom-4 duration-300">
      <div className="bg-[#1c1a18] border border-orange-500/30 rounded-2xl shadow-2xl px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-xl shrink-0">🔔</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-orange-300">오늘 복습할 내용이 있어요!</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {items.length}개 문제 · {videos.length}개 영상
              </p>
            </div>
          </div>
          <button onClick={() => setDismissed(true)} className="text-gray-500 hover:text-white text-sm shrink-0 mt-0.5">✕</button>
        </div>

        {/* 영상별 복습 링크 */}
        <div className="mt-3 space-y-1.5">
          {videos.slice(0, 3).map(v => (
            <Link
              key={v.sessionId}
              href={`/result/${v.sessionId}`}
              className="flex items-center justify-between px-3 py-2 rounded-xl bg-orange-500/10 hover:bg-orange-500/20 transition-colors"
            >
              <span className="text-xs text-white truncate flex-1">{v.videoTitle || '영상 보기'}</span>
              <span className="shrink-0 text-[10px] text-orange-400 font-bold ml-2">{v.count}문제 →</span>
            </Link>
          ))}
          {videos.length > 3 && (
            <p className="text-[10px] text-gray-500 text-center pt-0.5">외 {videos.length - 3}개 영상 더</p>
          )}
        </div>
      </div>
    </div>
  )
}
