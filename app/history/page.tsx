'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface HistoryItem {
  sessionId: string
  videoId: string
  title: string
  thumbnail: string
  category: string
  date: string
}

const CATEGORY_LABEL: Record<string, string> = {
  recipe: '🍳 요리',
  english: '🔤 영어',
  learning: '📐 학습',
  news: '🗞️ 뉴스',
  selfdev: '💪 자기계발',
  travel: '🧳 여행',
  story: '🍿 스토리',
}

export default function HistoryPage() {
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    try {
      const historyJson = localStorage.getItem('nextcurator_history')
      if (historyJson) {
        setHistory(JSON.parse(historyJson))
      }
    } catch (e) {
      console.error(e)
    }
  }, [])

  if (!mounted) return null

  return (
    <div className="min-h-screen bg-[#252423] font-sans">
      {/* Navigation Layer */}
      <div className="sticky top-0 z-50 bg-[#252423]/90 backdrop-blur-xl border-b border-white/5 py-4 px-6 md:px-8 mb-6">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-xl font-bold tracking-tight text-white hover:opacity-80 transition-opacity">
            🎬 Next Curator
          </Link>
          <span className="text-[#a4a09c] text-sm font-medium">나의 요약 기록</span>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 pb-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">History</h1>
          <p className="text-[#a4a09c]">그동안 분석했던 영상들을 한눈에 모아보세요.</p>
        </div>

        {history.length === 0 ? (
          <div className="bg-[#32302e]/50 rounded-[32px] p-12 text-center border border-white/5">
            <span className="text-4xl mb-4 block">📭</span>
            <h2 className="text-xl text-white font-medium mb-2">기록이 없습니다</h2>
            <p className="text-[#75716e] text-sm mb-6">첫 번째 영상을 요약해 보세요!</p>
            <Link href="/" className="inline-block px-6 py-3 bg-white text-black font-bold rounded-xl hover:bg-zinc-200 transition-colors">
              새 영상 분석하기
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {history.map((item) => (
              <Link 
                key={item.sessionId} 
                href={`/result/${item.sessionId}`}
                className="group flex flex-col rounded-[24px] bg-[#32302e] border border-white/5 overflow-hidden hover:border-white/20 transition-all hover:-translate-y-1 shadow-lg"
              >
                <div className="aspect-video relative overflow-hidden bg-[#23211f]">
                  <img 
                    src={item.thumbnail} 
                    alt={item.title} 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors" />
                  <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-xs font-medium text-white border border-white/10">
                    {CATEGORY_LABEL[item.category] || '분석됨'}
                  </div>
                </div>
                <div className="p-5 flex flex-col gap-2 flex-1">
                  <p className="text-[#e2e2e2] text-[15px] font-medium line-clamp-2 leading-snug group-hover:text-white transition-colors">
                    {item.title}
                  </p>
                  <p className="text-[#75716e] text-[11px] mt-auto pt-2 border-t border-white/5 font-mono">
                    {new Date(item.date).toLocaleDateString()}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
