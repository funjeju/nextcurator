'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

interface RecipeStep {
  step: number
  timestamp: string
  desc: string
}

interface Props {
  playerRef: React.RefObject<YT.Player | null>
  steps: RecipeStep[]
}

function timestampToSeconds(ts: string): number {
  if (!ts) return 0
  const parts = ts.split(':').map(Number)
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  return 0
}

const KOR_NUM: Record<string, number> = {
  '첫': 1, '한': 1, '일': 1, '하나': 1,
  '두': 2, '둘': 2, '이': 2,
  '세': 3, '셋': 3, '삼': 3,
  '네': 4, '넷': 4, '사': 4,
  '다섯': 5, '오': 5,
  '여섯': 6, '육': 6,
  '일곱': 7, '칠': 7,
  '여덟': 8, '팔': 8,
  '아홉': 9, '구': 9,
  '열': 10, '십': 10,
}

type PermissionState = 'unknown' | 'granted' | 'denied' | 'requesting'

export default function VoiceControl({ playerRef, steps }: Props) {
  const [listening, setListening]   = useState(false)
  const [transcript, setTranscript] = useState('')
  const [feedback, setFeedback]     = useState('')
  const [supported, setSupported]   = useState(false)
  const [permission, setPermission] = useState<PermissionState>('unknown')
  const [active, setActive]         = useState(false)

  const recognitionRef = useRef<any>(null)
  const feedbackTimer  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const streamRef      = useRef<MediaStream | null>(null)
  const activeRef      = useRef(false)
  const startedAt      = useRef<number>(0)

  useEffect(() => { activeRef.current = active }, [active])

  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) return
    setSupported(true)

    navigator.permissions?.query({ name: 'microphone' as PermissionName })
      .then(result => {
        setPermission(result.state === 'granted' ? 'granted' : result.state === 'denied' ? 'denied' : 'unknown')
        result.onchange = () => {
          setPermission(result.state === 'granted' ? 'granted' : result.state === 'denied' ? 'denied' : 'unknown')
        }
      })
      .catch(() => {})

    return () => {
      recognitionRef.current?.abort()
      streamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, [])

  const showFeedback = useCallback((msg: string) => {
    setFeedback(msg)
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current)
    if (msg) feedbackTimer.current = setTimeout(() => setFeedback(''), 3000)
  }, [])

  const executeCommand = useCallback((text: string) => {
    const t = text.trim().toLowerCase()
    const player = playerRef.current
    if (!player) { showFeedback('❌ 플레이어가 준비되지 않았어요'); return }

    const digitMatch = t.match(/(\d+)\s*단계/)
    if (digitMatch) return seekToStep(parseInt(digitMatch[1]), player)

    for (const [kor, num] of Object.entries(KOR_NUM)) {
      if (t.includes(`${kor}단계`) || t.includes(`${kor} 단계`)) return seekToStep(num, player)
    }

    const seekSecMatch = t.match(/(\d+)\s*초?\s*(뒤로?|앞으로?|back|forward)/)
    if (seekSecMatch) {
      const secs = parseInt(seekSecMatch[1])
      const isBack = /뒤|back/.test(seekSecMatch[2])
      const cur = player.getCurrentTime?.() ?? 0
      player.seekTo(isBack ? Math.max(0, cur - secs) : cur + secs, true)
      showFeedback(isBack ? `⏪ ${secs}초 뒤로` : `⏩ ${secs}초 앞으로`)
      return
    }

    if (/처음|맨 앞|처음부터|restart/.test(t)) {
      player.seekTo(0, true); player.playVideo(); showFeedback('⏮ 처음부터'); return
    }

    if (/재생|틀어|시작|계속|play/.test(t))               { player.playVideo();  showFeedback('▶️ 재생'); return }
    if (/멈춰|멈추|정지|일시정지|pause|스톱|stop/.test(t)) { player.pauseVideo(); showFeedback('⏸ 일시정지'); return }

    const rateMatch = t.match(/(\d+(?:\.\d+)?)\s*배속?/)
    if (rateMatch) {
      const r = Math.min(2, Math.max(0.25, parseFloat(rateMatch[1])))
      player.setPlaybackRate(r); showFeedback(`⚡ ${r}배속`); return
    }
    if (/느리게|천천히|slow/.test(t)) {
      const next = Math.max(0.25, parseFloat(((player.getPlaybackRate?.() ?? 1) - 0.25).toFixed(2)))
      player.setPlaybackRate(next); showFeedback(`🐢 ${next}배속`); return
    }
    if (/빠르게|빨리|fast/.test(t)) {
      const next = Math.min(2, parseFloat(((player.getPlaybackRate?.() ?? 1) + 0.25).toFixed(2)))
      player.setPlaybackRate(next); showFeedback(`🐇 ${next}배속`); return
    }
    if (/보통|정상|1배|원래/.test(t)) { player.setPlaybackRate(1); showFeedback('🔄 보통 속도'); return }

    showFeedback(`❓ "${text}" — 이해하지 못했어요`)
  }, [playerRef, steps, showFeedback])

  function seekToStep(num: number, player: YT.Player) {
    const step = steps.find(s => s.step === num)
    if (!step) { showFeedback(`❌ ${num}단계가 없어요`); return }
    if (!step.timestamp || step.timestamp === '00:00') { showFeedback(`⚠️ ${num}단계 타임스탬프 없음`); return }
    player.seekTo(timestampToSeconds(step.timestamp), true)
    player.playVideo()
    showFeedback(`✅ ${num}단계 재생`)
  }

  const startRecognition = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) return

    const rec = new SR()
    rec.lang = 'ko-KR'
    rec.continuous = true      // 세션 한 번만 열고 유지 → OS 오디오 포커스 충돌 방지
    rec.interimResults = false
    recognitionRef.current = rec
    startedAt.current = Date.now()

    rec.onstart  = () => { setListening(true); setTranscript(''); setFeedback('') }
    rec.onresult = (e: any) => {
      // continuous 모드: resultIndex부터 순회
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (!e.results[i].isFinal) continue
        const text = e.results[i][0].transcript.trim()
        setTranscript(text)
        executeCommand(text)
      }
    }
    rec.onerror = (e: any) => {
      if (e.error === 'not-allowed') {
        setPermission('denied')
        showFeedback('🔒 마이크 권한이 차단됐어요')
        activeRef.current = false
        setActive(false)
      } else if (e.error === 'no-speech' || e.error === 'aborted') {
        // 무시
      } else {
        showFeedback(`❌ ${e.error}`)
      }
      setListening(false)
    }
    rec.onend = () => {
      setListening(false)
      if (!activeRef.current) return

      // continuous = true 미지원 브라우저(iOS 등)는 즉시 onend가 올 수 있음
      // 세션이 1초 미만에 끝났으면 브라우저 미지원으로 간주, 재시작 간격 늘림
      const elapsed = Date.now() - startedAt.current
      const delay = elapsed < 1000 ? 2000 : 500
      setTimeout(() => {
        if (activeRef.current) startRecognition()
      }, delay)
    }

    try { rec.start() } catch { setListening(false) }
  }, [executeCommand, showFeedback])

  const stopAll = useCallback(() => {
    activeRef.current = false
    setActive(false)
    recognitionRef.current?.abort()
    setListening(false)
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }, [])

  const handleMicClick = useCallback(async () => {
    if (active) { stopAll(); return }

    if (permission === 'denied') {
      showFeedback('🔒 브라우저 설정에서 마이크를 허용해주세요')
      return
    }

    activeRef.current = true
    setActive(true)

    if (permission === 'granted') {
      startRecognition()
      return
    }

    setPermission('requesting')
    showFeedback('🎙 마이크 권한을 요청하는 중...')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      })
      streamRef.current = stream
      setPermission('granted')
      showFeedback('')
      startRecognition()
    } catch (err: any) {
      activeRef.current = false
      setActive(false)
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setPermission('denied')
        showFeedback('🔒 마이크 권한이 차단됐어요.')
      } else {
        showFeedback(`❌ 마이크를 사용할 수 없어요 (${err.name})`)
        setPermission('unknown')
      }
    }
  }, [active, permission, startRecognition, stopAll, showFeedback])

  if (!supported) return null

  return (
    <div className="fixed bottom-6 left-6 z-50 flex flex-col items-start gap-2">
      {(transcript || feedback) && (
        <div className="bg-[#1c1a18] border border-white/15 rounded-2xl px-3.5 py-2.5 shadow-2xl max-w-[240px] space-y-0.5 animate-in fade-in slide-in-from-bottom-2 duration-150">
          {transcript && <p className="text-[#75716e] text-[11px] leading-snug">"{transcript}"</p>}
          {feedback    && <p className="text-white text-xs font-medium leading-snug">{feedback}</p>}
        </div>
      )}

      <button
        onClick={handleMicClick}
        className={`w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all duration-200 ${
          permission === 'denied'
            ? 'bg-[#32302e] border border-red-500/30 opacity-60'
            : listening
            ? 'bg-red-500 scale-110 shadow-red-500/30'
            : active
            ? 'bg-orange-500/20 border border-orange-500/40 animate-pulse'
            : permission === 'requesting'
            ? 'bg-orange-500/20 border border-orange-500/40 animate-pulse'
            : 'bg-[#32302e] hover:bg-[#3d3a38] border border-white/10 hover:border-orange-500/40'
        }`}
        title={
          permission === 'denied'     ? '마이크 권한이 차단됨' :
          listening                   ? '듣는 중 (탭해서 중지)' :
          active                      ? '대기 중 (탭해서 중지)' :
          permission === 'requesting' ? '권한 요청 중...' :
          '음성 명령'
        }
      >
        {permission === 'denied' ? (
          <svg className="w-6 h-6 text-red-400/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
        ) : listening ? (
          <span className="relative flex items-center justify-center">
            <span className="absolute w-10 h-10 rounded-full bg-red-400/30 animate-ping" />
            <svg className="w-6 h-6 text-white relative" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2H3v2a9 9 0 0 0 8 8.94V23h2v-2.06A9 9 0 0 0 21 12v-2h-2z"/>
            </svg>
          </span>
        ) : (
          <svg className={`w-6 h-6 ${active ? 'text-orange-300' : 'text-[#a4a09c]'}`} fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2H3v2a9 9 0 0 0 8 8.94V23h2v-2.06A9 9 0 0 0 21 12v-2h-2z"/>
          </svg>
        )}
      </button>

      <p className="text-[#75716e] text-[10px] pl-1">
        {permission === 'denied'     ? '🔒 권한 차단됨' :
         listening                   ? '🔴 듣는 중...' :
         active                      ? '🟠 대기 중' :
         permission === 'requesting' ? '권한 요청 중...' :
         '🎙 음성 제어'}
      </p>
    </div>
  )
}
