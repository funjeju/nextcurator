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
  story: { label: '스토리', icon: '🍿', color: 'text-pink-400 border-pink-400' },
}

function timestampToSeconds(ts: string): number {
  const [min, sec] = ts.split(':').map(Number)
  return min * 60 + sec
}

import Link from 'next/link'
import SaveModal from '@/components/summary/SaveModal'
import Header from '@/components/common/Header'

export default function ResultPage() {
  const { sessionId } = useParams()
  const router = useRouter()
  const [data, setData] = useState<SummarizeResponse | null>(null)
  const playerRef = useRef<YT.Player | null>(null)
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [activeTab, setActiveTab] = useState<'summary' | 'transcript'>('summary')
  const [sharing, setSharing] = useState(false)

  useEffect(() => {
    const fetchSummary = async () => {
      const stored = sessionStorage.getItem(`summary_${sessionId}`)
      if (stored) {
        setData(JSON.parse(stored))
        return
      }

      try {
        const { db } = await import('@/lib/firebase')
        const { doc, getDoc } = await import('firebase/firestore')
        const docRef = doc(db, 'summaries', sessionId as string)
        const docSnap = await getDoc(docRef)
        
        if (docSnap.exists()) {
          const fetchedData = docSnap.data() as SummarizeResponse
          sessionStorage.setItem(`summary_${sessionId}`, JSON.stringify(fetchedData))
          setData(fetchedData)
          return
        }
      } catch (e) {
        console.error('Failed to fetch summary from DB:', e)
      }
      
      router.push('/')
    }

    fetchSummary()
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

  const handleShare = async () => {
    if (!data) return
    setSharing(true)
    try {
      const params = new URLSearchParams({
        title:     data.title,
        channel:   data.channel,
        thumbnail: data.thumbnail,
        category:  data.category,
      })
      const imageUrl = `/api/card-image?${params}`

      // 이미지 blob 가져오기
      const res = await fetch(imageUrl)
      const blob = await res.blob()
      const file = new File([blob], 'nextcurator-card.png', { type: 'image/png' })

      if (navigator.canShare?.({ files: [file] })) {
        // Web Share API (모바일: 카카오톡 등으로 공유)
        await navigator.share({
          title: data.title,
          text: `📺 ${data.title}\n🎬 Next Curator로 분석한 영상`,
          files: [file],
        })
      } else if (navigator.share) {
        // 파일 공유 미지원 시 텍스트만 공유
        await navigator.share({
          title: data.title,
          text: `📺 ${data.title}\n🎬 Next Curator로 분석한 영상`,
          url: window.location.href,
        })
      } else {
        // 데스크탑: 이미지 다운로드
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = 'nextcurator-card.png'
        a.click()
        URL.revokeObjectURL(a.href)
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        console.error('공유 실패:', e)
      }
    } finally {
      setSharing(false)
    }
  }

  if (!data) return null

  const catInfo = CATEGORY_INFO[data.category]

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <Header title="🎬 Next Curator" />

      <div className="max-w-2xl mx-auto px-4 py-2 flex flex-col gap-6">
        {/* Player (Sticky wrapper) */}
        <div className="sticky top-[68px] md:top-[76px] z-40 bg-zinc-950 pb-4 shadow-[0_15px_20px_-10px_rgba(9,9,11,1)]">
          <div className="rounded-xl overflow-hidden shadow-2xl border border-white/10 ring-1 ring-black/50">
            <YoutubePlayer videoId={data.videoId} onPlayerReady={handlePlayerReady} />
          </div>
        </div>

        {/* Video info */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="outline" className={`text-xs ${catInfo.color}`}>
              {catInfo.icon} {catInfo.label}
            </Badge>
            <span className="text-zinc-500 text-sm">{data.channel}</span>
          </div>
          <h1 className="text-lg font-bold text-zinc-100">{data.title}</h1>
          {data.transcriptSource && (
            <p className="text-xs text-zinc-600 mt-1">
              자막 출처: {data.transcriptSource}
            </p>
          )}
        </div>

        {/* Content Tabs */}
        <div className="flex bg-[#32302e] rounded-xl p-1 border border-white/5 mx-auto w-full max-w-sm mt-2">
          <button
            onClick={() => setActiveTab('summary')}
            className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${
              activeTab === 'summary' ? 'bg-[#23211f] text-white shadow' : 'text-[#75716e] hover:text-white'
            }`}
          >
            기본 요약
          </button>
          <button
            onClick={() => setActiveTab('transcript')}
            className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${
              activeTab === 'transcript' ? 'bg-[#23211f] text-white shadow' : 'text-[#75716e] hover:text-white'
            }`}
          >
            전체 자막 보기
          </button>
        </div>

        {/* Content Body */}
        <div className="min-h-[300px]">
          {activeTab === 'summary' ? (
            <SummaryShell category={data.category} summary={data.summary} onSeek={handleSeek} />
          ) : (
            <div className="bg-[#2a2826] rounded-2xl p-6 border border-white/5 space-y-4 shadow-lg h-[500px] overflow-y-auto">
              <h2 className="text-xl font-bold border-b border-white/10 pb-4 mb-4">전체 자막</h2>
              {data.transcript ? (
                data.transcript.split('\n').map((line, idx) => {
                  const match = line.match(/^\[(\d{2}:\d{2})\]\s(.*)/);
                  if (match) {
                    const ts = match[1];
                    const text = match[2];
                    return (
                      <div key={idx} className="flex gap-4 items-start group">
                        <button
                          onClick={() => handleSeek(ts)}
                          className="shrink-0 text-orange-400 hover:text-orange-300 font-mono text-sm mt-0.5"
                        >
                          {ts}
                        </button>
                        <p className="text-[#d4d4d8] text-base leading-relaxed group-hover:text-white transition-colors">
                          {text}
                        </p>
                      </div>
                    );
                  }
                  return <p key={idx} className="text-[#d4d4d8] text-base">{line}</p>;
                })
              ) : (
                <p className="text-zinc-500 text-center py-10">자막 데이터가 없습니다.</p>
              )}
            </div>
          )}
        </div>

        {/* 저장 / 공유 버튼 */}
        <div className="flex gap-3 mt-4">
          <Button
            className="flex-1 bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 text-white font-bold h-14 text-lg border-none hover:shadow-lg hover:shadow-pink-500/25 transition-all"
            onClick={() => setShowSaveModal(true)}
          >
            📚 라이브러리에 저장
          </Button>
          <Button
            variant="outline"
            className="h-14 px-5 border-white/10 bg-[#32302e] text-white hover:bg-[#3d3a38] hover:border-white/20 transition-all disabled:opacity-50"
            onClick={handleShare}
            disabled={sharing}
            title="카드 이미지로 공유"
          >
            {sharing ? (
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
            )}
          </Button>
        </div>

        <Button
          variant="ghost"
          className="text-zinc-500 mb-10"
          onClick={() => router.push('/')}
        >
          ← 새 영상 요약하기
        </Button>
      </div>

      {showSaveModal && (
        <SaveModal data={data} onClose={() => setShowSaveModal(false)} />
      )}
    </div>
  )
}
