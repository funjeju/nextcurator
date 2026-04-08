'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import YoutubePlayer from '@/components/player/YoutubePlayer'
import SummaryShell from '@/components/summary/SummaryShell'
import SaveModal from '@/components/summary/SaveModal'
import Header from '@/components/common/Header'
import { SummarizeResponse } from '@/types/summary'
import { useAuth } from '@/providers/AuthProvider'
import { getSavedSummaryBySessionId, updateSummaryVisibility } from '@/lib/db'
import { getLocalUserId } from '@/lib/user'
import type { SavedSummary } from '@/lib/db'

const CATEGORY_INFO: Record<string, { label: string; icon: string; color: string }> = {
  recipe:  { label: '요리',    icon: '🍳', color: 'text-orange-400 border-orange-400' },
  english: { label: '영어학습', icon: '🔤', color: 'text-blue-400 border-blue-400' },
  learning:{ label: '학습',    icon: '📐', color: 'text-violet-400 border-violet-400' },
  news:    { label: '뉴스',    icon: '🗞️', color: 'text-zinc-400 border-zinc-400' },
  selfdev: { label: '자기계발', icon: '💪', color: 'text-emerald-400 border-emerald-400' },
  travel:  { label: '여행',    icon: '🧳', color: 'text-cyan-400 border-cyan-400' },
  story:   { label: '스토리',  icon: '🍿', color: 'text-pink-400 border-pink-400' },
}

const RE_ANALYZE_CATEGORIES = [
  { id: 'recipe',  icon: '🍳', label: '요리' },
  { id: 'english', icon: '🔤', label: '영어' },
  { id: 'learning',icon: '📐', label: '학습' },
  { id: 'news',    icon: '🗞️', label: '뉴스' },
  { id: 'selfdev', icon: '💪', label: '자기계발' },
  { id: 'travel',  icon: '🧳', label: '여행' },
  { id: 'story',   icon: '🍿', label: '스토리' },
]

function timestampToSeconds(ts: string): number {
  const [min, sec] = ts.split(':').map(Number)
  return min * 60 + sec
}

