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
import BlogDraftModal from '@/components/blog/BlogDraftModal'
import ShortsScriptModal from '@/components/shorts/ShortsScriptModal'
import RoomClient from '@/app/room/[roomId]/RoomClient'
import WorksheetPanel from '@/components/worksheet/WorksheetPanel'
import type { QuizData, WorksheetData } from '@/types/summary'
import Header from '@/components/common/Header'
import { SummarizeResponse } from '@/types/summary'
import AdBanner from '@/components/ads/AdBanner'
import ContextualAdBanner from '@/components/ads/ContextualAdBanner'
import SegmentedSummaryPanel from '@/components/summary/SegmentedSummaryPanel'
import { useAuth } from '@/providers/AuthProvider'
import { getSavedSummaryBySessionId, updateSummaryVisibility } from '@/lib/db'
import { getLocalUserId } from '@/lib/user'
import { getCommentsBySession } from '@/lib/comments'
import type { SavedSummary } from '@/lib/db'
import type { Comment } from '@/lib/comments'
import { addBookmark, getBookmarks, deleteBookmark, secsToLabel, VideoBookmark } from '@/lib/videoBookmark'

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
  const isTempReanalyze = searchParams.get('temp') === '1'
  const { user, userProfile, openAuthModal } = useAuth()
  const [data, setData] = useState<SummarizeResponse | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [savedItem, setSavedItem] = useState<SavedSummary | null>(null)
  const playerRef = useRef<YT.Player | null>(null)
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [showRoomModal, setShowRoomModal] = useState(false)
  const [showBlogModal, setShowBlogModal] = useState(false)
  const [showShortsModal, setShowShortsModal] = useState(false)
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'summary' | 'transcript' | 'segments' | 'reanalyze'>('summary')
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

  // 유튜브 댓글 방향성 요약
  const [ytCommentSummary, setYtCommentSummary] = useState<string | null>(null)
  const [ytCommentSummaryLoading, setYtCommentSummaryLoading] = useState(false)

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

  // 배속
  const [playbackRate, setPlaybackRate] = useState(1)
  const [showSpeedMenu, setShowSpeedMenu] = useState(false)

  // 타임스탬프 북마크
  const [showBookmarkModal, setShowBookmarkModal] = useState(false)
  const [showBookmarkPanel, setShowBookmarkPanel] = useState(false)
  const [showBookmarkPanelTop, setShowBookmarkPanelTop] = useState(false)
  const [bookmarkMemo, setBookmarkMemo] = useState('')
  const [bookmarkSec, setBookmarkSec] = useState(0)
  const [bookmarkSaving, setBookmarkSaving] = useState(false)
  const [bookmarkSaved, setBookmarkSaved] = useState(false)
  const [videoBookmarks, setVideoBookmarks] = useState<VideoBookmark[]>([])

  // 상품/장소 추출
  const [extractedItems, setExtractedItems] = useState<{ products: any[]; places: any[] } | null>(null)
  const [extractingItems, setExtractingItems] = useState(false)

  // 구간별 요약 (30분+ 영상)
  const [segments, setSegments] = useState<any[] | null>(null)
  const [segmentsLoading, setSegmentsLoading] = useState(false)
  const isLongVideo = useMemo(() => {
    if (!data?.transcript) return false
    const matches = [...data.transcript.matchAll(/\[(\d{1,2}:\d{2}(?::\d{2})?)\]/g)]
    if (matches.length === 0) return false
    const last = matches[matches.length - 1][1]
    const parts = last.split(':').map(Number)
    const secs = parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : parts[0] * 60 + parts[1]
    return secs >= 1800  // 30분 이상
  }, [data?.transcript])

  useEffect(() => {
    if (!data?.videoId) return
    import('qrcode').then(QRCode => {
      QRCode.toDataURL(`https://www.youtube.com/watch?v=${data.videoId}`, { width: 96, margin: 1 })
        .then(setQrDataUrl)
        .catch(() => {})
    })
  }, [data?.videoId])

  const handleDownloadPdf = async () => {
    if (!user) { openAuthModal('login'); return }
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

        // 5. saved_summaries doc ID로 직접 조회 (매거진 링크 등 doc ID가 sessionId로 사용된 경우 대응)
        const docByIdSnap = await getDoc(doc(db, 'saved_summaries', sessionId as string))
        if (docByIdSnap.exists()) {
          const saved = docByIdSnap.data()
          if (saved.summary) {
            const fetched = saved as unknown as SummarizeResponse
            sessionStorage.setItem(`summary_${sessionId}`, JSON.stringify(fetched))
            setData(fetched)
            return
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

  // 유튜브 댓글 방향성 요약 — 저장된 값 우선, 없으면 API 호출
  useEffect(() => {
    if (!data?.videoId || ytCommentSummary !== null || ytCommentSummaryLoading) return
    // 요약 시점에 이미 생성된 값이 있으면 API 호출 없이 바로 사용
    if ((data as any).ytCommentSummary) {
      setYtCommentSummary((data as any).ytCommentSummary)
      return
    }
    setYtCommentSummaryLoading(true)
    fetch('/api/yt-comment-summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoId: data.videoId }),
    })
      .then(r => r.ok ? r.json() : null)
      .then(res => setYtCommentSummary(res?.summary ?? ''))
      .catch(() => setYtCommentSummary(''))
      .finally(() => setYtCommentSummaryLoading(false))
  }, [data?.videoId])

  // 이 영상의 북마크 로드
  useEffect(() => {
    if (!user?.uid || !sessionId) return
    getBookmarks(user.uid).then(all => {
      setVideoBookmarks(all.filter(b => b.sessionId === sessionId).sort((a, b) => a.timestampSec - b.timestampSec))
    }).catch(() => {})
  }, [user?.uid, sessionId, bookmarkSaved])

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
        if (!confirm('이 영상을 라이브러리에 저장하셨나요?\n저장하지 않으면 분석 내용이 사라집니다.\n\n계속 이동하려면 확인, 머물려면 취소를 누르세요.')) {
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

  const handlePlayerReady = useCallback((player: YT.Player) => {
    playerRef.current = player
    // 교사가 설정한 클립 구간이 있으면 시작 위치로 이동
    const clipStart = (data as any).clipStart
    const clipEnd   = (data as any).clipEnd
    if (clipStart > 0) {
      player.seekTo(clipStart, true)
    }
    // clipEnd 경계: 200ms마다 현재 시간 확인 후 자동 정지
    if (clipEnd > 0) {
      const interval = setInterval(() => {
        const p = playerRef.current
        if (!p) { clearInterval(interval); return }
        try {
          const state = p.getPlayerState()
          // 1 = playing
          if (state === 1 && p.getCurrentTime() >= clipEnd) {
            p.pauseVideo()
          }
        } catch { clearInterval(interval) }
      }, 200)
    }
  }, [data])
  const handleSeek = useCallback((ts: string) => {
    if (playerRef.current) {
      playerRef.current.seekTo(timestampToSeconds(ts), true)
      playerRef.current.playVideo()
    }
  }, [])

  const handleSeekAndScroll = useCallback((ts: string) => {
    // 1. 영상 seek
    if (playerRef.current) {
      playerRef.current.seekTo(timestampToSeconds(ts), true)
      playerRef.current.playVideo()
    }
    // 2. summary 탭 전환
    setActiveTab('summary')
    // 3. 해당 타임스탬프 단락으로 스크롤
    setTimeout(() => {
      const badge = document.querySelector(`[data-ts="${ts}"]`) as HTMLElement | null
      if (badge) {
        badge.scrollIntoView({ behavior: 'smooth', block: 'center' })
        // 잠깐 하이라이트
        badge.classList.add('ring-2', 'ring-orange-500', 'ring-offset-1')
        setTimeout(() => badge.classList.remove('ring-2', 'ring-orange-500', 'ring-offset-1'), 1500)
      }
    }, 150)
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
  // fromSquare=true 이면 타인 요약 → 새 sessionId로 이동하되 Firestore에 저장하지 않는 임시 모드
  const handleReanalyze = async (category: string) => {
    if (!data?.transcript && !data?.videoId) return
    setReanalyzing(true)
    setReanalyzeCategory(category)
    try {
      const isTranscriptSource = (data as any).sourceType === 'voice' || (data as any).sourceType === 'pdf'

      let res: Response
      if (isTranscriptSource) {
        // 음성/PDF → transcript 기반 재분석
        res = await fetch('/api/reanalyze-transcript', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transcript: data.transcript,
            title: data.title,
            category,
            sourceType: (data as any).sourceType,
            noSave: fromSquare,
          }),
        })
      } else {
        // YouTube/URL → 기존 방식
        res = await fetch('/api/summarize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: `https://www.youtube.com/watch?v=${data.videoId}`,
            category,
            noSave: fromSquare,
          }),
        })
      }

      if (!res.ok) { const e = await res.json(); throw new Error(e.error) }
      let newData: SummarizeResponse = await res.json()

      // 비한국어 영상 재분석 시 언어선택 프롬프트가 올 수 있음 → 자동으로 원문 언어로 재요청
      if ((newData as any).needsLangChoice) {
        const res2 = await fetch('/api/summarize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: `https://www.youtube.com/watch?v=${data.videoId}`,
            category,
            summaryLang: 'original',
            cachedTranscript: (newData as any).cachedTranscript,
            cachedVideoInfo: (newData as any).cachedVideoInfo,
            noSave: fromSquare,
          }),
        })
        if (!res2.ok) { const e = await res2.json(); throw new Error(e.error) }
        newData = await res2.json()
      }

      sessionStorage.setItem(`summary_${newData.sessionId}`, JSON.stringify(newData))
      // fromSquare 임시 모드: URL에 ?temp=1 추가하여 저장 유도 배너 표시
      router.push(`/result/${newData.sessionId}${fromSquare ? '?temp=1' : ''}`)
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

  // 학생 계정 공통 로그 헬퍼
  const logStudentActivity = useCallback(async (type: string, value: Record<string, any>) => {
    if (!user || !data) return
    const { getUserProfile } = await import('@/lib/db')
    const p = await getUserProfile(user.uid)
    if (p?.role !== 'student' || !p.classCode) return
    fetch('/api/classroom/activity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentId: user.uid,
        studentName: p.studentName || p.displayName || '',
        classCode: p.classCode,
        type,
        videoId: data.videoId,
        sessionId: data.sessionId,
        videoTitle: data.title,
        value,
      }),
    }).catch(() => {})
  }, [user, data])

  // 시청 완료율 로그
  const handleWatchLog = useCallback((log: { durationSec: number; percentWatched: number; completed: boolean }) => {
    logStudentActivity('play', log)
  }, [logStudentActivity])

  // 퀴즈 정답 로그 + 오답 시 복습 스케줄 등록
  const handleQuizAnswer = useCallback((log: { questionIdx: number; question: string; selected: string; correct: boolean; metaLevel?: string }) => {
    logStudentActivity('quiz', log)
    // 오답이면 에빙하우스 복습 스케줄에 추가
    if (!log.correct && user && userProfile?.classCode) {
      const sessionId = data?.sessionId
      const videoId = data?.videoId || ''
      const videoTitle = data?.title ?? ''
      if (sessionId) {
        fetch('/api/review-schedule', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            studentId: user.uid,
            classCode: userProfile.classCode,
            sessionId,
            videoId,
            videoTitle,
            questionIdx: log.questionIdx,
            question: log.question,
          }),
        }).catch(() => {})
      }
    }
  }, [logStudentActivity, user, userProfile, data])

  // 퀴즈 메타인지 로그 (학습/영어 카테고리만)
  const handleQuizMeta = useCallback((log: { questionIdx: number; question: string; metaLevel: string }) => {
    logStudentActivity('meta', log)
  }, [logStudentActivity])

  // 댓글 작성 로그
  const handleCommentPosted = useCallback((text: string, segmentId: string | null) => {
    logStudentActivity('comment', { text, segmentId })
  }, [logStudentActivity])

  const openBookmarkModal = () => {
    if (!user) { openAuthModal('login'); return }
    const sec = playerRef.current ? playerRef.current.getCurrentTime() : 0
    setBookmarkSec(sec)
    setBookmarkMemo('')
    setBookmarkSaved(false)
    setShowBookmarkModal(true)
    setShowBookmarkPanel(false)
    setShowBookmarkPanelTop(false)
  }

  const handleBookmarkClick = openBookmarkModal
  const handleBookmarkClickTop = openBookmarkModal

  const handleBookmarkSave = async () => {
    if (!user || !data) return
    setBookmarkSaving(true)
    try {
      await addBookmark(user.uid, {
        videoId: data.videoId ?? '',
        sessionId,
        videoTitle: data.title,
        thumbnail: data.thumbnail,
        channel: data.channel,
        timestampSec: bookmarkSec,
        timestampLabel: secsToLabel(bookmarkSec),
        memo: bookmarkMemo.trim(),
      })
      setBookmarkSaved(true)
      setTimeout(() => {
        setShowBookmarkPanel(false)
        setShowBookmarkPanelTop(false)
      }, 800)
    } catch {
      alert('북마크 저장에 실패했습니다.')
    } finally {
      setBookmarkSaving(false)
    }
  }

  const handleExtractItems = async () => {
    if (!data || extractingItems) return
    setExtractingItems(true)
    try {
      const res = await fetch('/api/extract-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: data.transcript,
          title: data.title,
          category: data.category,
        }),
      })
      setExtractedItems(await res.json())
    } catch {
      alert('추출에 실패했습니다.')
    } finally {
      setExtractingItems(false)
    }
  }

  const handleSegmentAnalysis = async () => {
    if (!data?.transcript || segmentsLoading) return
    setSegmentsLoading(true)
    try {
      const res = await fetch('/api/summarize-segments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: data.transcript }),
      })
      if (!res.ok) {
        const err = await res.json()
        if (err.error === 'too_short_for_segments') {
          alert('구간 분석을 하기엔 영상이 너무 짧습니다.')
          return
        }
        throw new Error(err.error || '구간 분석 실패')
      }
      const { segments: segs } = await res.json()
      setSegments(segs)
    } catch (e) {
      alert('구간 분석에 실패했습니다.')
    } finally {
      setSegmentsLoading(false)
    }
  }

  const handleSegmentQuiz = async (segmentIndex: number) => {
    if (!segments) return []
    const seg = segments[segmentIndex]
    if (!seg) return []
    try {
      const res = await fetch('/api/segment-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ segment: seg, chunkText: seg.chunkText || '' }),
      })
      if (!res.ok) return []
      const { quiz } = await res.json()
      return quiz || []
    } catch {
      return []
    }
  }

  // 링크 복사/공유 — 모바일: 네이티브 공유 시트 (URL+텍스트만), PC: 클립보드 복사
  const handleShare = async () => {
    if (!data) return
    setSharing(true)
    const pageUrl = window.location.href
    const isMobile = typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0
    try {
      if (isMobile && navigator.share) {
        // url만 전달 — text를 같이 보내면 당근 등 일부 앱에서 텍스트+URL이 붙어서 링크가 깨짐
        await navigator.share({ url: pageUrl })
      } else {
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
      <Header />

      <div className="max-w-2xl mx-auto px-4 py-2 flex flex-col gap-6">

        {/* 플레이어 (YouTube가 아닌 경우 썸네일 or 소스 표시) */}
        {data.videoId ? (
          <div className="sticky top-[68px] md:top-[76px] z-40 bg-zinc-950 pb-2 shadow-[0_15px_20px_-10px_rgba(9,9,11,1)]">
            <div className="rounded-xl overflow-hidden shadow-2xl border border-white/10 ring-1 ring-black/50">
              <YoutubePlayer videoId={data.videoId} onPlayerReady={handlePlayerReady} onWatchLog={handleWatchLog} />
            </div>
            {/* 배속 + 북마크 컨트롤 */}
            <div className="flex items-center justify-end gap-2 px-1 pt-2">
              {/* 현재 시점 북마크 */}
              <div className="relative">
                <button
                  onClick={handleBookmarkClickTop}
                  className={`flex items-center gap-1 px-3 h-7 rounded-lg text-xs transition-colors border ${
                    showBookmarkPanelTop
                      ? 'bg-yellow-500/20 border-yellow-500/40 text-yellow-400'
                      : 'bg-white/5 hover:bg-yellow-500/15 border-white/5 hover:border-yellow-500/30 text-zinc-400 hover:text-yellow-400'
                  }`}
                  title="현재 시점 북마크"
                >
                  🔖 <span>북마크</span>
                </button>
              </div>
              <div className="relative">
                <button
                  onClick={() => setShowSpeedMenu(v => !v)}
                  className="flex items-center gap-1 px-3 h-7 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-zinc-400 hover:text-white transition-colors border border-white/5"
                >
                  🐇 <span className="font-mono">{playbackRate}x</span>
                  <span className="text-[9px] opacity-50 ml-0.5">▾</span>
                </button>
                {showSpeedMenu && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowSpeedMenu(false)} />
                    <div className="absolute bottom-9 right-0 flex gap-1 bg-zinc-900 border border-white/10 rounded-xl p-1.5 shadow-2xl z-20">
                      {[0.5, 0.75, 1, 1.25, 1.5, 2].map(r => (
                        <button
                          key={r}
                          onClick={() => {
                            setPlaybackRate(r)
                            setShowSpeedMenu(false)
                            playerRef.current?.setPlaybackRate(r)
                          }}
                          className={`px-2.5 py-1 rounded-lg text-xs transition-colors font-mono ${
                            r === playbackRate
                              ? 'bg-orange-500 text-white font-bold'
                              : 'text-zinc-400 hover:bg-white/10 hover:text-white'
                          }`}
                        >
                          {r}x
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        ) : (data as any).sourceType === 'voice' ? (
          <div className="rounded-xl bg-[#2a2826] border border-white/10 p-5 flex items-center gap-4">
            {data.thumbnail && (
              <img src={data.thumbnail} alt="" className="w-20 h-[45px] rounded-lg object-cover shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs text-[#75716e] mb-0.5">🎙 음성 녹음</p>
              <p className="text-white text-sm font-semibold truncate">{data.title}</p>
            </div>
          </div>
        ) : (data as any).sourceUrl || (data as any).sourceType === 'pdf' ? (
          <div className="rounded-xl bg-[#2a2826] border border-white/10 p-5 flex items-center gap-4">
            {data.thumbnail && (
              <img src={data.thumbnail} alt="" className="w-20 h-[45px] rounded-lg object-cover shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs text-[#75716e] mb-0.5">{(data as any).sourceType === 'pdf' ? '📄 PDF 문서' : '🌐 웹페이지'}</p>
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

        {/* 임시 재분석 배너 */}
        {isTempReanalyze && (
          <div className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl px-4 py-3">
            <span className="text-amber-400 text-base shrink-0">🔍</span>
            <div className="flex-1 min-w-0">
              <p className="text-amber-300 text-sm font-semibold">임시 분석 결과</p>
              <p className="text-amber-400/70 text-xs">이 분석은 나만 볼 수 있습니다. 원본 데이터는 변경되지 않았습니다.</p>
            </div>
            <button
              onClick={() => setShowSaveModal(true)}
              className="shrink-0 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-full transition-colors"
            >
              내 라이브러리에 저장
            </button>
          </div>
        )}

        {/* 자막 없음 경고 배너 */}
        {(data as any).transcriptWarning && (
          <div className="flex items-start gap-3 bg-yellow-500/10 border border-yellow-500/20 rounded-2xl px-4 py-3">
            <span className="text-yellow-400 text-base shrink-0 mt-0.5">⚠️</span>
            <div className="flex-1 min-w-0">
              <p className="text-yellow-300 text-sm font-semibold">자막 추출 실패</p>
              <p className="text-yellow-400/70 text-xs leading-relaxed mt-0.5">{(data as any).transcriptWarning}</p>
            </div>
          </div>
        )}

        {/* 영상 정보 */}
        <div>
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <Badge variant="outline" className={`text-xs ${catInfo.color} shrink-0`}>
                {catInfo.icon} {catInfo.label}
              </Badge>
              <span className="text-zinc-500 text-sm truncate">{data.channel}</span>
            </div>
            {/* 댓글 바로가기 — 카테고리 우측 상단 */}
            <button
              onClick={handleCommentIconClick}
              className="shrink-0 flex items-center gap-1.5 px-2.5 h-7 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors text-xs relative"
              title="댓글 보기"
            >
              <span>💬</span>
              <span>{commentCount > 0 ? `${commentCount}` : '댓글'}</span>
              {commentCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[14px] h-3.5 px-0.5 rounded-full bg-orange-500 text-white text-[8px] font-bold flex items-center justify-center leading-none">
                  {commentCount}
                </span>
              )}
            </button>
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
          </div>
        </div>

        {/* 타임라인 바 */}
        {data.videoId && (data as any).transcriptDuration > 0 && (
          <VideoTimeline
            summary={data.summary}
            category={data.category}
            totalSec={(data as any).transcriptDuration}
            onSeekAndScroll={handleSeekAndScroll}
          />
        )}

        {/* 탭 */}
        <div className="flex bg-[#32302e] rounded-xl p-1 border border-white/5 w-full mt-2">
          {(['summary', 'transcript', ...(isLongVideo ? ['segments'] : []), 'reanalyze'] as const).map(tab => {
            const labels: Record<string, string> = {
              summary: '기본 요약',
              transcript: '전체 자막',
              segments: '🗂 구간 분석',
              reanalyze: '🔄 다시 분석',
            }
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`flex-1 py-2.5 text-xs md:text-sm font-bold rounded-lg transition-all ${
                  activeTab === tab
                    ? tab === 'segments'
                      ? 'bg-indigo-600 text-white shadow'
                      : 'bg-[#23211f] text-white shadow'
                    : tab === 'segments'
                      ? 'text-indigo-400 hover:text-indigo-300'
                      : 'text-[#75716e] hover:text-white'
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
              {data.transcriptSource === 'none' && (
                <div className="flex items-start gap-2.5 px-4 py-3 rounded-2xl bg-yellow-500/8 border border-yellow-500/20 text-yellow-300 text-sm">
                  <span className="shrink-0 mt-0.5">⚠️</span>
                  <span>이 영상은 자막을 가져오지 못했습니다. 제목·채널 정보·영상 설명을 기반으로 요약했으며, 내용이 부정확할 수 있습니다.</span>
                </div>
              )}
              {user?.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL && (
                <div className="text-[11px] text-zinc-600 px-1">
                  📡 자막 출처: <span className="text-zinc-400 font-medium">{data.transcriptSource || '(미기록)'}</span>
                </div>
              )}
              <SummaryShell
                category={data.category}
                summary={data.summary}
                onSeek={handleSeek}
                sessionId={sessionId}
                onComment={handleComment}
                commentCounts={commentCounts}
                transcriptSource={data.transcriptSource}
                videoId={data.videoId}
                thumbnail={data.thumbnail}
              />

              {/* 광고 ① mid — 요약 직후, 카테고리 관련 광고 (요리→요리, 여행→여행) */}
              <ContextualAdBanner category={data.category} position="mid" />

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

          {/* 구간별 분석 탭 — 30분+ 영상 전용 */}
          {activeTab === 'segments' && isLongVideo && (
            <div className="flex flex-col gap-4 pt-2">
              {segments ? (
                <SegmentedSummaryPanel
                  segments={segments}
                  onSeek={handleSeek}
                  onRequestQuiz={handleSegmentQuiz}
                />
              ) : (
                <div className="rounded-2xl border border-indigo-500/30 bg-indigo-500/5 p-6 flex flex-col items-center gap-4 text-center">
                  <span className="text-4xl">🗂</span>
                  <div>
                    <p className="text-white font-semibold mb-1">구간별 심층 분석</p>
                    <p className="text-[#a4a09c] text-sm leading-relaxed">
                      30분 이상 영상입니다.<br />
                      10분 단위로 나눠 각 구간을 분석하고 퀴즈를 풀 수 있어요.
                    </p>
                  </div>
                  <button
                    onClick={handleSegmentAnalysis}
                    disabled={segmentsLoading}
                    className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-2xl transition-all disabled:opacity-50 text-sm"
                  >
                    {segmentsLoading ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                        </svg>
                        분석 중...
                      </>
                    ) : '구간 분석 시작하기'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 상품 & 장소 추출 — 여행/요리/뉴스만 */}
          {activeTab === 'summary' && (['travel', 'recipe', 'news'] as const).includes(data.category as any) && (
            <div className="mt-2">
              {!extractedItems ? (
                <button
                  onClick={handleExtractItems}
                  disabled={extractingItems}
                  className="w-full py-3.5 rounded-2xl border border-dashed border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 text-amber-400 hover:text-amber-300 font-semibold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {extractingItems ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                      추출 중...
                    </>
                  ) : '🛍️ 언급된 상품 & 장소 추출'}
                </button>
              ) : (
                <div className="bg-[#2a2826] rounded-2xl border border-white/8 p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-amber-400 font-bold text-sm">🛍️ 언급된 상품 & 장소</p>
                    <button
                      onClick={() => setExtractedItems(null)}
                      className="text-zinc-600 hover:text-zinc-400 text-xs"
                    >닫기</button>
                  </div>

                  {/* 상품 */}
                  {extractedItems.products.length > 0 && (
                    <div>
                      <p className="text-zinc-400 text-xs font-semibold mb-2">📦 상품 / 브랜드</p>
                      <div className="space-y-2">
                        {extractedItems.products.map((p: any, i: number) => (
                          <a
                            key={i}
                            href={`https://www.coupang.com/np/search?q=${encodeURIComponent(p.name)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-3 bg-[#32302e] rounded-xl p-3 hover:bg-[#3a3836] transition-colors group"
                          >
                            {/* 쿠팡 썸네일 플레이스홀더 */}
                            <div className="w-14 h-14 rounded-lg bg-[#fff] flex items-center justify-center shrink-0 overflow-hidden border border-white/10">
                              <img
                                src={`https://img1.coupangcdn.com/image/coupang/common/logo_coupang_w350.png`}
                                alt="coupang"
                                className="w-10 object-contain"
                                onError={(e) => { (e.target as HTMLImageElement).src = 'https://www.coupang.com/favicon.ico' }}
                              />
                            </div>
                            {/* 상품 정보 */}
                            <div className="flex-1 min-w-0">
                              <p className="text-white text-sm font-semibold leading-snug line-clamp-2">{p.name}</p>
                              <p className="text-zinc-500 text-xs mt-0.5 leading-relaxed line-clamp-1">{p.context}</p>
                              <div className="flex items-center gap-1.5 mt-1.5">
                                <span className="text-[10px] font-black text-[#e4003a] tracking-tight">COUPANG</span>
                                <span className="text-zinc-600 text-[10px]">·</span>
                                <span className="text-zinc-500 text-[10px]">link.coupang.com</span>
                              </div>
                            </div>
                            {/* 구매하러가기 버튼 */}
                            <div className="shrink-0">
                              <span className="text-[10px] px-2.5 py-1.5 rounded-lg bg-[#e4003a] text-white font-bold whitespace-nowrap group-hover:bg-[#c8002f] transition-colors">
                                구매하러가기
                              </span>
                            </div>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 장소 */}
                  {extractedItems.places.length > 0 && (
                    <div>
                      <p className="text-zinc-400 text-xs font-semibold mb-2">📍 장소</p>
                      <div className="space-y-2">
                        {extractedItems.places.map((pl: any, i: number) => (
                          <div key={i} className="flex items-start gap-3 bg-[#32302e] rounded-xl p-3">
                            <div className="flex-1 min-w-0">
                              <p className="text-white text-sm font-semibold">{pl.name}</p>
                              {pl.region && <span className="text-[10px] text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded mt-0.5 inline-block">{pl.region}</span>}
                              <p className="text-zinc-500 text-xs mt-0.5 leading-relaxed">{pl.context}</p>
                            </div>
                            <a
                              href={`https://map.kakao.com/?q=${encodeURIComponent(pl.name)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="shrink-0 text-[10px] px-2 py-1 rounded-lg bg-yellow-500/15 text-yellow-400 hover:bg-yellow-500/25 font-bold transition-colors"
                            >
                              지도
                            </a>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {extractedItems.products.length === 0 && extractedItems.places.length === 0 && (
                    <p className="text-zinc-600 text-sm text-center py-4">추출된 상품 및 장소가 없습니다.</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 광고 ② bottom — summary 탭 최하단, 가로 배너 */}
          {activeTab === 'summary' && (
            <ContextualAdBanner category={data?.category ?? ''} position="bottom" className="mt-2" />
          )}

          {activeTab === 'transcript' && (
            <div className="bg-[#2a2826] rounded-2xl p-6 border border-white/5 space-y-3 shadow-lg h-[500px] overflow-y-auto">
              <h2 className="text-xl font-bold border-b border-white/10 pb-4 mb-4">전체 자막</h2>
              {data.transcriptSource === 'none' ? (
                <div className="flex flex-col items-center gap-3 py-14 text-center">
                  <span className="text-3xl">🙈</span>
                  <p className="text-zinc-400 text-sm">자막을 가져올 수 없는 영상입니다.<br />자막이 비활성화되어 있거나 처리 중 오류가 발생했을 수 있습니다.</p>
                </div>
              ) : data.transcript ? (() => {
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

          {/* 시청파티 버튼 — YouTube 영상만, 로그인 필요 */}
          {data.videoId && (
            <button
              onClick={() => user ? setShowRoomModal(true) : openAuthModal('login')}
              className="h-12 w-12 border border-white/10 bg-[#32302e] text-white hover:bg-orange-500/15 hover:border-orange-500/30 hover:text-orange-400 transition-all rounded-xl flex items-center justify-center"
              title={user ? '시청파티 만들기' : '로그인 후 이용 가능'}
            >
              <span className="text-lg leading-none">🎬</span>
            </button>
          )}

          {/* 블로그 초안 버튼 */}
          <button
            onClick={() => setShowBlogModal(true)}
            className="h-12 w-12 border border-white/10 bg-[#32302e] text-white hover:bg-orange-500/15 hover:border-orange-500/30 hover:text-orange-400 transition-all rounded-xl flex items-center justify-center"
            title="블로그 초안 생성"
          >
            <span className="text-lg leading-none">✍️</span>
          </button>

          {/* 숏폼 스크립트 버튼 — YouTube 영상만 */}
          {data.videoId && (
            <button
              onClick={() => setShowShortsModal(true)}
              className="h-12 w-12 border border-white/10 bg-[#32302e] text-white hover:bg-pink-500/15 hover:border-pink-500/30 hover:text-pink-400 transition-all rounded-xl flex items-center justify-center"
              title="숏폼 스크립트 생성"
            >
              <span className="text-lg leading-none">✂️</span>
            </button>
          )}

          {/* 타임스탬프 북마크 버튼 — YouTube 영상만 */}
          {data.videoId && (
            <div className="relative">
              <button
                onClick={handleBookmarkClick}
                className={`h-12 w-12 border transition-all rounded-xl flex items-center justify-center relative ${
                  showBookmarkModal
                    ? 'bg-yellow-500/20 border-yellow-500/40 text-yellow-400'
                    : 'border-white/10 bg-[#32302e] text-white hover:bg-yellow-500/15 hover:border-yellow-500/30 hover:text-yellow-400'
                }`}
                title="북마크"
              >
                <span className="text-lg leading-none">🔖</span>
                {videoBookmarks.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-yellow-500 text-black text-[9px] font-black flex items-center justify-center">
                    {videoBookmarks.length}
                  </span>
                )}
              </button>
            </div>
          )}

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

        {/* 유튜브 댓글 방향성 요약 */}
        {data.videoId && (ytCommentSummaryLoading || ytCommentSummary) && (
          <div className="rounded-2xl bg-[#1e1c1a] border border-white/8 p-4">
            <div className="flex items-center gap-2 mb-2.5">
              <span className="text-base">💬</span>
              <span className="text-sm font-semibold text-zinc-200">유튜브 시청자 반응</span>
            </div>
            {ytCommentSummaryLoading ? (
              <div className="flex items-center gap-2 text-zinc-500 text-sm">
                <svg className="animate-spin w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                댓글 분석 중...
              </div>
            ) : ytCommentSummary ? (
              <p className="text-zinc-300 text-sm leading-relaxed">{ytCommentSummary}</p>
            ) : null}
          </div>
        )}

        {/* 댓글 섹션 */}
        <div ref={commentSectionRef}>
          <CommentSection
            sessionId={sessionId as string}
            focusSegmentId={focusSegment?.id ?? null}
            focusSegmentLabel={focusSegment?.label ?? null}
            onClearFocus={() => setFocusSegment(null)}
            onCountChange={setCommentCount}
            onCommentPosted={handleCommentPosted}
            summaryData={data}
            title={data?.title ?? ''}
            category={data?.category ?? ''}
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

      {quiz && (
        <QuizPanel
          quiz={quiz}
          onClose={() => setQuiz(null)}
          onAnswer={handleQuizAnswer}
          showMeta={data.category === 'learning' || data.category === 'english'}
          onMeta={data.category === 'learning' || data.category === 'english' ? handleQuizMeta : undefined}
        />
      )}
      {worksheet && <WorksheetPanel worksheet={worksheet} onClose={() => setWorksheet(null)} />}

      {/* 레시피 음성 제어 — YouTube 영상이 있을 때만 */}
      {data.category === 'recipe' && data.videoId && (data.summary as any)?.steps?.length > 0 && (
        <VoiceControl playerRef={playerRef} steps={(data.summary as any).steps} />
      )}

      <DocentChat
        title={data.title}
        category={data.category}
        summaryData={data.summary}
        playerRef={playerRef}
        transcript={data.transcript || ''}
      />

      {showRoomModal && data.videoId && (
        <CreateRoomModal
          sessionId={sessionId}
          videoId={data.videoId}
          title={data.title}
          thumbnail={data.thumbnail ?? ''}
          onClose={() => setShowRoomModal(false)}
          onRoomCreated={(roomId) => setActiveRoomId(roomId)}
        />
      )}

      {activeRoomId && (
        <RoomClient
          roomId={activeRoomId}
          onClose={() => setActiveRoomId(null)}
        />
      )}

      {showBlogModal && (
        <BlogDraftModal
          data={data}
          onClose={() => setShowBlogModal(false)}
        />
      )}

      {showShortsModal && (
        <ShortsScriptModal
          data={data}
          onClose={() => setShowShortsModal(false)}
        />
      )}

      {showSaveModal && (
        <SaveModal
          data={data}
          onClose={(saved) => {
            setShowSaveModal(false)
            if (saved) {
              // 저장 성공: Firestore 재조회 없이 직접 상태 업데이트 (모바일 재조회 실패 대응)
              setSavedItem({
                id: saved.id,
                userId: user?.uid || getLocalUserId(),
                folderId: saved.folderId,
                sessionId: data.sessionId,
                videoId: data.videoId ?? '',
                title: data.title,
                thumbnail: data.thumbnail ?? '',
                category: data.category,
                isPublic: saved.isPublic,
                createdAt: new Date(),
              } as any)
            } else {
              // 모달만 닫은 경우: 재조회
              const uid = user?.uid || getLocalUserId()
              getSavedSummaryBySessionId(uid, data.sessionId).then(setSavedItem).catch(() => {})
            }
          }}
        />
      )}

      {/* ── 북마크 통합 모달 ── */}
      {showBookmarkModal && data && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowBookmarkModal(false)} />
          <div className="relative w-full max-w-sm bg-[#1c1a18] rounded-3xl border border-yellow-500/20 shadow-2xl overflow-hidden">

            {/* 헤더 */}
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/8">
              <div className="flex items-center gap-2">
                <span className="text-lg">🔖</span>
                <p className="text-white font-bold text-sm">북마크</p>
                {videoBookmarks.length > 0 && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400 font-bold border border-yellow-500/20">
                    {videoBookmarks.length}개
                  </span>
                )}
              </div>
              <button onClick={() => setShowBookmarkModal(false)} className="text-zinc-500 hover:text-white text-lg transition-colors">✕</button>
            </div>

            {/* 새 북마크 추가 */}
            <div className="px-5 py-4 border-b border-white/8">
              <p className="text-zinc-500 text-xs font-semibold uppercase tracking-wider mb-3">현재 위치에 추가</p>
              <div className="flex items-center gap-2 mb-3">
                <span className="font-mono text-sm text-yellow-400 bg-yellow-500/10 px-2.5 py-1 rounded-lg border border-yellow-500/20 font-bold">
                  ▶ {secsToLabel(bookmarkSec)}
                </span>
                <span className="text-zinc-600 text-xs">현재 재생 위치</span>
              </div>
              <textarea
                value={bookmarkMemo}
                onChange={e => setBookmarkMemo(e.target.value)}
                placeholder="메모 추가 (선택)"
                rows={2}
                className="w-full bg-[#2a2826] border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-yellow-500/40 resize-none mb-3"
                autoFocus
              />
              <button
                onClick={handleBookmarkSave}
                disabled={bookmarkSaving || bookmarkSaved}
                className={`w-full py-2.5 rounded-xl text-sm font-bold transition-all ${
                  bookmarkSaved
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-yellow-500 hover:bg-yellow-400 text-black disabled:opacity-50'
                }`}
              >
                {bookmarkSaved ? '✓ 저장됨!' : bookmarkSaving ? '저장 중...' : '저장'}
              </button>
            </div>

            {/* 저장된 북마크 목록 */}
            {videoBookmarks.length > 0 && (
              <div className="px-5 py-4 max-h-60 overflow-y-auto">
                <p className="text-zinc-500 text-xs font-semibold uppercase tracking-wider mb-3">저장된 북마크</p>
                <div className="space-y-2">
                  {videoBookmarks.map(bm => (
                    <div
                      key={bm.id}
                      className="group flex items-start gap-3 p-2.5 rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
                      onClick={() => {
                        playerRef.current?.seekTo(bm.timestampSec, true)
                        setShowBookmarkModal(false)
                      }}
                    >
                      <span className="shrink-0 font-mono text-xs text-yellow-400 bg-yellow-500/10 px-2 py-1 rounded-lg border border-yellow-500/15 mt-0.5">
                        {bm.timestampLabel}
                      </span>
                      <div className="flex-1 min-w-0">
                        {bm.memo
                          ? <p className="text-zinc-300 text-sm leading-relaxed">{bm.memo}</p>
                          : <p className="text-zinc-600 text-xs italic">메모 없음</p>
                        }
                      </div>
                      <button
                        onClick={async e => {
                          e.stopPropagation()
                          await deleteBookmark(bm.id)
                          setVideoBookmarks(prev => prev.filter(b => b.id !== bm.id))
                        }}
                        className="shrink-0 text-zinc-700 hover:text-red-400 text-xs opacity-0 group-hover:opacity-100 transition-all mt-1"
                      >✕</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {videoBookmarks.length === 0 && (
              <div className="px-5 py-4 text-center text-zinc-700 text-xs">
                아직 저장된 북마크가 없어요
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── 영상 타임라인 바 ───────────────────────────
function VideoTimeline({ summary, category, totalSec, onSeekAndScroll }: {
  summary: any
  category: string
  totalSec: number
  onSeekAndScroll: (ts: string) => void
}) {
  if (!totalSec || totalSec < 60) return null

  // 카테고리별 타임스탬프 추출
  const points: { ts: string; label: string }[] = []
  const tsToSec = (ts: string) => {
    const parts = ts.split(':').map(Number)
    return parts.length === 2 ? parts[0] * 60 + parts[1] : parts[0] * 3600 + parts[1] * 60 + (parts[2] ?? 0)
  }
  const addPts = (arr: any[], key: string, labelKey: string) => {
    if (!Array.isArray(arr)) return
    arr.forEach(item => {
      if (item?.[key]) points.push({ ts: item[key], label: item[labelKey] || item[key] })
    })
  }

  if (category === 'learning') {
    addPts(summary.key_points, 'timestamp', 'point')
    addPts(summary.concepts, 'timestamp', 'name')
  } else if (category === 'news') {
    addPts(summary.implications, 'timestamp', 'point')
    addPts(summary.key_moments, 'timestamp', 'point')
  } else if (category === 'selfdev') {
    addPts(summary.insights, 'timestamp', 'point')
    addPts(summary.quotes, 'timestamp', 'text')
  } else if (category === 'travel') {
    addPts(summary.places, 'timestamp', 'name')
  } else if (category === 'story') {
    addPts(summary.timeline, 'timestamp', 'event')
  } else if (category === 'tips') {
    addPts(summary.tips, 'timestamp', 'title')
  } else if (category === 'recipe') {
    addPts(summary.steps, 'timestamp', 'desc')
  } else if (category === 'english') {
    addPts(summary.expressions, 'timestamp', 'text')
  }

  const valid = points.filter(p => p.ts && /^\d{1,2}:\d{2}/.test(p.ts))
  if (!valid.length) return null

  const fmtSec = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${String(sec).padStart(2, '0')}`
  }

  return (
    <div className="bg-[#2a2826] rounded-2xl border border-white/8 px-4 py-3 space-y-2">
      <p className="text-xs text-zinc-500 font-semibold">
        📊 전체 <span className="text-zinc-300 font-bold">{fmtSec(totalSec)}</span> 분석 완료 — 핵심 {valid.length}개 지점
      </p>
      <div className="relative h-6">
        {/* 베이스 바 */}
        <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-1.5 rounded-full bg-white/8" />
        {/* 채워진 부분 (가장 마지막 키포인트까지) */}
        <div
          className="absolute top-1/2 -translate-y-1/2 left-0 h-1.5 rounded-full bg-gradient-to-r from-orange-500/60 to-orange-400/30"
          style={{ width: `${Math.min(100, (tsToSec(valid[valid.length - 1].ts) / totalSec) * 100)}%` }}
        />
        {/* 마커들 */}
        {valid.map((p, i) => {
          const pct = Math.min(99, (tsToSec(p.ts) / totalSec) * 100)
          return (
            <div
              key={i}
              className="absolute top-1/2 -translate-y-1/2 group"
              style={{ left: `${pct}%` }}
            >
              <button
                onClick={() => onSeekAndScroll(p.ts)}
                className="w-2.5 h-2.5 rounded-full bg-orange-500 border-2 border-zinc-900 -translate-x-1/2 cursor-pointer hover:scale-125 hover:bg-orange-400 transition-transform block"
              />
              <div className="absolute bottom-5 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col items-center pointer-events-none z-10">
                <div className="bg-zinc-900 border border-white/15 rounded-lg px-2.5 py-1.5 shadow-xl min-w-max max-w-[180px]">
                  <p className="text-orange-400 font-mono text-[10px] font-bold">{p.ts} ▶</p>
                  <p className="text-zinc-200 text-[10px] leading-snug line-clamp-2">{p.label}</p>
                </div>
                <div className="w-1.5 h-1.5 bg-zinc-900 border-b border-r border-white/15 rotate-45 -mt-[3px]" />
              </div>
            </div>
          )
        })}
        {/* 시작/끝 레이블 */}
        <span className="absolute -bottom-4 left-0 text-[9px] text-white/60">0:00</span>
        <span className="absolute -bottom-4 right-0 text-[9px] text-white/60">{fmtSec(totalSec)}</span>
      </div>
      <div className="h-3" />
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
