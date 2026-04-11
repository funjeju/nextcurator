'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import Header from '@/components/common/Header'
import { getLocalUserId } from '@/lib/user'
import { formatRelativeDate } from '@/lib/formatDate'
import {
  getUserFolders, getSavedSummariesByFolder, deleteSavedSummary, updateSummaryFolder,
  getPendingFriendRequests, acceptFriendRequest, rejectFriendRequest, getFriends,
  batchUpdateSortOrder,
  Folder, SavedSummary, FriendRequest,
} from '@/lib/db'
import { useAuth } from '@/providers/AuthProvider'
import FloatingChat from '@/components/chat/FloatingChat'

const CATEGORY_LABEL: Record<string, string> = {
  recipe: '🍳 요리',
  english: '🔤 영어',
  learning: '📐 학습',
  news: '🗞️ 뉴스',
  selfdev: '💪 자기계발',
  travel: '🧳 여행',
  story: '🍿 스토리',
  tips: '💡 팁',
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

// ── 친구 요청 탭 ──
function FriendsTab({ myUid }: { myUid: string }) {
  const [requests, setRequests] = useState<FriendRequest[]>([])
  const [friends, setFriends] = useState<{ uid: string; displayName: string; photoURL: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [actingId, setActingId] = useState<string | null>(null)

  useEffect(() => {
    if (!myUid) return
    Promise.all([
      getPendingFriendRequests(myUid),
      getFriends(myUid),
    ]).then(([reqs, friendList]) => {
      setRequests(reqs)
      setFriends(friendList)
    }).catch(console.error).finally(() => setLoading(false))
  }, [myUid])

  const handleAccept = async (req: FriendRequest) => {
    setActingId(req.id)
    try {
      await acceptFriendRequest(req.fromUid, myUid)
      setRequests(prev => prev.filter(r => r.id !== req.id))
      setFriends(prev => [...prev, { uid: req.fromUid, displayName: req.fromDisplayName, photoURL: req.fromPhotoURL }])
    } catch { alert('오류가 발생했습니다.') }
    finally { setActingId(null) }
  }

  const handleReject = async (req: FriendRequest) => {
    setActingId(req.id)
    try {
      await rejectFriendRequest(req.fromUid, myUid)
      setRequests(prev => prev.filter(r => r.id !== req.id))
    } catch { alert('오류가 발생했습니다.') }
    finally { setActingId(null) }
  }

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-orange-500" />
    </div>
  )

  return (
    <div className="flex flex-col gap-8">
      {/* 받은 친구 요청 */}
      <section>
        <h3 className="text-white font-bold mb-3 flex items-center gap-2">
          친구 요청
          {requests.length > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-orange-500 text-white text-xs font-bold">{requests.length}</span>
          )}
        </h3>
        {requests.length === 0 ? (
          <p className="text-[#75716e] text-sm bg-[#32302e]/50 rounded-2xl px-5 py-4">받은 친구 요청이 없습니다.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {requests.map(req => (
              <div key={req.id} className="flex items-center gap-3 bg-[#32302e] rounded-2xl px-4 py-3 border border-white/5">
                {req.fromPhotoURL ? (
                  <img src={req.fromPhotoURL} alt="" className="w-10 h-10 rounded-full border border-white/10 shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-[#3d3a38] flex items-center justify-center text-lg shrink-0">👤</div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold text-sm truncate">{req.fromDisplayName || '익명'}</p>
                  <p className="text-[#75716e] text-xs mt-0.5">친구 요청을 보냈어요</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => handleAccept(req)}
                    disabled={actingId === req.id}
                    className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-full transition-colors disabled:opacity-50"
                  >
                    수락
                  </button>
                  <button
                    onClick={() => handleReject(req)}
                    disabled={actingId === req.id}
                    className="px-3 py-1.5 bg-[#3d3a38] hover:bg-[#4a4745] text-[#a4a09c] text-xs font-bold rounded-full transition-colors disabled:opacity-50"
                  >
                    거절
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 친구 목록 */}
      <section>
        <h3 className="text-white font-bold mb-3">친구 목록 <span className="text-[#75716e] font-normal text-sm">{friends.length}명</span></h3>
        {friends.length === 0 ? (
          <p className="text-[#75716e] text-sm bg-[#32302e]/50 rounded-2xl px-5 py-4">아직 친구가 없습니다. 스퀘어에서 마음에 드는 유저에게 친구 요청을 보내보세요.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {friends.map(f => (
              <Link
                key={f.uid}
                href={`/profile/${f.uid}`}
                className="flex items-center gap-3 bg-[#32302e] hover:bg-[#3d3a38] rounded-2xl px-3 py-3 border border-white/5 hover:border-orange-500/30 transition-all group"
              >
                {f.photoURL ? (
                  <img src={f.photoURL} alt="" className="w-9 h-9 rounded-full border border-white/10 shrink-0" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-[#3d3a38] flex items-center justify-center shrink-0">👤</div>
                )}
                <span className="text-[#e2e2e2] text-sm font-medium truncate group-hover:text-white transition-colors">{f.displayName || '익명'}</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

export default function MyPage() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<'library' | 'friends'>('library')
  const [folders, setFolders] = useState<Folder[]>([])
  const [summaries, setSummaries] = useState<SavedSummary[]>([])
  const [allSummaries, setAllSummaries] = useState<SavedSummary[]>([])
  const [activeFolder, setActiveFolder] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [openMoveId, setOpenMoveId] = useState<string | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [savingOrder, setSavingOrder] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    const fetchInit = async () => {
      try {
        const uid = getLocalUserId()
        const list = await getUserFolders(uid)
        setFolders(list)
        const allItems = await getSavedSummariesByFolder(uid, 'all')
        setAllSummaries(allItems)
        setSummaries(allItems)
        // 친구 요청 배지
        if (user) {
          getPendingFriendRequests(user.uid).then(reqs => setPendingCount(reqs.length)).catch(() => {})
        }
      } catch (e) {
        console.error('Failed to load mypage data:', e)
      } finally {
        setLoading(false)
      }
    }
    fetchInit()
  }, [user])

  // ── 드래그 순서 변경 (특정 폴더에서만 활성화) ──
  const canDrag = activeFolder !== 'all'

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDragId(id)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (id !== dragOverId) setDragOverId(id)
  }

  const handleDrop = async (e: React.DragEvent, targetId: string) => {
    e.preventDefault()
    if (!dragId || dragId === targetId) { setDragId(null); setDragOverId(null); return }

    const fromIdx = summaries.findIndex(s => s.id === dragId)
    const toIdx   = summaries.findIndex(s => s.id === targetId)
    if (fromIdx === -1 || toIdx === -1) return

    const newList = [...summaries]
    const [moved] = newList.splice(fromIdx, 1)
    newList.splice(toIdx, 0, moved)

    // 낙관적 업데이트
    setSummaries(newList)
    setAllSummaries(prev => {
      const updated = [...prev]
      newList.forEach((s, i) => {
        const idx = updated.findIndex(u => u.id === s.id)
        if (idx !== -1) updated[idx] = { ...updated[idx], sortOrder: i }
      })
      return updated
    })
    setDragId(null)
    setDragOverId(null)

    // Firestore 저장
    setSavingOrder(true)
    try {
      await batchUpdateSortOrder(newList.map((s, i) => ({ id: s.id, sortOrder: i })))
    } catch {
      // 실패해도 로컬 순서는 유지 — 다음 로드 시 복구됨
    } finally {
      setSavingOrder(false)
    }
  }

  const handleDragEnd = () => { setDragId(null); setDragOverId(null) }

  // 모바일용 ↑↓ 이동
  const moveItem = async (id: string, direction: 'up' | 'down') => {
    const idx = summaries.findIndex(s => s.id === id)
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= summaries.length) return

    const newList = [...summaries]
    ;[newList[idx], newList[swapIdx]] = [newList[swapIdx], newList[idx]]
    setSummaries(newList)
    setSavingOrder(true)
    try {
      await batchUpdateSortOrder(newList.map((s, i) => ({ id: s.id, sortOrder: i })))
    } catch { /* ignore */ } finally {
      setSavingOrder(false)
    }
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

      {/* 탭 */}
      <div className="max-w-7xl mx-auto px-6 mb-4">
        <div className="flex gap-1 bg-[#32302e]/60 rounded-xl p-1 w-fit">
          <button
            onClick={() => setActiveTab('library')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'library' ? 'bg-[#3d3a38] text-white shadow' : 'text-[#75716e] hover:text-white'
            }`}
          >
            📚 내 라이브러리
          </button>
          <button
            onClick={() => setActiveTab('friends')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === 'friends' ? 'bg-[#3d3a38] text-white shadow' : 'text-[#75716e] hover:text-white'
            }`}
          >
            👥 친구
            {pendingCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-orange-500 text-white text-[9px] font-bold flex items-center justify-center">
                {pendingCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* 친구 탭 */}
      {activeTab === 'friends' && user && (
        <div className="max-w-7xl mx-auto px-6 pb-12">
          <FriendsTab myUid={user.uid} />
        </div>
      )}
      {activeTab === 'friends' && !user && (
        <div className="max-w-7xl mx-auto px-6 pb-12 text-center py-20 text-[#75716e]">
          로그인 후 이용할 수 있습니다.
        </div>
      )}

      {activeTab === 'library' && (
      <>

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
            <>
              {/* 폴더 내 순서 변경 안내 */}
              {canDrag && (
                <div className="flex items-center justify-between mb-4">
                  <p className="text-[#75716e] text-xs flex items-center gap-1.5">
                    <span className="hidden md:inline">⠿ 드래그로 순서를 변경할 수 있어요</span>
                    <span className="md:hidden">↑↓ 버튼으로 순서를 변경할 수 있어요</span>
                  </p>
                  {savingOrder && <p className="text-[#75716e] text-xs animate-pulse">저장 중...</p>}
                </div>
              )}
            <div className="columns-1 sm:columns-2 lg:columns-3 gap-6 space-y-6">
              {summaries.map((item, idx) => (
                <div
                  key={item.id}
                  className={`break-inside-avoid relative group transition-all ${
                    canDrag ? 'cursor-default' : ''
                  } ${dragOverId === item.id && dragId !== item.id ? 'ring-2 ring-orange-500 ring-offset-2 ring-offset-[#252423] rounded-[24px]' : ''}`}
                  draggable={canDrag}
                  onDragStart={canDrag ? (e) => handleDragStart(e, item.id) : undefined}
                  onDragOver={canDrag ? (e) => handleDragOver(e, item.id) : undefined}
                  onDrop={canDrag ? (e) => handleDrop(e, item.id) : undefined}
                  onDragEnd={canDrag ? handleDragEnd : undefined}
                >
                  {/* 드래그 핸들 (PC) */}
                  {canDrag && (
                    <div
                      className="absolute left-2 top-1/2 -translate-y-1/2 z-10 hidden md:flex items-center justify-center w-6 h-10 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing text-[#75716e] hover:text-white"
                      title="드래그해서 순서 변경"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <circle cx="9" cy="5" r="1.5"/><circle cx="15" cy="5" r="1.5"/>
                        <circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/>
                        <circle cx="9" cy="19" r="1.5"/><circle cx="15" cy="19" r="1.5"/>
                      </svg>
                    </div>
                  )}

                  <Link
                    href={`/result/${item.sessionId}`}
                    className={`block rounded-[24px] bg-[#32302e] border border-white/5 overflow-hidden hover:border-white/20 transition-all hover:-translate-y-1 shadow-lg ${dragId === item.id ? 'opacity-40 scale-95' : ''}`}
                    onClick={dragId ? (e) => e.preventDefault() : undefined}
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

                    {/* 모바일 순서 이동 버튼 */}
                    {canDrag && (
                      <div className="flex flex-col gap-0.5 md:hidden">
                        <button
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); moveItem(item.id, 'up') }}
                          disabled={idx === 0 || savingOrder}
                          className="p-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-white/70 hover:text-orange-400 hover:border-orange-400/50 disabled:opacity-30 transition-colors"
                          title="위로 이동"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
                          </svg>
                        </button>
                        <button
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); moveItem(item.id, 'down') }}
                          disabled={idx === summaries.length - 1 || savingOrder}
                          className="p-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-white/70 hover:text-orange-400 hover:border-orange-400/50 disabled:opacity-30 transition-colors"
                          title="아래로 이동"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            </>
          )}
        </main>
      </div>
      </>
      )}

      <FloatingChat summaries={allSummaries} source="mypage" />
    </div>
  )
}