export default function ResultPage() {
  const { sessionId } = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const [data, setData] = useState<SummarizeResponse | null>(null)
  const [savedItem, setSavedItem] = useState<SavedSummary | null>(null)
  const playerRef = useRef<YT.Player | null>(null)
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [activeTab, setActiveTab] = useState<'summary' | 'transcript' | 'reanalyze'>('summary')
  const [sharing, setSharing] = useState(false)
  const [togglingVisibility, setTogglingVisibility] = useState(false)
  const [reanalyzing, setReanalyzing] = useState(false)
  const [reanalyzeCategory, setReanalyzeCategory] = useState('')

  // 데이터 로드
  useEffect(() => {
    const fetchSummary = async () => {
      const stored = sessionStorage.getItem(`summary_${sessionId}`)
      if (stored) { setData(JSON.parse(stored)); return }

      try {
        const { db } = await import('@/lib/firebase')
        const { doc, getDoc, collection, query, where, getDocs } = await import('firebase/firestore')

        const docRef = doc(db, 'summaries', sessionId as string)
        const docSnap = await getDoc(docRef)
        if (docSnap.exists()) {
          const fetchedData = docSnap.data() as SummarizeResponse
          sessionStorage.setItem(`summary_${sessionId}`, JSON.stringify(fetchedData))
          setData(fetchedData)
          return
        }

        const q = query(collection(db, 'saved_summaries'), where('sessionId', '==', sessionId as string))
        const snapshot = await getDocs(q)
        if (!snapshot.empty) {
          const saved = snapshot.docs[0].data()
          if (saved.summary) {
            const fetchedData = saved as unknown as SummarizeResponse
            sessionStorage.setItem(`summary_${sessionId}`, JSON.stringify(fetchedData))
            setData(fetchedData)
            return
          }
        }
      } catch (e) {
        console.error('Failed to fetch summary from DB:', e)
      }
      router.push('/')
    }
    fetchSummary()
  }, [sessionId, router])

  // 저장 여부 확인
  useEffect(() => {
    if (!data) return
    const uid = user?.uid || getLocalUserId()
    getSavedSummaryBySessionId(uid, data.sessionId)
      .then(setSavedItem)
      .catch(() => {})
  }, [data, user])

  const handlePlayerReady = useCallback((player: YT.Player) => { playerRef.current = player }, [])
  const handleSeek = useCallback((ts: string) => {
    if (playerRef.current) {
      playerRef.current.seekTo(timestampToSeconds(ts), true)
      playerRef.current.playVideo()
    }
  }, [])

  // 공개/비공개 토글
  const handleToggleVisibility = async () => {
    if (!savedItem) return
    setTogglingVisibility(true)
    const newPublic = !savedItem.isPublic
    try {
      await updateSummaryVisibility(savedItem.id, newPublic)
      setSavedItem(prev => prev ? { ...prev, isPublic: newPublic } : prev)
    } catch { alert('변경에 실패했습니다.') }
    finally { setTogglingVisibility(false) }
  }

  // 다른 카테고리로 재요약
  const handleReanalyze = async (category: string) => {
    if (!data?.transcript && !data?.videoId) return
    setReanalyzing(true)
    setReanalyzeCategory(category)
    try {
      const res = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: `https://www.youtube.com/watch?v=${data.videoId}`, category }),
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error) }
      const newData: SummarizeResponse = await res.json()
      sessionStorage.setItem(`summary_${newData.sessionId}`, JSON.stringify(newData))
      router.push(`/result/${newData.sessionId}`)
    } catch (e) {
      alert((e as Error).message || '재요약에 실패했습니다.')
    } finally {
      setReanalyzing(false)
      setReanalyzeCategory('')
    }
  }

  // 카드 공유
  const handleShare = async () => {
    if (!data) return
    setSharing(true)
    try {
      const params = new URLSearchParams({ title: data.title, channel: data.channel, thumbnail: data.thumbnail, category: data.category })
      const res = await fetch(`/api/card-image?${params}`)
      const blob = await res.blob()
      const file = new File([blob], 'nextcurator-card.png', { type: 'image/png' })
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: data.title, text: `📺 ${data.title}\n🎬 Next Curator`, files: [file] })
      } else if (navigator.share) {
        await navigator.share({ title: data.title, url: window.location.href })
      } else {
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob); a.download = 'nextcurator-card.png'; a.click()
        URL.revokeObjectURL(a.href)
      }
    } catch (e) { if ((e as Error).name !== 'AbortError') console.error(e) }
    finally { setSharing(false) }
  }

  if (!data) return null
  const catInfo = CATEGORY_INFO[data.category]

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <Header title="🎬 Next Curator" />

      <div className="max-w-2xl mx-auto px-4 py-2 flex flex-col gap-6">

        {/* 플레이어 */}
        <div className="sticky top-[68px] md:top-[76px] z-40 bg-zinc-950 pb-4 shadow-[0_15px_20px_-10px_rgba(9,9,11,1)]">
          <div className="rounded-xl overflow-hidden shadow-2xl border border-white/10 ring-1 ring-black/50">
            <YoutubePlayer videoId={data.videoId} onPlayerReady={handlePlayerReady} />
          </div>
        </div>

        {/* 영상 정보 */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="outline" className={`text-xs ${catInfo.color}`}>
              {catInfo.icon} {catInfo.label}
            </Badge>
            <span className="text-zinc-500 text-sm">{data.channel}</span>
          </div>
          <h1 className="text-lg font-bold text-zinc-100">{data.title}</h1>
          {data.transcriptSource && (
            <p className="text-xs text-zinc-600 mt-1">자막 출처: {data.transcriptSource}</p>
          )}
        </div>

        {/* 탭 */}
        <div className="flex bg-[#32302e] rounded-xl p-1 border border-white/5 w-full mt-2">
          {(['summary', 'transcript', 'reanalyze'] as const).map(tab => {
            const labels = { summary: '기본 요약', transcript: '전체 자막', reanalyze: '🔄 다시 분석' }
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2.5 text-xs md:text-sm font-bold rounded-lg transition-all ${
                  activeTab === tab ? 'bg-[#23211f] text-white shadow' : 'text-[#75716e] hover:text-white'
                }`}
              >
                {labels[tab]}
              </button>
            )
          })}
        </div>

        {/* 탭 콘텐츠 */}
        <div className="min-h-[300px]">
          {activeTab === 'summary' && (
            <SummaryShell category={data.category} summary={data.summary} onSeek={handleSeek} />
          )}

          {activeTab === 'transcript' && (
            <div className="bg-[#2a2826] rounded-2xl p-6 border border-white/5 space-y-3 shadow-lg h-[500px] overflow-y-auto">
              <h2 className="text-xl font-bold border-b border-white/10 pb-4 mb-4">전체 자막</h2>
              {data.transcript ? (() => {
                // 파싱 후 150자 단위로 묶기
                const lines = data.transcript.split('\n')
                const parsed: { ts: string; text: string }[] = []
                for (const line of lines) {
                  const m = line.match(/^\[(\d{2}:\d{2})\]\s(.*)/)
                  if (m) parsed.push({ ts: m[1], text: m[2].trim() })
                }

                const CHUNK_SIZE = 150
                const chunks: { ts: string; text: string }[] = []
                let cur: { ts: string; text: string } | null = null

                for (const p of parsed) {
                  if (!cur) {
                    cur = { ts: p.ts, text: p.text }
                  } else if (cur.text.length + p.text.length + 1 < CHUNK_SIZE) {
                    cur.text += ' ' + p.text
                  } else {
                    chunks.push(cur)
                    cur = { ts: p.ts, text: p.text }
                  }
                }
                if (cur) chunks.push(cur)

                return chunks.map((chunk, idx) => (
                  <div key={idx} className="flex gap-3 items-start group">
                    <button
                      onClick={() => handleSeek(chunk.ts)}
                      className="shrink-0 text-orange-400 hover:text-orange-300 font-mono text-xs mt-1 hover:underline"
                    >
                      {chunk.ts}
                    </button>
                    <p className="text-[#d4d4d8] text-sm leading-relaxed group-hover:text-white transition-colors">
                      {chunk.text}
                    </p>
                  </div>
                ))
              })() : (
                <p className="text-zinc-500 text-center py-10">자막 데이터가 없습니다.</p>
              )}
            </div>
          )}

          {activeTab === 'reanalyze' && (
            <div className="bg-[#2a2826] rounded-2xl p-6 border border-white/5 space-y-4 shadow-lg">
              <div>
                <h2 className="text-base font-bold text-white mb-1">다른 방식으로 다시 분석</h2>
                <p className="text-xs text-[#75716e]">같은 영상을 다른 카테고리 형식으로 새로 요약합니다.</p>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {RE_ANALYZE_CATEGORIES.map(cat => {
                  const isCurrent = cat.id === data.category
                  const isLoading = reanalyzing && reanalyzeCategory === cat.id
                  return (
                    <button
                      key={cat.id}
                      onClick={() => !isCurrent && handleReanalyze(cat.id)}
                      disabled={isCurrent || reanalyzing}
                      className={`flex flex-col items-center gap-1.5 py-4 rounded-2xl text-xs font-semibold transition-all border ${
                        isCurrent
                          ? 'bg-white/5 border-white/20 text-white/40 cursor-default'
                          : isLoading
                            ? 'bg-orange-500/20 border-orange-500/40 text-orange-300'
                            : 'bg-[#32302e] border-white/5 text-[#a4a09c] hover:bg-[#3d3a38] hover:text-white hover:border-white/20'
                      } disabled:opacity-60`}
                    >
                      <span className="text-2xl">{isLoading ? '⏳' : cat.icon}</span>
                      <span>{cat.label}</span>
                      {isCurrent && <span className="text-[9px] text-white/30">현재</span>}
                    </button>
                  )
                })}
              </div>
              {reanalyzing && (
                <p className="text-center text-sm text-orange-400 animate-pulse">
                  {RE_ANALYZE_CATEGORIES.find(c => c.id === reanalyzeCategory)?.icon} {RE_ANALYZE_CATEGORIES.find(c => c.id === reanalyzeCategory)?.label} 방식으로 재분석 중...
                </p>
              )}
            </div>
          )}
        </div>

        {/* 하단 버튼 영역 */}
        <div className="flex gap-3 mt-4">
          {savedItem ? (
            /* 이미 저장된 경우 → 공개/비공개 토글 */
            <button
              onClick={handleToggleVisibility}
              disabled={togglingVisibility}
              className={`flex-1 h-14 rounded-xl font-bold text-sm transition-all disabled:opacity-50 border ${
                savedItem.isPublic
                  ? 'bg-[#32302e] border-white/10 text-[#a4a09c] hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-400'
                  : 'bg-[#32302e] border-white/10 text-[#a4a09c] hover:bg-green-500/10 hover:border-green-500/30 hover:text-green-400'
              }`}
            >
              {togglingVisibility ? '변경 중...' : savedItem.isPublic ? '🌍 공개 중 → 비공개로 변경' : '🔒 비공개 → 광장에 공개'}
            </button>
          ) : (
            /* 미저장 → 저장 모달 */
            <Button
              className="flex-1 bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 text-white font-bold h-14 text-base border-none"
              onClick={() => setShowSaveModal(true)}
            >
              📚 라이브러리에 저장
            </Button>
          )}

          {/* 공유 버튼 */}
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

        <Button variant="ghost" className="text-zinc-500 mb-10" onClick={() => router.push('/')}>
          ← 새 영상 요약하기
        </Button>
      </div>

      {showSaveModal && (
        <SaveModal
          data={data}
          onClose={() => {
            setShowSaveModal(false)
            // 저장 후 savedItem 재조회
            const uid = user?.uid || getLocalUserId()
            getSavedSummaryBySessionId(uid, data.sessionId).then(setSavedItem).catch(() => {})
          }}
        />
      )}
    </div>
  )
}
