'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import YoutubePlayer from '@/components/player/YoutubePlayer'
import SummaryShell from '@/components/summary/SummaryShell'
import { SummarizeResponse } from '@/types/summary'

const CATEGORY_INFO: Record<string, { label: string; icon: string; color: string }> = {
  recipe: { label: '요리', icon: '🍳', color: 'text-orange-400 border-orange-400' },
  english: { label: '영어학습', icon: '🔤', color: 'text-blue-400 border-blue-400' },
  learning: { label: '학습', icon: '📐', color: 'text-violet-400 border-violet-400' },
  news: { label: '뉴스', icon: '🗞️', color: 'text-zinc-400 border-zinc-400' },
  selfdev: { label: '자기계발', icon: '💪', color: 'text-emerald-400 border-emerald-400' },
  travel: { label: '여행', icon: '🧳', color: 'text-cyan-400 border-cyan-400' },
}

function timestampToSeconds(ts: string): number {
  const [min, sec] = ts.split(':').map(Number)
  return min * 60 + sec
}

export default function ResultPage() {
  const { sessionId } = useParams()
  const router = useRouter()
  const [data, setData] = useState<SummarizeResponse | null>(null)
  const playerRef = useRef<YT.Player | null>(null)

  useEffect(() => {
    const stored = sessionStorage.getItem(`summary_${sessionId}`)
    if (stored) {
      setData(JSON.parse(stored))
    } else {
      router.push('/')
    }
  }, [sessionId, router])

  const handlePlayerReady = useCallback((player: YT.Player) => {
    playerRef.current = player
  }, [])

  const handleSeek = useCallback((ts: string) => {
    if (playerRef.current) {
      playerRef.current.seekTo(timestampToSeconds(ts), true)
      playerRef.current.playVideo()
    }
  }, [])

  if (!data) return null

  const catInfo = CATEGORY_INFO[data.category]

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="max-w-2xl mx-auto px-4 py-6 flex flex-col gap-6">
        {/* Player */}
        <YoutubePlayer videoId={data.videoId} onPlayerReady={handlePlayerReady} />

        {/* Video info */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="outline" className={`text-xs ${catInfo.color}`}>
              {catInfo.icon} {catInfo.label}
            </Badge>
            <span className="text-zinc-500 text-sm">{data.channel}</span>
          </div>
          <h1 className="text-lg font-bold text-zinc-100">{data.title}</h1>
        </div>

        {/* Summary */}
        <SummaryShell category={data.category} summary={data.summary} onSeek={handleSeek} />

        {/* Save button (Phase 2) */}
        <Button
          variant="outline"
          className="w-full border-zinc-700 text-zinc-400 hover:text-zinc-100"
          disabled
        >
          📚 라이브러리에 저장 (Phase 2 준비 중)
        </Button>

        <Button
          variant="ghost"
          className="text-zinc-500"
          onClick={() => router.push('/')}
        >
          ← 새 영상 요약하기
        </Button>
      </div>
    </div>
  )
}
