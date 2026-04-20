'use client'

import { useEffect, useState, useRef } from 'react'
import { Progress } from '@/components/ui/progress'

const STEPS_YOUTUBE = [
  { label: '영상 정보 확인 중...', weight: 1 },
  { label: '자막 추출 중...',      weight: 3 },
  { label: '카테고리 분류 중...',  weight: 1 },
  { label: '요약 생성 중...',      weight: 2 },
  { label: '타임스탬프 연결 중...', weight: 1 },
]

const STEPS_PDF = [
  { label: 'PDF 파일 읽는 중...',  weight: 1 },
  { label: '텍스트 추출 중...',    weight: 2 },
  { label: '카테고리 분류 중...',  weight: 1 },
  { label: '요약 생성 중...',      weight: 3 },
  { label: '정리 마무리 중...',    weight: 1 },
]

const STEPS_URL = [
  { label: '페이지 접근 중...',    weight: 1 },
  { label: '본문 추출 중...',      weight: 2 },
  { label: '카테고리 분류 중...',  weight: 1 },
  { label: '요약 생성 중...',      weight: 3 },
  { label: '정리 마무리 중...',    weight: 1 },
]

const STEPS_VOICE = [
  { label: '녹음 파일 읽는 중...', weight: 1 },
  { label: '음성 전사 중...',      weight: 3 },
  { label: '내용 분석 중...',      weight: 2 },
  { label: '요약 카드 생성 중...', weight: 2 },
  { label: '마무리 중...',         weight: 1 },
]

// step 2 (자막/텍스트 추출) 에서 오래 걸릴 때 순환할 메시지
const PATIENCE_MESSAGES = [
  '자막이 없는 영상은 AI가 음성을 직접 분석해요.',
  '긴 영상일수록 시간이 더 걸릴 수 있어요.',
  '조금만 기다려 주세요, 거의 다 왔어요!',
  '고화질 영상은 분석 시간이 길어질 수 있어요.',
  '취소하고 나중에 다시 시도해도 괜찮아요.',
]

function buildThresholds(steps: { label: string; weight: number }[]) {
  const total = steps.reduce((s, step) => s + step.weight, 0)
  let acc = 0
  return steps.map(step => {
    acc += (step.weight / total) * 100
    return acc
  })
}

function formatElapsed(sec: number): string {
  if (sec < 60) return `${sec}초`
  return `${Math.floor(sec / 60)}분 ${sec % 60}초`
}

interface LoadingStepsProps {
  currentStep: number
  mode?: 'youtube' | 'pdf' | 'url' | 'voice'
  onCancel?: () => void
}

export default function LoadingSteps({ currentStep, mode = 'youtube', onCancel }: LoadingStepsProps) {
  const STEPS = mode === 'pdf' ? STEPS_PDF : mode === 'url' ? STEPS_URL : mode === 'voice' ? STEPS_VOICE : STEPS_YOUTUBE
  const STEP_THRESHOLDS = buildThresholds(STEPS)
  const [displayProgress, setDisplayProgress] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [stepElapsed, setStepElapsed] = useState(0)
  const [patienceIdx, setPatienceIdx] = useState(0)
  const stepStartRef = useRef<number>(Date.now())
  const totalStartRef = useRef<number>(Date.now())

  // 전체 경과 시간
  useEffect(() => {
    totalStartRef.current = Date.now()
    const t = setInterval(() => {
      setElapsed(Math.floor((Date.now() - totalStartRef.current) / 1000))
    }, 1000)
    return () => clearInterval(t)
  }, [])

  // 현재 단계 경과 시간 — step 바뀔 때마다 리셋
  useEffect(() => {
    stepStartRef.current = Date.now()
    setStepElapsed(0)
    setPatienceIdx(0)
    const t = setInterval(() => {
      setStepElapsed(Math.floor((Date.now() - stepStartRef.current) / 1000))
    }, 1000)
    return () => clearInterval(t)
  }, [currentStep])

  // 30초마다 안내 메시지 순환
  useEffect(() => {
    if (stepElapsed > 0 && stepElapsed % 30 === 0) {
      setPatienceIdx(prev => (prev + 1) % PATIENCE_MESSAGES.length)
    }
  }, [stepElapsed])

  // 프로그레스 바 easing
  useEffect(() => {
    if (currentStep < 1) return
    const completedPct = currentStep > 1 ? STEP_THRESHOLDS[currentStep - 2] : 0
    const stepEndPct = STEP_THRESHOLDS[currentStep - 1]
    const slowTarget = completedPct + (stepEndPct - completedPct) * 0.88
    setDisplayProgress(completedPct)
    const timer = setInterval(() => {
      setDisplayProgress(prev => {
        if (prev >= slowTarget) return prev
        const speed = Math.max(0.15, (slowTarget - prev) * 0.06)
        return Math.min(prev + speed, slowTarget)
      })
    }, 120)
    return () => clearInterval(timer)
  }, [currentStep])

  const isLongWait = stepElapsed >= 30

  return (
    <div className="flex flex-col gap-6 w-full max-w-sm">
      <div className="flex flex-col gap-3">
        {STEPS.map((step, i) => {
          const idx = i + 1
          const isDone   = currentStep > idx
          const isActive = currentStep === idx
          return (
            <div key={step.label} className="flex items-center gap-3 text-sm">
              <span className="text-lg w-6 text-center shrink-0">
                {isDone ? '✅' : isActive ? (
                  <span className="inline-block animate-spin">⏳</span>
                ) : '⬜'}
              </span>
              <span className={
                isDone   ? 'text-zinc-500 line-through' :
                isActive ? 'text-zinc-100 font-medium' :
                           'text-zinc-600'
              }>
                {step.label}
                {isActive && stepElapsed > 0 && (
                  <span className="ml-2 text-zinc-500 text-xs font-normal">
                    ({formatElapsed(stepElapsed)})
                  </span>
                )}
              </span>
            </div>
          )
        })}
      </div>

      {/* 오래 걸릴 때 안내 메시지 */}
      {isLongWait && (
        <div className="rounded-xl bg-zinc-800/60 border border-zinc-700/50 px-4 py-3 text-center">
          <p className="text-zinc-400 text-xs leading-relaxed transition-all duration-500">
            💡 {PATIENCE_MESSAGES[patienceIdx]}
          </p>
        </div>
      )}

      <div className="space-y-2">
        {/* 프로그레스 바 — 오래 걸릴 땐 pulse 애니메이션 */}
        <div className={isLongWait ? 'animate-pulse' : ''}>
          <Progress value={displayProgress} className="h-2" />
        </div>
        <div className="flex items-center justify-between text-xs text-zinc-500 tabular-nums">
          <span>총 {formatElapsed(elapsed)} 경과</span>
          <span>{Math.round(displayProgress)}%</span>
        </div>
      </div>

      {onCancel && (
        <button
          onClick={onCancel}
          className="w-full h-10 rounded-xl border border-white/10 bg-[#32302e] text-[#75716e] text-sm hover:bg-[#3d3a38] hover:text-white hover:border-white/20 transition-all"
        >
          취소
        </button>
      )}
    </div>
  )
}
