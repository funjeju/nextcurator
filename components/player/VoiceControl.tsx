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

// 한국어 숫자 단어 → 숫자
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

export default function VoiceControl({ playerRef, steps }: Props) {
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [feedback, setFeedback] = useState('')
  const [supported, setSupported] = useState(false)
  const recognitionRef = useRef<any>(null)
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    setSupported(!!SR)
  }, [])

  const showFeedback = useCallback((msg: string) => {
    setFeedback(msg)
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current)
    feedbackTimer.current = setTimeout(() => setFeedback(''), 3000)
  }, [])

  const executeCommand = useCallback((text: string) => {
    const t = text.trim().toLowerCase()
    const player = playerRef.current
    if (!player) { showFeedback('❌ 플레이어가 준비되지 않았어요'); return }

    // ── 단계 이동: "N단계" (숫자 or 한국어)
    const digitMatch = t.match(/(\d+)\s*단계/)
    if (digitMatch) {
      const num = parseInt(digitMatch[1])
      return seekToStep(num, player)
    }
    for (const [kor, num] of Object.entries(KOR_NUM)) {
      if (t.includes(`${kor}단계`) || t.includes(`${kor} 단계`)) {
        return seekToStep(num, player)
      }
    }

    // ── 재생 / 일시정지
    if (/재생|틀어|시작|계속|play/.test(t)) {
      player.playVideo()
      showFeedback('▶️ 재생')
      return
    }
    if (/멈춰|멈추|정지|일시정지|pause|스톱/.test(t)) {
      player.pauseVideo()
      showFeedback('⏸ 일시정지')
      return
    }

    // ── 재생 속도
    if (/느리게|천천히|slow/.test(t)) {
      const cur = player.getPlaybackRate?.() ?? 1
      const next = Math.max(0.25, parseFloat((cur - 0.25).toFixed(2)))
      player.setPlaybackRate(next)
      showFeedback(`🐢 ${next}배속`)
      return
    }
    if (/빠르게|빨리|fast/.test(t)) {
      const cur = player.getPlaybackRate?.() ?? 1
      const next = Math.min(2, parseFloat((cur + 0.25).toFixed(2)))
      player.setPlaybackRate(next)
      showFeedback(`🐇 ${next}배속`)
      return
    }
    if (/보통|정상 속도|1배|원래/.test(t)) {
      player.setPlaybackRate(1)
      showFeedback('🔄 보통 속도')
      return
    }

    showFeedback(`❓ "${text}" — 이해하지 못했어요`)
  }, [playerRef, steps, showFeedback])

  function seekToStep(num: number, player: YT.Player) {
    const step = steps.find(s => s.step === num)
    if (!step) { showFeedback(`❌ ${num}단계가 없어요`); return }
    if (!step.timestamp || step.timestamp === '00:00') {
      showFeedback(`⚠️ ${num}단계 타임스탬프 없음`)
      return
    }
    player.seekTo(timestampToSeconds(step.timestamp), true)
    player.playVideo()
    showFeedback(`✅ ${num}단계 재생`)
  }

  const startListening = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) return

    const rec = new SR()
    rec.lang = 'ko-KR'
    rec.continuous = false
    rec.interimResults = false
    recognitionRef.current = rec

    rec.onstart = () => { setListening(true); setTranscript(''); setFeedback('') }
    rec.onresult = (e: any) => {
      const text = e.results[0][0].transcript
      setTranscript(text)
      executeCommand(text)
    }
    rec.onerror = (e: any) => {
      const msg: Record<string, string> = {
        'not-allowed': '마이크 권한이 없어요',
        'no-speech': '음성이 감지되지 않았어요',
        'network': '네트워크 오류',
      }
      showFeedback(`❌ ${msg[e.error] ?? e.error}`)
      setListening(false)
    }
    rec.onend = () => setListening(false)
    rec.start()
  }, [executeCommand, showFeedback])

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop()
    setListening(false)
  }, [])

  if (!supported) return null

  return (
    <div className="fixed bottom-6 left-6 z-50 flex flex-col items-start gap-2">
      {/* 피드백 버블 */}
      {(transcript || feedback) && (
        <div className="bg-[#1c1a18] border border-white/15 rounded-2xl px-3.5 py-2.5 shadow-2xl max-w-[220px] space-y-0.5 animate-in fade-in slide-in-from-bottom-2 duration-150">
          {transcript && (
            <p className="text-[#75716e] text-[11px] leading-snug">"{transcript}"</p>
          )}
          {feedback && (
            <p className="text-white text-xs font-medium">{feedback}</p>
          )}
        </div>
      )}

      {/* 마이크 버튼 */}
      <button
        onClick={listening ? stopListening : startListening}
        className={`w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all duration-200 ${
          listening
            ? 'bg-red-500 scale-110 shadow-red-500/30'
            : 'bg-[#32302e] hover:bg-[#3d3a38] border border-white/10 hover:border-orange-500/40'
        }`}
        title={listening ? '음성 인식 중 (클릭해서 중지)' : '음성 명령 (클릭 후 말하기)'}
      >
        {listening ? (
          /* 녹음 중 — 파동 애니메이션 */
          <span className="relative flex items-center justify-center">
            <span className="absolute w-10 h-10 rounded-full bg-red-400/30 animate-ping" />
            <svg className="w-6 h-6 text-white relative" fill="currentColor" viewBox="0 0 24 24">
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

      {/* 라벨 */}
      <p className="text-[#75716e] text-[10px] pl-1">
        {listening ? '듣는 중...' : '🎙 음성 제어'}
      </p>
    </div>
  )
}
