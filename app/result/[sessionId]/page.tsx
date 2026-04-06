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

        {/* Save button (Phase 2) */}
        <Button
          className="w-full flex-1 bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 text-white font-bold h-14 text-lg border-none hover:shadow-lg hover:shadow-pink-500/25 transition-all mt-4"
          onClick={() => setShowSaveModal(true)}
        >
          📚 라이브러리에 저장
        </Button>

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
