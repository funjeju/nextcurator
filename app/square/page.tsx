'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Header from '@/components/common/Header'
import { getPublicSummaries, SavedSummary } from '@/lib/db'
import { formatRelativeDate } from '@/lib/formatDate'

const CATEGORY_LABEL: Record<string, string> = {
  recipe: '🍳 요리',
  english: '🔤 영어',
  learning: '📐 학습',
  news: '🗞️ 뉴스',
  selfdev: '💪 자기계발',
  travel: '🧳 여행',
  story: '🍿 스토리',
}

export default function SquarePage() {
  const [summaries, setSummaries] = useState<SavedSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await getPublicSummaries()
        setSummaries(data)
      } catch (e) {
        console.error('Failed to load square data:', e)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  return (
    <div className="min-h-screen bg-[#252423] font-sans">
      <Header title="🎬 The Square" />

      <div className="max-w-7xl mx-auto px-6 pb-12">
        <div className="mb-10 text-center">
          <h1 className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-pink-500 mb-4 tracking-tight">
            The Square
          </h1>
          <p className="text-[#a4a09c] text-lg max-w-2xl mx-auto">
            매일업데이트되는 집단지성 요약 라이브러리. 세상의 모든 지식을 탐험하세요.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-32">
            <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-pink-500"></div>
          </div>
        ) : summaries.length === 0 ? (
          <div className="bg-[#32302e]/50 rounded-[32px] p-20 text-center border border-white/5">
            <span className="text-6xl mb-6 block drop-shadow-xl">🌍</span>
            <h2 className="text-2xl text-white font-bold mb-3">아직 공개된 요약이 없습니다</h2>
            <p className="text-[#75716e] text-base">첫 번째 영상을 요약하고 광장에 공유해 보세요!</p>
            <Link href="/" className="inline-block mt-8 px-8 py-4 bg-gradient-to-r from-orange-500 to-pink-500 text-white font-bold rounded-2xl shadow-lg hover:shadow-pink-500/25 transition-all hover:-translate-y-1">
              새 영상 분석하기
            </Link>
          </div>
        ) : (
          <div className="columns-1 sm:columns-2 md:columns-3 lg:columns-4 gap-6 space-y-6">
            {summaries.map(item => (
              <Link
                key={item.id}
                href={`/result/${item.sessionId}`}
                className="break-inside-avoid flex flex-col rounded-[24px] bg-[#32302e] border border-white/5 overflow-hidden hover:border-white/20 transition-all hover:-translate-y-1.5 shadow-xl group"
              >
                <div className="relative overflow-hidden bg-[#23211f]">
                  <img 
                    src={item.thumbnail} 
                    alt={item.title} 
                    className="w-full object-cover aspect-video group-hover:scale-105 transition-transform duration-700 ease-out"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-60 group-hover:opacity-40 transition-opacity duration-500" />
                  <div className="absolute top-3 right-3 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md text-xs font-bold text-white border border-white/10 flex items-center shadow-lg">
                    {CATEGORY_LABEL[item.category] || '분석됨'}
                  </div>
                </div>
                
                <div className="p-6 flex flex-col gap-4">
                  <h3 className="text-[#f4f4f5] text-base font-bold leading-snug group-hover:text-pink-100 transition-colors line-clamp-3">
                    {item.title}
                  </h3>

                  {item.createdAt && (
                    <p className="text-[#75716e] text-xs">{formatRelativeDate(item.createdAt)}</p>
                  )}

                  {item.square_meta && item.square_meta.tags && (
                    <div className="flex flex-wrap gap-2 mt-auto">
                      {item.square_meta.tags.slice(0, 5).map((tag: string, i: number) => (
                        <span key={i} className="px-2.5 py-1 bg-[#23211f] border border-white/5 hover:border-pink-500/30 rounded-lg text-xs text-[#a4a09c] hover:text-pink-200 font-medium transition-colors">
                          #{tag.replace(/\s+/g, '')}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
