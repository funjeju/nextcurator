'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import YoutubePlayer from '@/components/player/YoutubePlayer'
import VoiceControl from '@/components/player/VoiceControl'
import SummaryShell from '@/components/summary/SummaryShell'
import SaveModal from '@/components/summary/SaveModal'
import CommentSection from '@/components/comments/CommentSection'
import SummaryPdfTemplate from '@/components/pdf/SummaryPdfTemplate'
import QuizPanel from '@/components/quiz/QuizPanel'
import DocentChat from '@/components/chat/DocentChat'
import CreateRoomModal from '@/components/room/CreateRoomModal'
import WorksheetPanel from '@/components/worksheet/WorksheetPanel'
import type { QuizData, WorksheetData } from '@/types/summary'
import Header from '@/components/common/Header'
import { SummarizeResponse } from '@/types/summary'
import { useAuth } from '@/providers/AuthProvider'
import { getSavedSummaryBySessionId, updateSummaryVisibility } from '@/lib/db'
import { getLocalUserId } from '@/lib/user'
import { getCommentsBySession } from '@/lib/comments'
import type { SavedSummary } from '@/lib/db'
import type { Comment } from '@/lib/comments'

const CATEGORY_INFO: Record<string, { label: string; icon: string; color: string }> = {
  recipe:  { label: '요리',    icon: '🍳', color: 'text-orange-400 border-orange-400' },
  english: { label: '영어학습', icon: '🔤', color: 'text-blue-400 border-blue-400' },
  learning:{ label: '학습',    icon: '📐', color: 'text-violet-400 border-violet-400' },
  news:    { label: '뉴스',    icon: '🗞️', color: 'text-zinc-400 border-zinc-400' },
  selfdev: { label: '자기계발', icon: '💪', color: 'text-emerald-400 border-emerald-400' },
  travel:  { label: '여행',    icon: '🧳', color: 'text-cyan-400 border-cyan-400' },
  story:   { label: '스토리',  icon: '🍿', color: 'text-pink-400 border-pink-400' },
  tips:    { label: '팁',      icon: '💡', color: 'text-yellow-400 border-yellow-400' },
  report:  { label: '보고서',  icon: '📋', color: 'text-indigo-400 border-indigo-400' },
}
const DEFAULT_CATEGORY_INFO = { label: '분석됨', icon: '✨', color: 'text-zinc-400 border-zinc-400' }

const RE_ANALYZE_CATEGORIES = [
  { id: 'recipe',  icon: '🍳', label: '요리' },
  { id: 'english', icon: '🔤', label: '영어' },
  { id: 'learning',icon: '📐', label: '학습' },
  { id: 'news',    icon: '🗞️', label: '뉴스' },
  { id: 'selfdev', icon: '💪', label: '자기계발' },
  { id: 'travel',  icon: '🧳', label: '여행' },
  { id: 'story',   icon: '🍿', label: '스토리' },
  { id: 'tips',    icon: '💡', label: '팁' },
  { id: 'report',  icon: '📋', label: '보고서' },
]

function timestampToSeconds(ts: string): number {
  const [min, sec] = ts.split(':').map(Number)
  return min * 60 + sec
}

