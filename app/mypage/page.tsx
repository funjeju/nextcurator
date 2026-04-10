'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import Header from '@/components/common/Header'
import { getLocalUserId } from '@/lib/user'
import { formatRelativeDate } from '@/lib/formatDate'
import { getUserFolders, getSavedSummariesByFolder, deleteSavedSummary, updateSummaryFolder, Folder, SavedSummary } from '@/lib/db'

const CATEGORY_LABEL: Record<string, string> = {
  recipe: '🍳 요리',
  english: '🔤 영어',
  learning: '📐 학습',
  news: '🗞️ 뉴스',
  selfdev: '💪 자기계발',
  travel: '🧳 여행',
  story: '🍿 스토리',
}

// ── 폴더 이동 드롭다운 ──
function FolderMoveDropdown({
  summaryId,
  currentFolderId,
  folders,
  onMoved,
  onClose,
}: {
  summaryId: string
  currentFolderId: string
  folders: Folder[]
  onMoved: (summaryId: string, newFolderId: string) => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [moving, setMoving] = useState<string | null>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  const handleMove = async (folderId: string) => {
    if (folderId === currentFolderId) { onClose(); return }
    setMoving(folderId)
    try {
      await updateSummaryFolder(summaryId, folderId)
      onMoved(summaryId, folderId)
      onClose()
    } catch {
      alert('폴더 이동에 실패했습니다.')
    } finally {
      setMoving(null)
    }
  }

  return (
    <div
      ref={ref}
      className="absolute top-10 left-0 z-50 w-48 bg-[#23211f] border border-white/15 rounded-2xl shadow-2xl py-1.5 overflow-hidden"
      onClick={e => e.stopPropagation()}
    >
      <p className="px-3 py-1.5 text-[10px] text-[#75716e] font-semibold uppercase tracking-wider">폴더 이동</p>
      <div className="max-h-48 overflow-y-auto">
        {folders.map(f => {
          const isCurrent = f.id === currentFolderId
          const isMoving = moving === f.id
          return (
            <button
              key={f.id}
              onClick={() => handleMove(f.id)}
              disabled={!!moving}
              className={`w-full text-left px-3 py-2 text-sm transition-colors flex items-center gap-2 ${
                isCurrent
                  ? 'text-orange-400 bg-orange-500/10 cursor-default'
                  : 'text-[#a4a09c] hover:bg-[#32302e] hover:text-white'
              } disabled:opacity-50`}
            >
              <span>{isMoving ? '⏳' : isCurrent ? '📂' : '📁'}</span>
              <span className="truncate">{f.name}</span>
              {isCurrent && <span className="ml-auto text-[10px] text-orange-400/70">현재</span>}
            </button>
          )
        })}
        {folders.length === 0 && (
          <p className="px-3 py-2 text-xs text-[#75716e]">폴더가 없습니다.</p>
        )}
      </div>
    </div>
  )
}

export default function MyPage() {
  const [folders, setFolders] = useState<Folder[]>([])
  const [summaries, setSummaries] = useState<SavedSummary[]>([])
  const [allSummaries, setAllSummaries] = useState<SavedSummary[]>([])
  const [activeFolder, setActiveFolder] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [openMoveId, setOpenMoveId] = useState<string | null>(null)

  useEffect(() => {
    const fetchInit = async () => {
      try {
        const uid = getLocalUserId()
        const list = await getUserFolders(uid)
        setFolders(list)
        const allItems = await getSavedSummariesByFolder(uid, 'all')
        setAllSummaries(allItems)
        setSummaries(allItems)
      } catch (e) {
        console.error('Failed to load mypage data:', e)
      } finally {
        setLoading(false)
      }
    }
    fetchInit()
  }, [])

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchQuery.trim()) { setSummaries(allSummaries); return }
    setSearching(true)
    try {
      const payload = allSummaries.map(s => ({
        id: s.id,
        title: s.title,
        category: s.category,
        tags: s.square_meta?.tags ?? [],
        topic_cluster: s.square_meta?.topic_cluster ?? '',
        vibe: s.square_meta?.vibe ?? '',
      }))
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery, summaries: payload }),
      })
      const { results } = await res.json()
      const ordered = results
        .map((id: string) => allSummaries.find(s => s.id === id))
        .filter(Boolean) as SavedSummary[]
      setSummaries(ordered)
    } catch {
      alert('검색에 실패했습니다.')
    } finally {
      setSearching(false)
    }
  }

  const handleClearSearch = () => {
    setSearchQuery('')
    setSummaries(allSummaries)
  }

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm('이 항목을 삭제하시겠습니까?')) return
    setDeletingId(id)
    try {
      await deleteSavedSummary(id)
      setSummaries(prev => prev.filter(s => s.id !== id))
      setAllSummaries(prev => prev.filter(s => s.id !== id))
    } catch {
      alert('삭제에 실패했습니다.')
    } finally {
      setDeletingId(null)
    }
  }

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

  // 폴더 이동 완료 → UI 즉시 반영
  const handleMoved = (summaryId: string, newFolderId: string) => {
    const update = (list: SavedSummary[]) =>
      list.map(s => s.id === summaryId ? { ...s, folderId: newFolderId } : s)
    setSummaries(prev => {
      const updated = update(prev)
      // 특정 폴더 보기 중이면 해당 폴더 아이템만 표시
      if (activeFolder !== 'all') return updated.filter(s => s.folderId === activeFolder)
      return updated
    })
    setAllSummaries(update)
  }

  return (
    <div className="min-h-screen bg-[#252423] font-sans">
      <Header title="나의 요약 갤러리" />

      {/* AI 검색 바 */}
      <div className="max-w-7xl mx-auto px-6 mb-4">
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="자연어로 검색... (예: 저번에 저장한 동치미 레시피)"
            className="flex-1 h-11 px-4 bg-[#32302e] border border-white/10 rounded-xl text-sm text-white placeholder:text-[#75716e] focus:outline-none focus:border-orange-500/50 transition-colors"
          />
          {searchQuery && (
            <button type="button" onClick={handleClearSearch} className="h-11 px-3 bg-[#32302e] border border-white/10 rounded-xl text-[#75716e] hover:text-white transition-colors text-sm">
              ✕
            </button>
          )}
          <button
            type="submit"
            disabled={searching || !searchQuery.trim()}
            className="h-11 px-4 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-sm disabled:opacity-40 transition-colors whitespace-nowrap"
          >
            {searching ? '검색 중...' : '🔍 AI 검색'}
          </button>
        </form>
      </div>

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
              🌐 모든 저장 항목
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
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500" />
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
                <div key={item.id} className="break-inside-avoid relative group">
                  <Link
                    href={`/result/${item.sessionId}`}
                    className="block rounded-[24px] bg-[#32302e] border border-white/5 overflow-hidden hover:border-white/20 transition-all hover:-translate-y-1 shadow-lg"
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
                      {/* 폴더 위치 표시 */}
                      {item.folderId && folders.find(f => f.id === item.folderId) && (
                        <p className="text-[#75716e] text-xs flex items-center gap-1">
                          <span>📁</span>
                          <span>{folders.find(f => f.id === item.folderId)?.name}</span>
                        </p>
                      )}
                      {item.createdAt && (
                        <p className="text-[#75716e] text-xs">{formatRelativeDate(item.createdAt)}</p>
                      )}
                      {item.square_meta?.tags && (
                        <div className="flex flex-wrap gap-1.5">
                          {item.square_meta.tags.slice(0, 4).map((tag: string, i: number) => (
                            <span key={i} className="px-2 py-1 bg-[#23211f] border border-white/5 rounded-md text-[10px] text-[#a4a09c] font-medium lowercase">
                              #{tag.replace(/\s+/g, '')}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </Link>

                  {/* 호버 액션 버튼들 */}
                  <div className="absolute top-3 left-3 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">

                    {/* 폴더 이동 버튼 */}
                    <div className="relative">
                      <button
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          setOpenMoveId(openMoveId === item.id ? null : item.id)
                        }}
                        className="p-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-white/70 hover:text-orange-400 hover:border-orange-400/50 transition-colors"
                        title="폴더 이동"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
                        </svg>
                      </button>
                      {openMoveId === item.id && (
                        <FolderMoveDropdown
                          summaryId={item.id}
                          currentFolderId={item.folderId}
                          folders={folders}
                          onMoved={handleMoved}
                          onClose={() => setOpenMoveId(null)}
                        />
                      )}
                    </div>

                    {/* 삭제 버튼 */}
                    <button
                      onClick={(e) => handleDelete(e, item.id)}
                      disabled={deletingId === item.id}
                      className="p-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-white/70 hover:text-red-400 hover:border-red-400/50 disabled:opacity-50 transition-colors"
                      title="삭제"
                    >
                      {deletingId === item.id ? (
                        <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                        </svg>
                      ) : (
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
