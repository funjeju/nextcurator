'use client'

import { Progress } from '@/components/ui/progress'

const STEPS = [
  '영상 정보 확인 중...',
  '자막 추출 중...',
  '카테고리 분류 중...',
  '요약 생성 중...',
  '타임스탬프 연결 중...',
]

interface LoadingStepsProps {
  currentStep: number
}

export default function LoadingSteps({ currentStep }: LoadingStepsProps) {
  const progress = Math.round((currentStep / STEPS.length) * 100)

  return (
    <div className="flex flex-col gap-6 w-full max-w-sm">
      <div className="flex flex-col gap-3">
        {STEPS.map((step, i) => {
          const idx = i + 1
          const isDone = currentStep > idx
          const isActive = currentStep === idx
          return (
            <div key={step} className="flex items-center gap-3 text-sm">
              <span className="text-lg">
                {isDone ? '✅' : isActive ? '⏳' : '⬜'}
              </span>
              <span className={isDone ? 'text-zinc-400' : isActive ? 'text-zinc-100' : 'text-zinc-600'}>
                {step}
              </span>
            </div>
          )
        })}
      </div>
      <Progress value={progress} className="h-2" />
      <p className="text-center text-zinc-500 text-sm">{progress}%</p>
    </div>
  )
}
