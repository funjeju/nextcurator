'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import LoadingSteps from './LoadingSteps'
import RecentHistory from './RecentHistory'

const CATEGORIES = [
  { id: 'auto', icon: '✨', label: '자동 분류' },
  { id: 'recipe', icon: '🍳', label: '요리' },
  { id: 'english', icon: '🔤', label: '영어' },
  { id: 'learning', icon: '📐', label: '학습' },
  { id: 'news', icon: '🗞️', label: '뉴스' },
  { id: 'selfdev', icon: '💪', label: '자기계발' },
  { id: 'travel', icon: '🧳', label: '여행' },
  { id: 'story', icon: '🍿', label: '스토리' },
]

export default function UrlInput() {
  const [url, setUrl] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('auto')
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
        body: JSON.stringify({ 
          url, 
          category: selectedCategory === 'auto' ? undefined : selectedCategory 
        }),
      })
      setStep(3)

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || '오류가 발생했습니다.')
      }

      setStep(4)
      const data = await res.json()
      setStep(5)

      // Save to sessionStorage for result page
      sessionStorage.setItem(`summary_${data.sessionId}`, JSON.stringify(data))

      // Save history to localStorage
      try {
        const historyJson = localStorage.getItem('nextcurator_history')
        const history = historyJson ? JSON.parse(historyJson) : []
        const newHistoryItem = {
          sessionId: data.sessionId,
          videoId: data.videoId,
          title: data.title,
          thumbnail: data.thumbnail,
          category: data.category,
          date: new Date().toISOString()
        }
        // Check for duplicates
        const filteredHistory = history.filter((item: any) => item.sessionId !== data.sessionId)
        filteredHistory.unshift(newHistoryItem)
        localStorage.setItem('nextcurator_history', JSON.stringify(filteredHistory))
      } catch (e) {
        console.error('Failed to save to localStorage:', e)
      }

      // Navigate
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
    <div className="flex flex-col items-start gap-6 w-full max-w-2xl bg-[#32302e]/80 backdrop-blur-3xl px-4 py-6 md:p-10 rounded-[32px] border border-white/5 shadow-2xl">

      {/* Recent History Component */}
      <RecentHistory />

      {/* Input area */}
      <div className="flex flex-col gap-4 w-full">
        <label className="text-[#e8e6e3] text-[15px] font-semibold tracking-wide flex items-center gap-2">
          영상 주소 입력 <span className="text-orange-400">⚡</span>
        </label>

        <div className="relative group flex flex-col md:flex-row gap-3">
          <Input
            placeholder="https://youtube.com/watch?v=..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            className="flex-1 h-[56px] text-base pl-5 pr-4 bg-[#23211f] border-none text-white placeholder:text-[#75716e] rounded-[20px] focus-visible:ring-1 focus-visible:ring-orange-500/50 shadow-inner transition-all duration-300"
          />
          <Button
            variant="default"
            onClick={handleSubmit}
            disabled={!url.trim()}
            className="h-[56px] md:w-[140px] text-base font-bold tracking-wide rounded-[20px] transition-all duration-300
                       bg-white text-black hover:bg-[#e2e2e2] hover:scale-[1.02] active:scale-[0.98]
                       disabled:bg-white/10 disabled:text-white/30 disabled:cursor-not-allowed disabled:transform-none"
          >
            Start Now
          </Button>
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-[#2a1d1c] border border-red-500/20 rounded-2xl px-5 py-4">
            <span className="text-red-400 text-sm font-medium">⚠️ {error}</span>
          </div>
        )}
      </div>

      {/* Category selection - URL 입력 아래 */}
      <div className="flex flex-col gap-3 w-full">
        {/* 첫 행: 분석 모드 선택 레이블 + 자동 분류 버튼 */}
        <div className="flex items-center justify-between w-full">
          <p className="text-[#75716e] text-sm font-medium">분석 모드 선택</p>
          {(() => {
            const auto = CATEGORIES[0]
            const isSelected = selectedCategory === auto.id
            return (
              <Badge
                variant="outline"
                onClick={() => setSelectedCategory(auto.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-[14px] text-xs font-medium cursor-pointer transition-all duration-300 group ${
                  isSelected
                    ? 'border-transparent bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.2)]'
                    : 'border-transparent bg-[#23211f] text-[#a4a09c] hover:bg-[#3d3a38] hover:text-white'
                }`}
              >
                <span className={`text-sm transition-transform ${isSelected ? 'scale-110' : 'group-hover:scale-110'}`}>{auto.icon}</span>
                <span>{auto.label}</span>
              </Badge>
            )
          })()}
        </div>

        {/* 두 번째 행: 나머지 카테고리 3열 그리드 */}
        <div className="grid grid-cols-3 md:flex md:flex-wrap gap-2 w-full">
          {CATEGORIES.slice(1).map((cat) => {
            const isSelected = selectedCategory === cat.id
            return (
              <Badge
                key={cat.id}
                variant="outline"
                onClick={() => setSelectedCategory(cat.id)}
                className={`flex items-center justify-center gap-1.5 px-2 py-2 md:px-5 md:py-2.5 rounded-[14px] text-xs md:text-sm font-medium cursor-pointer transition-all duration-300 group ${
                  isSelected
                    ? 'border-transparent bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.2)]'
                    : 'border-transparent bg-[#23211f] text-[#a4a09c] hover:bg-[#3d3a38] hover:text-white'
                }`}
              >
                <span className={`text-sm transition-transform ${isSelected ? 'scale-110' : 'group-hover:scale-110'}`}>{cat.icon}</span>
                <span className="tracking-wide truncate">{cat.label}</span>
              </Badge>
            )
          })}
        </div>
      </div>

    </div>
  )
}
