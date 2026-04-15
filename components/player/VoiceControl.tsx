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
  const [listening, setListening]           = useState(false)
  const [transcript, setTranscript]         = useState('')
  const [feedback, setFeedback]             = useState('')
  const [supported, setSupported]           = useState(false)
  const [permission, setPermission]         = useState<PermissionState>('unknown')
  const [keepOn, setKeepOn]                 = useState(false)

  const recognitionRef  = useRef<any>(null)
  const feedbackTimer   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const streamRef       = useRef<MediaStream | null>(null)
  // Sync ref so onend closure always sees latest keepOn value
  const keepOnRef       = useRef(false)
  const listeningRef    = useRef(false)

  useEffect(() => { keepOnRef.current = keepOn }, [keepOn])
  useEffect(() => { listeningRef.current = listening }, [listening])

  // SpeechRecognition 지원 여부 + 기존 권한 상태 확인
  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) return
    setSupported(true)

    // Permissions API로 현재 마이크 권한 상태 확인 (지원하는 브라우저만 — iOS Safari 미지원)
    navigator.permissions?.query({ name: 'microphone' as PermissionName })
      .then(result => {
        setPermission(result.state === 'granted' ? 'granted' : result.state === 'denied' ? 'denied' : 'unknown')
        result.onchange = () => {
          setPermission(result.state === 'granted' ? 'granted' : result.state === 'denied' ? 'denied' : 'unknown')
        }
      })
      .catch(() => {
        // Permissions API 미지원 (iOS Safari 등) → unknown 유지
      })

    // cleanup: keep-on 중 언마운트 시 스트림 해제
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

    if (/재생|틀어|시작|계속|play/.test(t))          { player.playVideo();  showFeedback('▶️ 재생'); return }
    if (/멈춰|멈추|정지|일시정지|pause|스톱/.test(t)) { player.pauseVideo(); showFeedback('⏸ 일시정지'); return }

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

  // 실제 음성 인식 시작 (권한이 이미 확보된 상태에서 호출)
  const startRecognition = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) return

    const rec = new SR()
    rec.lang = 'ko-KR'
    // iOS Safari는 continuous=true를 제대로 지원하지 않으므로 false로 유지하고
    // keep-on 모드에서는 onend 후 수동으로 재시작
    rec.continuous = false
    rec.interimResults = false
    recognitionRef.current = rec

    rec.onstart  = () => { setListening(true); listeningRef.current = true; setTranscript(''); setFeedback('') }
    rec.onresult = (e: any) => {
      const text = e.results[0][0].transcript
      setTranscript(text)
      executeCommand(text)
    }
    rec.onerror = (e: any) => {
      if (e.error === 'not-allowed') {
        setPermission('denied')
        showFeedback('🔒 마이크 권한이 차단됐어요')
        keepOnRef.current = false
        setKeepOn(false)
      } else if (e.error === 'no-speech') {
        // keep-on 중에는 no-speech를 무시하고 재시작
        if (!keepOnRef.current) showFeedback('🔇 음성이 감지되지 않았어요')
      } else if (e.error === 'aborted') {
        // 사용자가 직접 중단 — 무시
      } else {
        showFeedback(`❌ ${e.error}`)
      }
      setListening(false)
      listeningRef.current = false
    }
    rec.onend = () => {
      setListening(false)
      listeningRef.current = false
      if (keepOnRef.current) {
        // keep-on 모드: 300ms 후 재시작 (iOS에서 연속 호출 시 crash 방지)
        setTimeout(() => {
          if (keepOnRef.current) startRecognition()
        }, 300)
      } else {
        // keep-on 꺼진 경우: 오디오 스트림 해제
        streamRef.current?.getTracks().forEach(t => t.stop())
        streamRef.current = null
      }
    }

    try { rec.start() } catch { setListening(false); listeningRef.current = false }
  }, [executeCommand, showFeedback])

  const stopAll = useCallback(() => {
    keepOnRef.current = false
    setKeepOn(false)
    recognitionRef.current?.abort()
    setListening(false)
    listeningRef.current = false
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }, [])

  const handleMicClick = useCallback(async () => {
    // 이미 활성화(listening 또는 keep-on) → 전체 중단
    if (listening || keepOn) {
      stopAll()
      return
    }

    // 권한이 이미 거부된 경우 → 설정 안내
    if (permission === 'denied') {
      showFeedback('🔒 브라우저 설정에서 마이크를 허용해주세요')
      return
    }

    // 권한이 이미 허용된 경우 → 바로 시작
    if (permission === 'granted') {
      startRecognition()
      return
    }

    // 권한 미확인 (첫 사용 or iOS) → getUserMedia로 권한 요청
    setPermission('requesting')
    showFeedback('🎙 마이크 권한을 요청하는 중...')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      // 스트림을 즉시 해제하지 않고 ref에 보관
      // iOS에서 오디오 하드웨어를 "warm" 상태로 유지해 SpeechRecognition 안정화
      streamRef.current = stream
      setPermission('granted')
      showFeedback('')
      startRecognition()
    } catch (err: any) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setPermission('denied')
        showFeedback('🔒 마이크 권한이 차단됐어요. 브라우저 주소창 옆 자물쇠 아이콘을 눌러 허용해주세요.')
      } else {
        showFeedback(`❌ 마이크를 사용할 수 없어요 (${err.name})`)
        setPermission('unknown')
      }
    }
  }, [listening, keepOn, permission, startRecognition, stopAll, showFeedback])

  const handleKeepOnToggle = useCallback(() => {
    if (keepOn) {
      stopAll()
    } else {
      keepOnRef.current = true
      setKeepOn(true)
      if (!listening) handleMicClick()
    }
  }, [keepOn, listening, stopAll, handleMicClick])

  if (!supported) return null

  const isActive = listening || keepOn

  return (
    <div className="fixed bottom-6 left-6 z-50 flex flex-col items-start gap-2">
      {/* 피드백 / 권한 안내 버블 */}
      {(transcript || feedback) && (
        <div className="bg-[#1c1a18] border border-white/15 rounded-2xl px-3.5 py-2.5 shadow-2xl max-w-[240px] space-y-0.5 animate-in fade-in slide-in-from-bottom-2 duration-150">
          {transcript && (
            <p className="text-[#75716e] text-[11px] leading-snug">"{transcript}"</p>
          )}
          {feedback && (
            <p className="text-white text-xs font-medium leading-snug">{feedback}</p>
          )}
        </div>
      )}

      {/* 첫 사용 툴팁 — 권한 미확인 상태에서만 */}
      {permission === 'unknown' && !isActive && !feedback && (
        <div className="bg-[#1c1a18] border border-orange-500/20 rounded-2xl px-3.5 py-2.5 shadow-xl max-w-[200px]">
          <p className="text-orange-300 text-[11px] leading-snug font-medium">마이크 권한을 요청해요</p>
          <p className="text-[#75716e] text-[10px] leading-snug mt-0.5">허용하면 바로 음성 제어 시작!</p>
        </div>
      )}

      {/* keep-on 토글 버튼 */}
      {permission !== 'denied' && (
        <button
          onClick={handleKeepOnToggle}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold border transition-all ${
            keepOn
              ? 'bg-red-500/15 border-red-500/30 text-red-400'
              : 'bg-[#32302e] border-white/10 text-[#75716e] hover:border-orange-500/30 hover:text-orange-300'
          }`}
          title="계속 듣기 모드 — 명령 후 자동으로 다시 인식 시작"
        >
          <span className={`w-1.5 h-1.5 rounded-full ${keepOn ? 'bg-red-400 animate-pulse' : 'bg-[#75716e]'}`} />
          {keepOn ? '연속 듣기 켜짐' : '연속 듣기'}
        </button>
      )}

      {/* 마이크 버튼 */}
      <button
        onClick={handleMicClick}
        className={`w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all duration-200 ${
          permission === 'denied'
            ? 'bg-[#32302e] border border-red-500/30 opacity-60'
            : listening
            ? 'bg-red-500 scale-110 shadow-red-500/30'
            : keepOn
            ? 'bg-orange-500/20 border border-orange-500/40'
            : permission === 'requesting'
            ? 'bg-orange-500/20 border border-orange-500/40 animate-pulse'
            : 'bg-[#32302e] hover:bg-[#3d3a38] border border-white/10 hover:border-orange-500/40'
        }`}
        title={
          permission === 'denied'     ? '마이크 권한이 차단됨 — 브라우저 설정에서 허용해주세요' :
          listening                   ? '음성 인식 중 (탭해서 중지)' :
          keepOn                      ? '연속 듣기 활성 (탭해서 중지)' :
          permission === 'requesting' ? '권한 요청 중...' :
          '음성 명령 (탭 후 말하기)'
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
        ) : keepOn ? (
          <span className="relative flex items-center justify-center">
            <span className="absolute w-10 h-10 rounded-full bg-orange-400/20 animate-pulse" />
            <svg className="w-6 h-6 text-orange-300 relative" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2H3v2a9 9 0 0 0 8 8.94V23h2v-2.06A9 9 0 0 0 21 12v-2h-2z"/>
            </svg>
          </span>
        ) : (
          <svg className="w-6 h-6 text-[#a4a09c]" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2H3v2a9 9 0 0 0 8 8.94V23h2v-2.06A9 9 0 0 0 21 12v-2h-2z"/>
          </svg>
        )}
      </button>

      {/* 상태 라벨 */}
      <p className="text-[#75716e] text-[10px] pl-1">
        {permission === 'denied'     ? '🔒 권한 차단됨' :
         listening                   ? '듣는 중...' :
         keepOn                      ? '🔴 연속 대기 중' :
         permission === 'requesting' ? '권한 요청 중...' :
         '🎙 음성 제어'}
      </p>
    </div>
  )
}