export default function ResultClient({ sessionId }: { sessionId: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const fromSquare = searchParams.get('from') === 'square'
  const { user } = useAuth()
  const [data, setData] = useState<SummarizeResponse | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [savedItem, setSavedItem] = useState<SavedSummary | null>(null)
  const playerRef = useRef<YT.Player | null>(null)
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [showRoomModal, setShowRoomModal] = useState(false)
  const [activeTab, setActiveTab] = useState<'summary' | 'transcript' | 'reanalyze'>('summary')
  const [sharing, setSharing] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)
  const [togglingVisibility, setTogglingVisibility] = useState(false)
  const [reanalyzing, setReanalyzing] = useState(false)
  const [reanalyzeCategory, setReanalyzeCategory] = useState('')

  // 댓글
  const [comments, setComments] = useState<Comment[]>([])
  const [commentCount, setCommentCount] = useState(0)
  const [focusSegment, setFocusSegment] = useState<{ id: string; label: string } | null>(null)
  const commentSectionRef = useRef<HTMLDivElement>(null)

  // PDF
  const [downloading, setDownloading] = useState(false)
  const pdfRef = useRef<HTMLDivElement>(null)
  const [qrDataUrl, setQrDataUrl] = useState('')

  // 퀴즈
  const [quiz, setQuiz] = useState<QuizData | null>(null)
  const [quizLoading, setQuizLoading] = useState(false)

  // 워크시트
  const [worksheet, setWorksheet] = useState<WorksheetData | null>(null)
  const [worksheetLoading, setWorksheetLoading] = useState(false)
  const [worksheetLevel, setWorksheetLevel] = useState<'elementary' | 'middle' | 'advanced'>('elementary')

  // 메타인지 자기점검
  const [metaLevel, setMetaLevel] = useState<'complete' | 'confused' | 'unknown' | null>(null)

  useEffect(() => {
    if (!data?.videoId) return
    import('qrcode').then(QRCode => {
      QRCode.toDataURL(`https://www.youtube.com/watch?v=${data.videoId}`, { width: 96, margin: 1 })
        .then(setQrDataUrl)
        .catch(() => {})
    })
  }, [data?.videoId])

  const handleDownloadPdf = async () => {
    if (!pdfRef.current || !data) return
    setDownloading(true)
    try {
      const { downloadPdf } = await import('@/lib/downloadPdf')
      const safeName = data.title.replace(/[^\w\s가-힣]/g, '').trim().slice(0, 40) || 'summary'
      await downloadPdf(pdfRef.current, `${safeName}.pdf`)
    } catch (e) {
      console.error('PDF 생성 실패:', e)
      alert('PDF 다운로드에 실패했습니다.')
    } finally {
      setDownloading(false)
    }
  }

  // 세그먼트별 댓글 수
  const commentCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const c of comments) {
      if (c.segmentId && !c.parentId) {
        counts[c.segmentId] = (counts[c.segmentId] ?? 0) + 1
      }
    }
    return counts
  }, [comments])

  // 데이터 로드
  useEffect(() => {
    const fetchSummary = async () => {
      // 1. sessionStorage 우선
      const stored = sessionStorage.getItem(`summary_${sessionId}`)
      if (stored) {
        try { setData(JSON.parse(stored)); return } catch { /* 손상된 캐시 무시 */ }
      }

      try {
        const { db } = await import('@/lib/firebase')
        const { doc, getDoc, collection, query, where, getDocs } = await import('firebase/firestore')

        // 2. summaries 컬렉션 직접 조회 (요약 직후 저장되는 곳)
        const docSnap = await getDoc(doc(db, 'summaries', sessionId as string))
        if (docSnap.exists()) {
          const fetched = docSnap.data() as SummarizeResponse
          sessionStorage.setItem(`summary_${sessionId}`, JSON.stringify(fetched))
          setData(fetched)
          return
        }

        // 3. saved_summaries에서 공개 항목 조회
        const publicSnap = await getDocs(
          query(
            collection(db, 'saved_summaries'),
            where('sessionId', '==', sessionId as string),
            where('isPublic', '==', true)
          )
        )
        if (!publicSnap.empty) {
          const saved = publicSnap.docs[0].data()
          if (saved.summary) {
            const fetched = saved as unknown as SummarizeResponse
            sessionStorage.setItem(`summary_${sessionId}`, JSON.stringify(fetched))
            setData(fetched)
            return
          }
        }

        // 4. 로그인 유저라면 본인의 비공개 항목도 조회
        const currentUid = user?.uid
        if (currentUid) {
          const privateSnap = await getDocs(
            query(
              collection(db, 'saved_summaries'),
              where('sessionId', '==', sessionId as string),
              where('userId', '==', currentUid)
            )
          )
          if (!privateSnap.empty) {
            const saved = privateSnap.docs[0].data()
            if (saved.summary) {
              const fetched = saved as unknown as SummarizeResponse
              sessionStorage.setItem(`summary_${sessionId}`, JSON.stringify(fetched))
              setData(fetched)
              return
            }
          }
        }

        console.warn('[Result] 요약 데이터를 찾을 수 없음:', sessionId)
        setLoadError(true)
      } catch (e) {
        console.error('[Result] 데이터 로드 오류:', e)
        setLoadError(true)
      }
    }
    fetchSummary()
  }, [sessionId, user])

  // videoPublishedAt 없는 경우 서버에서 가져와 보완
  useEffect(() => {
    if (!data?.videoId || data.videoPublishedAt) return
    fetch('/api/video-published-at', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: data.sessionId, videoId: data.videoId }),
    })
      .then(r => r.ok ? r.json() : null)
      .then(res => {
        if (res?.publishedAt) {
          setData(prev => prev ? { ...prev, videoPublishedAt: res.publishedAt } : prev)
          sessionStorage.removeItem(`summary_${sessionId}`)
        }
      })
      .catch(() => {})
  }, [data?.videoId, data?.videoPublishedAt])

  // 댓글 로드
  useEffect(() => {
    if (!sessionId) return
    getCommentsBySession(sessionId as string)
      .then(data => {
        setComments(data)
        setCommentCount(data.filter(c => !c.parentId).length)
      })
      .catch(() => {})
  }, [sessionId])

  // 저장 여부 확인
  useEffect(() => {
    if (!data) return
    const uid = user?.uid || getLocalUserId()
    getSavedSummaryBySessionId(uid, data.sessionId)
      .then(setSavedItem)
      .catch(() => {})
  }, [data, user])

  // 미저장 이탈 방지 경고 (브라우저 새로고침/닫기)
  useEffect(() => {
    const isUnsaved = !!data && !savedItem
    
    // 헤더 연동을 위한 전역 플래그 설정
    if (typeof window !== 'undefined') {
      (window as any).__NEXT_CURATOR_UNSAVED__ = isUnsaved
    }

    if (!isUnsaved) return

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = '저장하지 않고 이동하시겠습니까? 분석 내용은 사라집니다.'
      return e.returnValue
    }

    // 뒤로가기(popstate) 감지 로직 추가
    const handlePopState = (e: PopStateEvent) => {
      if (isUnsaved) {
        if (!confirm('저장하지 않고 이동하시겠습니까? 분석 내용은 사라집니다.')) {
          // 이동 취소: 현재 URL 유지
          window.history.pushState(null, '', window.location.href)
        }
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    window.addEventListener('popstate', handlePopState)
    
    // 초기 히스토리 상태 추가 (popstate 트리거용)
    window.history.pushState(null, '', window.location.href)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      window.removeEventListener('popstate', handlePopState)
      if (typeof window !== 'undefined') {
        (window as any).__NEXT_CURATOR_UNSAVED__ = false
      }
    }
  }, [data, savedItem])

  const handlePlayerReady = useCallback((player: YT.Player) => { playerRef.current = player }, [])
  const handleSeek = useCallback((ts: string) => {
    if (playerRef.current) {
      playerRef.current.seekTo(timestampToSeconds(ts), true)
      playerRef.current.playVideo()
    }
  }, [])

  // 인라인 댓글 버블 클릭 → 댓글 섹션으로 스크롤 + 포커스
  const handleComment = useCallback((segmentId: string, segmentLabel: string) => {
    setFocusSegment({ id: segmentId, label: segmentLabel })
    setTimeout(() => {
      commentSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 100)
  }, [])

  // 댓글 버튼 클릭 → 댓글 섹션으로 스크롤
  const handleCommentIconClick = useCallback(() => {
    setFocusSegment(null)
    setTimeout(() => {
      commentSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 100)
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

  const handleGenerateQuiz = async () => {
    if (!data || quizLoading) return
    setQuizLoading(true)
    try {
      const res = await fetch('/api/quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: data.category, summary: data.summary, title: data.title }),
      })
      if (!res.ok) throw new Error('퀴즈 생성 실패')
      setQuiz(await res.json())
    } catch (e) {
      alert('퀴즈 생성에 실패했습니다.')
    } finally {
      setQuizLoading(false)
    }
  }

  const handleGenerateWorksheet = async () => {
    if (!data || worksheetLoading) return
    setWorksheetLoading(true)
    try {
      const res = await fetch('/api/worksheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: data.transcript ?? '',
          summary: data.summary,
          title: data.title,
          level: worksheetLevel,
        }),
      })
      if (!res.ok) throw new Error('워크시트 생성 실패')
      setWorksheet(await res.json())
    } catch {
      alert('워크시트 생성에 실패했습니다.')
    } finally {
      setWorksheetLoading(false)
    }
  }

  // 메타인지 자기점검 로그
  const handleMeta = async (level: 'complete' | 'confused' | 'unknown') => {
    if (!user || !data) return
    const { getUserProfile } = await import('@/lib/db')
    const p = await getUserProfile(user.uid)
    if (p?.role !== 'student' || !p.classCode) return

    setMetaLevel(level)
    try {
      await fetch('/api/classroom/activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: user.uid,
          studentName: p.studentName || p.displayName || '',
          classCode: p.classCode,
          type: 'meta',
          videoId: data.videoId,
          sessionId: data.sessionId,
          videoTitle: data.title,
          value: { level },
        }),
      })
    } catch { /* 로그 실패는 조용히 */ }
  }

  // 링크 복사/공유 — 모바일은 네이티브 공유 시트, PC는 클립보드 복사
  const handleShare = async () => {
    if (!data) return
    setSharing(true)
    const pageUrl = window.location.href
    const isMobile = typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0
    try {
      if (isMobile && navigator.share) {
        // 모바일: 네이티브 공유 시트 (URL만 전달 — 이미지 제외)
        await navigator.share({ title: data.title, url: pageUrl })
      } else {
        // PC: 클립보드 복사
        await navigator.clipboard.writeText(pageUrl)
        setShareCopied(true)
        setTimeout(() => setShareCopied(false), 2000)
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        try {
          await navigator.clipboard.writeText(pageUrl)
          setShareCopied(true)
          setTimeout(() => setShareCopied(false), 2000)
        } catch { /* ignore */ }
      }
    } finally {
      setSharing(false)
    }
  }


  if (loadError) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center gap-6 px-4">
        <span className="text-5xl">😵</span>
        <h1 className="text-xl font-bold text-white">요약을 불러오지 못했습니다</h1>
        <p className="text-zinc-400 text-sm text-center max-w-xs">
          요약 데이터가 만료됐거나 존재하지 않습니다.<br/>
          저장된 항목은 마이페이지에서, 공개 항목은 스퀘어에서 확인하세요.
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => router.push('/')}
            className="px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-sm transition-colors"
          >
            새 영상 요약하기
          </button>
          <button
            onClick={() => router.push('/mypage')}
            className="px-5 py-2.5 bg-[#32302e] border border-white/10 text-white rounded-xl text-sm hover:bg-[#3d3a38] transition-colors"
          >
            마이페이지
          </button>
        </div>
      </div>
    )
  }

  if (!data) return null
  const catInfo = CATEGORY_INFO[data.category] ?? DEFAULT_CATEGORY_INFO

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <Header title="🎬 Next Curator" />

      <div className="max-w-2xl mx-auto px-4 py-2 flex flex-col gap-6">

        {/* 플레이어 (YouTube가 아닌 경우 썸네일 or 소스 표시) */}
        {data.videoId ? (
          <div className="sticky top-[68px] md:top-[76px] z-40 bg-zinc-950 pb-4 shadow-[0_15px_20px_-10px_rgba(9,9,11,1)]">
            <div className="rounded-xl overflow-hidden shadow-2xl border border-white/10 ring-1 ring-black/50">
              <YoutubePlayer videoId={data.videoId} onPlayerReady={handlePlayerReady} />
            </div>
          </div>
        ) : (data as any).sourceUrl || (data as any).sourceType === 'pdf' ? (
          <div className="rounded-xl bg-[#2a2826] border border-white/10 p-5 flex items-center gap-4">
            <span className="text-3xl">{(data as any).sourceType === 'pdf' ? '📄' : '🌐'}</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-[#75716e] mb-0.5">{(data as any).sourceType === 'pdf' ? 'PDF 문서' : '웹페이지'}</p>
              <p className="text-white text-sm font-semibold truncate">{data.title}</p>
              {(data as any).sourceUrl && (
                <a href={(data as any).sourceUrl} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-orange-400 hover:underline truncate block mt-0.5">
                  {(data as any).sourceUrl}
                </a>
              )}
            </div>
          </div>
        ) : null}

        {/* 영상 정보 */}
        <div>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <Badge variant="outline" className={`text-xs ${catInfo.color}`}>
              {catInfo.icon} {catInfo.label}
            </Badge>
            <span className="text-zinc-500 text-sm">{data.channel}</span>
          </div>
          <h1 className="text-lg font-bold text-zinc-100">{data.title}</h1>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5">
            {data.videoPublishedAt && (
              <span className="text-xs text-zinc-600">
                📅 업로드 {new Date(data.videoPublishedAt).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
              </span>
            )}
            {data.summarizedAt && (
              <span className="text-xs text-zinc-600">
                🤖 요약 {new Date(data.summarizedAt).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
              </span>
            )}
            {data.transcriptSource && (
              <span className="text-xs text-zinc-600">자막 출처: {data.transcriptSource}</span>
            )}
          </div>
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
            <div className="flex flex-col gap-4">
              <SummaryShell
                category={data.category}
                summary={data.summary}
                onSeek={handleSeek}
                sessionId={sessionId}
                onComment={handleComment}
                commentCounts={commentCounts}
                transcriptSource={data.transcriptSource}
              />
              {/* 퀴즈 버튼 — 영어/학습 카테고리만 */}
              {(data.category === 'english' || data.category === 'learning') && (
                <button
                  onClick={handleGenerateQuiz}
                  disabled={quizLoading}
                  className="w-full py-3.5 rounded-2xl border border-dashed border-violet-500/40 bg-violet-500/5 hover:bg-violet-500/10 text-violet-400 hover:text-violet-300 font-semibold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {quizLoading ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                      퀴즈 생성 중...
                    </>
                  ) : (
                    <>🧠 퀴즈 생성하기</>
                  )}
                </button>
              )}

              {/* 워크시트 버튼 — 영어 카테고리만 */}
              {data.category === 'english' && (
                <div className="space-y-2">
                  <div className="flex gap-1.5">
                    {([
                      { id: 'elementary', label: '초등' },
                      { id: 'middle',     label: '중등' },
                      { id: 'advanced',   label: '고급' },
                    ] as const).map(lv => (
                      <button
                        key={lv.id}
                        onClick={() => setWorksheetLevel(lv.id)}
                        className={`flex-1 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
                          worksheetLevel === lv.id
                            ? 'bg-orange-500/20 border-orange-500/50 text-orange-400'
                            : 'bg-[#32302e] border-white/10 text-[#75716e] hover:text-white'
                        }`}
                      >
                        {lv.label}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={handleGenerateWorksheet}
                    disabled={worksheetLoading}
                    className="w-full py-3.5 rounded-2xl border border-dashed border-orange-500/40 bg-orange-500/5 hover:bg-orange-500/10 text-orange-400 hover:text-orange-300 font-semibold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {worksheetLoading ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                        </svg>
                        워크시트 생성 중...
                      </>
                    ) : (
                      <>📝 워크시트 만들기</>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 메타인지 자기점검 — summary 탭에서만 표시 */}
          {activeTab === 'summary' && (
            <MetaCheckButtons metaLevel={metaLevel} onSelect={handleMeta} />
          )}

          {activeTab === 'transcript' && (
            <div className="bg-[#2a2826] rounded-2xl p-6 border border-white/5 space-y-3 shadow-lg h-[500px] overflow-y-auto">
              <h2 className="text-xl font-bold border-b border-white/10 pb-4 mb-4">전체 자막</h2>
              {data.transcript ? (() => {
                const lines = data.transcript.split('\n')
                const parsed: { ts: string; text: string }[] = []
                for (const line of lines) {
                  const m = line.match(/^\[([\d:]+)\]\s(.*)/)
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

        {/* 하단 버튼 영역 — 저장하기(flex-1) + 댓글/PDF/공유(아이콘) */}
        <div className="flex gap-2 mt-4">
          {savedItem ? (
            <button
              onClick={handleToggleVisibility}
              disabled={togglingVisibility}
              className={`flex-1 h-12 rounded-xl font-bold text-xs transition-all disabled:opacity-50 border px-3 ${
                savedItem.isPublic
                  ? 'bg-[#32302e] border-white/10 text-[#a4a09c] hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-400'
                  : 'bg-[#32302e] border-white/10 text-[#a4a09c] hover:bg-green-500/10 hover:border-green-500/30 hover:text-green-400'
              }`}
            >
              {togglingVisibility ? '변경 중...' : savedItem.isPublic ? '🌍 공개 중' : '🔒 비공개'}
            </button>
          ) : (
            <Button
              className="flex-1 bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 text-white font-bold h-12 text-sm border-none"
              onClick={() => setShowSaveModal(true)}
            >
              {fromSquare ? '📥 나도 저장' : '📚 저장하기'}
            </Button>
          )}

          {/* 시청파티 버튼 — YouTube 영상만 */}
          {data.videoId && (
            <button
              onClick={() => setShowRoomModal(true)}
              className="h-12 w-12 border border-white/10 bg-[#32302e] text-white hover:bg-orange-500/15 hover:border-orange-500/30 hover:text-orange-400 transition-all rounded-xl flex items-center justify-center"
              title="시청파티 만들기"
            >
              <span className="text-lg leading-none">🎬</span>
            </button>
          )}

          {/* 댓글 버튼 */}
          <button
            onClick={handleCommentIconClick}
            className="h-12 w-12 border border-white/10 bg-[#32302e] text-white hover:bg-[#3d3a38] hover:border-white/20 transition-all rounded-xl flex items-center justify-center relative"
            title="댓글 보기"
          >
            <span className="text-lg leading-none">💬</span>
            {commentCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-orange-500 text-white text-[9px] font-bold flex items-center justify-center">
                {commentCount}
              </span>
            )}
          </button>

          {/* PDF 다운로드 버튼 */}
          <button
            onClick={handleDownloadPdf}
            disabled={downloading}
            className="h-12 w-12 border border-white/10 bg-[#32302e] text-white hover:bg-[#3d3a38] hover:border-white/20 transition-all rounded-xl disabled:opacity-50 flex items-center justify-center"
            title="PDF 다운로드"
          >
            {downloading ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            )}
          </button>

          {/* 공유 버튼 — 모바일: 공유 시트 / PC: 링크 복사 */}
          <button
            onClick={handleShare}
            disabled={sharing}
            className={`h-12 w-12 border rounded-xl disabled:opacity-50 flex items-center justify-center transition-all ${
              shareCopied
                ? 'border-green-500/40 bg-green-500/10 text-green-400'
                : 'border-white/10 bg-[#32302e] text-white hover:bg-[#3d3a38] hover:border-white/20'
            }`}
            title={shareCopied ? '링크 복사됨!' : '링크 공유 / 복사'}
          >
            {shareCopied ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : sharing ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
            )}
          </button>
        </div>

        {/* 댓글 섹션 */}
        <div ref={commentSectionRef}>
          <CommentSection
            sessionId={sessionId as string}
            focusSegmentId={focusSegment?.id ?? null}
            focusSegmentLabel={focusSegment?.label ?? null}
            onClearFocus={() => setFocusSegment(null)}
            onCountChange={setCommentCount}
          />
        </div>

        <Button variant="ghost" className="text-zinc-500 mb-10" onClick={() => router.push('/')}>
          ← 새 영상 요약하기
        </Button>
      </div>

      {/* 숨겨진 PDF 렌더링 영역 */}
      <div style={{ position: 'absolute', left: '-9999px', top: 0, pointerEvents: 'none', zIndex: -1 }}>
        <div ref={pdfRef}>
          {data && <SummaryPdfTemplate data={data} qrDataUrl={qrDataUrl} />}
        </div>
      </div>

      {quiz && <QuizPanel quiz={quiz} onClose={() => setQuiz(null)} />}
      {worksheet && <WorksheetPanel worksheet={worksheet} onClose={() => setWorksheet(null)} />}

      {/* 레시피 음성 제어 — YouTube 영상이 있을 때만 */}
      {data.category === 'recipe' && data.videoId && (data.summary as any)?.steps?.length > 0 && (
        <VoiceControl playerRef={playerRef} steps={(data.summary as any).steps} />
      )}

      <DocentChat
        title={data.title}
        category={data.category}
        summaryData={data.summary}
      />

      {showRoomModal && data.videoId && (
        <CreateRoomModal
          sessionId={sessionId}
          videoId={data.videoId}
          title={data.title}
          thumbnail={data.thumbnail ?? ''}
          onClose={() => setShowRoomModal(false)}
        />
      )}

      {showSaveModal && (
        <SaveModal
          data={data}
          onClose={() => {
            setShowSaveModal(false)
            const uid = user?.uid || getLocalUserId()
            getSavedSummaryBySessionId(uid, data.sessionId).then(setSavedItem).catch(() => {})
          }}
        />
      )}
    </div>
  )
}

// ─── 메타인지 자기점검 버튼 ───────────────────────
function MetaCheckButtons({
  metaLevel,
  onSelect,
}: {
  metaLevel: 'complete' | 'confused' | 'unknown' | null
  onSelect: (level: 'complete' | 'confused' | 'unknown') => void
}) {
  const buttons = [
    { level: 'complete' as const, emoji: '✅', label: '완전이해', color: 'border-emerald-500/30 hover:bg-emerald-500/10 hover:border-emerald-500/60 text-emerald-400', activeColor: 'bg-emerald-500/20 border-emerald-500 text-emerald-300' },
    { level: 'confused' as const, emoji: '🤔', label: '알쏭달쏭', color: 'border-yellow-500/30 hover:bg-yellow-500/10 hover:border-yellow-500/60 text-yellow-400', activeColor: 'bg-yellow-500/20 border-yellow-500 text-yellow-300' },
    { level: 'unknown' as const,  emoji: '❓', label: '전혀모름',  color: 'border-red-500/30 hover:bg-red-500/10 hover:border-red-500/60 text-red-400',       activeColor: 'bg-red-500/20 border-red-500 text-red-300' },
  ]

  return (
    <div className="mt-4 pt-4 border-t border-white/5">
      <p className="text-xs text-gray-500 mb-3 text-center">이 영상을 얼마나 이해했나요?</p>
      <div className="flex gap-2">
        {buttons.map(btn => (
          <button
            key={btn.level}
            onClick={() => onSelect(btn.level)}
            className={`flex-1 py-3 rounded-2xl border text-sm font-bold transition-all ${metaLevel === btn.level ? btn.activeColor : btn.color}`}
          >
            <span className="block text-xl mb-0.5">{btn.emoji}</span>
            {btn.label}
          </button>
        ))}
      </div>
      {metaLevel && (
        <p className="text-center text-xs text-gray-600 mt-2">
          {metaLevel === 'complete' ? '✓ 선생님께 완전이해로 기록됐어요' :
           metaLevel === 'confused' ? '✓ 선생님께 알쏭달쏭으로 기록됐어요' :
           '✓ 선생님께 전혀모름으로 기록됐어요'}
        </p>
      )}
    </div>
  )
}
