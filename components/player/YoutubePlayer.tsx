'use client'

import { useEffect, useRef, useCallback } from 'react'

interface YoutubePlayerProps {
  videoId: string
  onPlayerReady?: (player: YT.Player) => void
}

declare global {
  interface Window {
    YT: typeof YT
    onYouTubeIframeAPIReady: () => void
  }
}

export default function YoutubePlayer({ videoId, onPlayerReady }: YoutubePlayerProps) {
  const playerRef = useRef<YT.Player | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const initPlayer = useCallback(() => {
    if (!containerRef.current) return
    playerRef.current = new window.YT.Player(containerRef.current, {
      videoId,
      playerVars: {
        rel: 0,
        modestbranding: 1,
      },
      events: {
        onReady: (e: YT.PlayerEvent) => {
          onPlayerReady?.(e.target)
        },
      },
    })
  }, [videoId, onPlayerReady])

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
      window.onYouTubeIframeAPIReady = () => {}
    }
  }, [initPlayer])

  return (
    <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden">
      <div ref={containerRef} className="w-full h-full" />
    </div>
  )
}
