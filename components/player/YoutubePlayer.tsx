'use client'

import { useEffect, useRef, useCallback } from 'react'

export interface WatchLog {
  durationSec: number
  percentWatched: number
  completed: boolean   // 80% 이상 시청 or 영상 끝
}

interface YoutubePlayerProps {
  videoId: string
  onPlayerReady?: (player: YT.Player) => void
  onWatchLog?: (log: WatchLog) => void  // 시청 완료 시 콜백
  quizTimestamps?: number[]             // 퀴즈 타임스탬프 목록 (초)
  onQuizTrigger?: (timestampSec: number) => void  // 해당 시점 도달 시 콜백
}

declare global {
  interface Window {
    YT: typeof YT
    onYouTubeIframeAPIReady: () => void
  }
}

export default function YoutubePlayer({ videoId, onPlayerReady, onWatchLog, quizTimestamps, onQuizTrigger }: YoutubePlayerProps) {
  const playerRef = useRef<YT.Player | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const watchStartRef = useRef<number>(0)       // 재생 시작 시각
  const totalWatchedRef = useRef<number>(0)     // 누적 시청 초
  const reportedRef = useRef<boolean>(false)    // 80% 이미 보고했는지
  const tickRef = useRef<number | null>(null)
  // 퀴즈 감지용 refs (stale closure 방지)
  const quizTimestampsRef = useRef<number[]>([])
  const onQuizTriggerRef = useRef<((ts: number) => void) | undefined>()
  const shownQuizRef = useRef<Set<number>>(new Set())

  // refs를 최신 props로 동기화
  useEffect(() => { quizTimestampsRef.current = quizTimestamps ?? [] }, [quizTimestamps])
  useEffect(() => { onQuizTriggerRef.current = onQuizTrigger }, [onQuizTrigger])

  const stopTick = useCallback(() => {
    if (tickRef.current !== null) {
      clearInterval(tickRef.current)
      tickRef.current = null
    }
  }, [])

  const report = useCallback((player: YT.Player, completed: boolean) => {
    if (!onWatchLog || reportedRef.current) return
    const duration = player.getDuration?.() || 0
    if (!duration) return
    const pct = Math.min(100, Math.round((totalWatchedRef.current / duration) * 100))
    if (pct >= 10) {  // 10% 이상 봤을 때만 기록 (우발적 클릭 제외)
      reportedRef.current = true
      onWatchLog({ durationSec: Math.round(totalWatchedRef.current), percentWatched: pct, completed })
    }
  }, [onWatchLog])

  const initPlayer = useCallback(() => {
    if (!containerRef.current) return
    playerRef.current = new window.YT.Player(containerRef.current, {
      videoId,
      playerVars: { rel: 0, modestbranding: 1 },
      events: {
        onReady: (e: YT.PlayerEvent) => {
          onPlayerReady?.(e.target)
        },
        onStateChange: (e: YT.OnStateChangeEvent) => {
          const player = e.target
          if (e.data === window.YT.PlayerState.PLAYING) {
            watchStartRef.current = Date.now()
            // 주기적으로 시청 시간 누적
            tickRef.current = window.setInterval(() => {
              totalWatchedRef.current += 1

              // 퀴즈 타임스탬프 감지
              const qts = quizTimestampsRef.current
              if (qts.length > 0 && onQuizTriggerRef.current) {
                const currentTime = player.getCurrentTime?.() ?? 0
                for (const ts of qts) {
                  if (!shownQuizRef.current.has(ts) && currentTime >= ts && currentTime <= ts + 2) {
                    shownQuizRef.current.add(ts)
                    player.pauseVideo()
                    onQuizTriggerRef.current(ts)
                    break
                  }
                }
              }

              const duration = player.getDuration?.() || 0
              if (duration > 0) {
                const pct = (totalWatchedRef.current / duration) * 100
                if (pct >= 80 && !reportedRef.current) {
                  report(player, true)
                }
              }
            }, 1000)
          } else if (
            e.data === window.YT.PlayerState.PAUSED ||
            e.data === window.YT.PlayerState.BUFFERING
          ) {
            stopTick()
            if (watchStartRef.current) {
              totalWatchedRef.current += (Date.now() - watchStartRef.current) / 1000
              watchStartRef.current = 0
            }
          } else if (e.data === window.YT.PlayerState.ENDED) {
            stopTick()
            report(player, true)
          }
        },
      },
    })
  }, [videoId, onPlayerReady, report, stopTick])

  useEffect(() => {
    if (window.YT && window.YT.Player) {
      initPlayer()
      return
    }
    const tag = document.createElement('script')
    tag.src = 'https://www.youtube.com/iframe_api'
    document.head.appendChild(tag)
    window.onYouTubeIframeAPIReady = initPlayer
    return () => {
      stopTick()
      window.onYouTubeIframeAPIReady = () => {}
    }
  }, [initPlayer, stopTick])

  return (
    <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden">
      <div ref={containerRef} className="w-full h-full" />
    </div>
  )
}
