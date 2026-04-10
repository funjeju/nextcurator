'use client'

import { useEffect, useState } from 'react'
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

function buildThresholds(steps: { label: string; weight: number }[]) {
  const total = steps.reduce((s, step) => s + step.weight, 0)
  let acc = 0
  return steps.map(step => {
    acc += (step.weight / total) * 100
    return acc
  })
}

interface LoadingStepsProps {
  currentStep: number
  mode?: 'youtube' | 'pdf' | 'url'
}

export default function LoadingSteps({ currentStep, mode = 'youtube' }: LoadingStepsProps) {
  const STEPS = mode === 'pdf' ? STEPS_PDF : mode === 'url' ? STEPS_URL : STEPS_YOUTUBE
  const STEP_THRESHOLDS = buildThresholds(STEPS)
  const [displayProgress, setDisplayProgress] = useState(0)

  useEffect(() => {
    if (currentStep < 1) return

    // 이전 단계들 완료 퍼센트로 스냅
    const completedPct = currentStep > 1 ? STEP_THRESHOLDS[currentStep - 2] : 0

    // 현재 단계의 목표 퍼센트 (90%까지만 — 단계 완료 전까지는 끝까지 안 감)
    const stepEndPct = STEP_THRESHOLDS[currentStep - 1]
    const slowTarget = completedPct + (stepEndPct - completedPct) * 0.88

    setDisplayProgress(completedPct)

    const timer = setInterval(() => {
      setDisplayProgress(prev => {
        if (prev >= slowTarget) return prev
        // easing: 멀수록 빠르게, 가까울수록 느리게
        const speed = Math.max(0.15, (slowTarget - prev) * 0.06)
        return Math.min(prev + speed, slowTarget)
      })
    }, 120)

    return () => clearInterval(timer)
  }, [currentStep])

  return (
    <div className="flex flex-col gap-6 w-full max-w-sm">
      <div className="flex flex-col gap-3">
        {STEPS.map((step, i) => {
          const idx = i + 1
          const isDone   = currentStep > idx
          const isActive = currentStep === idx
          return (
            <div key={step.label} className="flex items-center gap-3 text-sm">
              <span className="text-lg w-6 text-center">
                {isDone ? '✅' : isActive ? '⏳' : '⬜'}
              </span>
              <span className={
                isDone   ? 'text-zinc-500 line-through' :
                isActive ? 'text-zinc-100 font-medium' :
                           'text-zinc-600'
              }>
                {step.label}
              </span>
            </div>
          )
        })}
      </div>

      <div className="space-y-2">
        <Progress value={displayProgress} className="h-2" />
        <p className="text-center text-zinc-500 text-sm tabular-nums">
          {Math.round(displayProgress)}%
        </p>
      </div>
    </div>
  )
}
