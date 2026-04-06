'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import LoadingSteps from './LoadingSteps'

const CATEGORIES = [
  { icon: '🍳', label: '요리', color: 'hover:border-orange-500/50 hover:bg-orange-500/10 hover:text-orange-300' },
  { icon: '🔤', label: '영어', color: 'hover:border-blue-500/50 hover:bg-blue-500/10 hover:text-blue-300' },
  { icon: '📐', label: '학습', color: 'hover:border-violet-500/50 hover:bg-violet-500/10 hover:text-violet-300' },
  { icon: '🗞️', label: '뉴스', color: 'hover:border-zinc-400/50 hover:bg-zinc-500/10 hover:text-zinc-200' },
  { icon: '💪', label: '자기계발', color: 'hover:border-emerald-500/50 hover:bg-emerald-500/10 hover:text-emerald-300' },
  { icon: '🧳', label: '여행', color: 'hover:border-cyan-500/50 hover:bg-cyan-500/10 hover:text-cyan-300' },
]

export default function UrlInput() {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [step, setStep] = useState(0)
  const router = useRouter()

  const handleSubmit = async () => {
    if (!url.trim()) return
    setError('')
    setLoading(true)
    setStep(1)

    try {
      setStep(2)
      const res = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      setStep(3)

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || '오류가 발생했습니다.')
      }

      setStep(4)
      const data = await res.json()
      setStep(5)

      sessionStorage.setItem(`summary_${data.sessionId}`, JSON.stringify(data))
      router.push(`/result/${data.sessionId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다.')
      setLoading(false)
      setStep(0)
    }
  }

  if (loading) {
    return <LoadingSteps currentStep={step} />
  }

  return (
    <div className="flex flex-col items-center gap-8 w-full max-w-2xl">
      {/* Input area */}
      <div className="flex flex-col gap-3 w-full">
        <div className="relative">
          <Input
            placeholder="https://youtube.com/watch?v=..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            className="h-14 text-base pl-5 pr-4 bg-zinc-900/80 border-zinc-700 text-zinc-100 placeholder:text-zinc-600 rounded-xl focus-visible:ring-blue-500 focus-visible:border-blue-500 transition-all"
          />
        </div>
        {error && (
          <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2">
            <span className="text-red-400 text-sm">⚠️ {error}</span>
          </div>
        )}
        <Button
          onClick={handleSubmit}
          disabled={!url.trim()}
          className="h-14 text-base font-semibold rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-30 transition-all shadow-lg shadow-blue-900/30"
        >
          AI 요약 시작하기 →
        </Button>
      </div>

      {/* Category chips */}
      <div className="flex flex-col items-center gap-3 w-full">
        <p className="text-zinc-600 text-xs uppercase tracking-widest">지원 카테고리</p>
        <div className="flex flex-wrap justify-center gap-2">
          {CATEGORIES.map((cat) => (
            <div
              key={cat.label}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full border border-zinc-800 bg-zinc-900/50 text-zinc-500 text-sm cursor-default transition-all duration-200 ${cat.color}`}
            >
              <span>{cat.icon}</span>
              <span>{cat.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
