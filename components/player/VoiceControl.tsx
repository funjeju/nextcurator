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
  '첫': 1, '한': 1, '일': 1, '하나': 1, '1': 1,
  '두': 2, '둘': 2, '이': 2, '2': 2,
  '세': 3, '셋': 3, '삼': 3, '3': 3,
  '네': 4, '넷': 4, '사': 4, '4': 4,
  '다섯': 5, '오': 5, '5': 5,
  '여섯': 6, '육': 6, '6': 6,
  '일곱': 7, '칠': 7, '7': 7,
  '여덟': 8, '팔': 8, '8': 8,
  '아홉': 9, '구': 9, '9': 9,
  '열': 10, '십': 10, '10': 10,
}

type PermissionState = 'unknown' | 'granted' | 'denied' | 'requesting'

function scrollToStep(num: number) {
  document.getElementById(`seg-step-${num}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

function getCurrentStepFromTime(steps: RecipeStep[], currentTime: number): number {
  let activeStep = 0
  for (const step of steps) {
    const secs = timestampToSeconds(step.timestamp)
    if (secs <= currentTime) activeStep = step.step
    else break
  }
  return activeStep
}

export default function VoiceControl({ playerRef, steps }: Props) {
  const [listening, setListening]   = useState(false)
  const [transcript, setTranscript] = useState('')
  const [feedback, setFeedback]     = useState('')
  const [supported, setSupported]   = useState(false)
  const [permission, setPermission] = useState<PermissionState>('unknown')
  const [active, setActive]         = useState(false)

  const recognitionRef    = useRef<any>(null)
  const feedbackTimer     = useRef<ReturnType<typeof setTimeout> | null>(null)
  const streamRef         = useRef<MediaStream | null>(null)
  const activeRef         = useRef(false)
  const startedAt         = useRef<number>(0)
  const wasMutedRef       = useRef(false)
  const currentStepRef    = useRef(1)
  const lastAutoStepRef   = useRef(0)

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

  // 재생 중 현재 단계 자동 추적 → 스크롤
  useEffect(() => {
    if (!active) return
    const interval = setInterval(() => {
      const player = playerRef.current
      if (!player) return
      const currentTime = player.getCurrentTime?.()
      if (typeof currentTime !== 'number') return
      const stepNum = getCurrentStepFromTime(steps, currentTime)
      if (stepNum > 0 && stepNum !== lastAutoStepRef.current) {
        lastAutoStepRef.current = stepNum
        currentStepRef.current = stepNum
        scrollToStep(stepNum)
      }
    }, 2000)
    return () => clearInterval(interval)
  }, [active, steps, playerRef])

  const showFeedback = useCallback((msg: string) => {
    setFeedback(msg)
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current)
    if (msg) feedbackTimer.current = setTimeout(() => setFeedback(''), 3000)
  }, [])

  const seekToStep = useCallback((num: number, player: YT.Player) => {
    const step = steps.find(s => s.step === num)
    if (!step) { showFeedback(`❌ ${num}단계가 없어요`); return }
    if (!step.timestamp || step.timestamp === '00:00') { showFeedback(`⚠️ ${num}단계 타임스탬프 없음`); return }
    player.seekTo(timestampToSeconds(step.timestamp), true)
    player.playVideo()
    currentStepRef.current = num
    lastAutoStepRef.current = num
    scrollToStep(num)
    showFeedback(`✅ ${num}단계 재생`)
  }, [steps, showFeedback])

  const executeCommand = useCallback((text: string) => {
    const t = text.trim().toLowerCase()
    const player = playerRef.current
    if (!player) { showFeedback('❌ 플레이어가 준비되지 않았어요'); return }

    // 다음단계 / 전단계
    if (/다음\s*단계|next/.test(t)) {
      const next = Math.min(steps.length, currentStepRef.current + 1)
      return seekToStep(next, player)
    }
    if (/전\s*단계|이전\s*단계|prev/.test(t)) {
      const prev = Math.max(1, currentStepRef.current - 1)
      return seekToStep(prev, player)
    }

    // 숫자 단계 (아라비아 숫자)
    const digitMatch = t.match(/(\d+)\s*단계/)
    if (digitMatch) return seekToStep(parseInt(digitMatch[1]), player)

    // 한국어 수사 단계 — 더 긴 키워드 우선 (다섯, 여섯 등)
    const sorted = Object.entries(KOR_NUM).sort((a, b) => b[0].length - a[0].length)
    for (const [kor, num] of sorted) {
      if (t.includes(`${kor}단계`) || t.includes(`${kor} 단계`)) return seekToStep(num, player)
    }

    // N초 뒤로 / 앞으로
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
  }, [playerRef, steps, seekToStep, showFeedback])

  const startRecognition = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) return

    const rec = new SR()
    rec.lang = 'ko-KR'
    rec.continuous = true
    rec.interimResults = false
    recognitionRef.current = rec
    startedAt.current = Date.now()

    rec.onstart = () => {
      setListening(true); setTranscript(''); setFeedback('')
      const player = playerRef.current
      if (player && !wasMutedRef.current) player.unMute()
    }
    rec.onresult = (e: any) => {
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

      // 재시작 전 YouTube 뮤트 → OS 오디오 포커스 충돌 방지
      const player = playerRef.current
      wasMutedRef.current = player?.isMuted?.() ?? false
      if (player) player.mute()

      const elapsed = Date.now() - startedAt.current
      const delay = elapsed < 1000 ? 2000 : 500
      setTimeout(() => {
        if (activeRef.current) startRecognition()
      }, delay)
    }

    try { rec.start() } catch { setListening(false) }
  }, [executeCommand, showFeedback, playerRef])

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
      {/* 피드백 버블 */}
      {(transcript || feedback) && (
        <div className="bg-[#1c1a18] border border-white/15 rounded-2xl px-3.5 py-2.5 shadow-2xl max-w-[240px] space-y-0.5 animate-in fade-in slide-in-from-bottom-2 duration-150">
          {transcript && <p className="text-[#75716e] text-[11px] leading-snug">"{transcript}"</p>}
          {feedback    && <p className="text-white text-xs font-medium leading-snug">{feedback}</p>}
        </div>
      )}

      {/* 영상 끊김 안내 */}
      {active && !feedback && !transcript && (
        <div className="bg-[#1c1a18] border border-orange-500/10 rounded-2xl px-3 py-2 max-w-[200px]">
          <p className="text-[#75716e] text-[10px] leading-snug">영상이 끊기면 YouTube 플레이어 음소거 후 사용하세요</p>
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
