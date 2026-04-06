'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Header from '@/components/common/Header'
import { getLocalUserId } from '@/lib/user'
import { getUserFolders, getSavedSummariesByFolder, Folder, SavedSummary } from '@/lib/db'

const CATEGORY_LABEL: Record<string, string> = {
  recipe: '🍳 요리',
  english: '🔤 영어',
  learning: '📐 학습',
  news: '🗞️ 뉴스',
  selfdev: '💪 자기계발',
  travel: '🧳 여행',
  story: '🍿 스토리',
}

export default function MyPage() {
  const [folders, setFolders] = useState<Folder[]>([])
  const [summaries, setSummaries] = useState<SavedSummary[]>([])
  const [activeFolder, setActiveFolder] = useState<string>('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchInit = async () => {
      try {
        const uid = getLocalUserId()
        const list = await getUserFolders(uid)
        setFolders(list)
        const allSummaries = await getSavedSummariesByFolder(uid, 'all')
        setSummaries(allSummaries)
      } catch (e) {
        console.error('Failed to load mypage data:', e)
      } finally {
        setLoading(false)
      }
    }
    fetchInit()
  }, [])

  const handleFolderClick = async (folderId: string) => {
    setActiveFolder(folderId)
    setLoading(true)
    try {
      const uid = getLocalUserId()
      const content = await getSavedSummariesByFolder(uid, folderId)
      setSummaries(content)
    } catch (e) {
      console.error('Failed to load folder contents:', e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#252423] font-sans">
      <Header title="나의 요약 갤러리" />

      <div className="max-w-7xl mx-auto px-6 pb-12 flex flex-col md:flex-row gap-8">
        
        {/* Sidebar: Folders */}
        <aside className="w-full md:w-64 shrink-0 flex flex-col gap-4">
          <h2 className="text-lg font-bold text-white mb-2">폴더 목록</h2>
          <div className="flex flex-row md:flex-col gap-2 overflow-x-auto md:overflow-visible pb-2 scrollbar-none">
            <button
              onClick={() => handleFolderClick('all')}
              className={`text-left px-4 py-3 rounded-xl whitespace-nowrap transition-colors ${
                activeFolder === 'all' ? 'bg-orange-500 text-white font-bold' : 'bg-[#32302e] text-[#a4a09c] hover:bg-[#3d3a38]'
              }`}
            >
              🌐 모든 저장 항목 ({folders.length ? '전체' : '0'})
            </button>
            {folders.map(f => (
              <button
                key={f.id}
                onClick={() => handleFolderClick(f.id)}
                className={`text-left px-4 py-3 rounded-xl whitespace-nowrap transition-colors ${
                  activeFolder === f.id ? 'bg-orange-500 text-white font-bold' : 'bg-[#32302e] text-[#a4a09c] hover:bg-[#3d3a38]'
                }`}
              >
                📁 {f.name}
              </button>
            ))}
          </div>
        </aside>

        {/* Content Grid */}
        <main className="flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500"></div>
            </div>
          ) : summaries.length === 0 ? (
            <div className="bg-[#32302e]/50 rounded-[32px] p-12 text-center border border-white/5">
              <span className="text-4xl mb-4 block">📭</span>
              <h2 className="text-xl text-white font-medium mb-2">저장된 영상이 없습니다</h2>
              <p className="text-[#75716e] text-sm">폴더를 선택하거나 새로운 영상을 저장해 보세요.</p>
            </div>
          ) : (
            <div className="columns-1 sm:columns-2 lg:columns-3 gap-6 space-y-6">
              {summaries.map(item => (
                <Link
                  key={item.id}
                  href={`/result/${item.sessionId}`}
                  className="break-inside-avoid block group flex-col rounded-[24px] bg-[#32302e] border border-white/5 overflow-hidden hover:border-white/20 transition-all hover:-translate-y-1 shadow-lg"
                >
                  <div className="relative overflow-hidden bg-[#23211f]">
                    <img 
                      src={item.thumbnail} 
                      alt={item.title} 
                      className="w-full object-cover aspect-video group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors" />
                    <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-xs font-medium text-white border border-white/10">
                      {CATEGORY_LABEL[item.category] || '분석됨'}
                    </div>
                  </div>
                  
                  <div className="p-5 flex flex-col gap-3">
                    <p className="text-[#e2e2e2] text-sm font-bold leading-snug group-hover:text-white transition-colors">
                      {item.title}
                    </p>
                    
                    {/* Render Tags if available (Square Meta) */}
                    {item.square_meta && item.square_meta.tags && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {item.square_meta.tags.slice(0, 4).map((tag: string, i: number) => (
                          <span key={i} className="px-2 py-1 bg-[#23211f] border border-white/5 rounded-md text-[10px] text-[#a4a09c] font-medium lowercase">
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
        </main>
      </div>
    </div>
  )
}
