'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import Header from '@/components/common/Header'
import { getLocalUserId } from '@/lib/user'
import { formatRelativeDate } from '@/lib/formatDate'
import {
  getUserFolders, getSavedSummariesByFolder, deleteSavedSummary, updateSummaryFolder,
  getPendingFriendRequests, acceptFriendRequest, rejectFriendRequest, getFriends,
  batchUpdateSortOrder, renameFolder, deleteFolder, createSharedFolder,
  updateFolderVisibility, cloneFolder, createFolder, updateUserAvatar,
  createSharedFolderWithTree,
  Folder, SavedSummary, FriendRequest,
} from '@/lib/db'
import { useAuth } from '@/providers/AuthProvider'
import { PROFILE_COMPLETE_TOKENS } from '@/lib/db'
import { AVATARS, getAvatarBg } from '@/lib/avatar'
import { naturalSearch } from '@/lib/nlp-search'
import FloatingChat from '@/components/chat/FloatingChat'
import AvatarUploadModal from '@/components/profile/AvatarUploadModal'
import TravelWishlist from '@/components/travel/TravelWishlist'
import SavedItineraries from '@/components/travel/SavedItineraries'
import SavedBlogDrafts from '@/components/blog/SavedBlogDrafts'
import SavedShortsScripts from '@/components/shorts/SavedShortsScripts'
import SavedBookmarks from '@/components/bookmarks/SavedBookmarks'
import SavedVideoQuizzes from '@/components/video-quiz/SavedVideoQuizzes'
import YouTubeImportTab from '@/components/youtube-import/YouTubeImportTab'


const CATEGORY_LABEL: Record<string, string> = {
  recipe: '🍳 요리',
  english: '🔤 영어',
  learning: '📐 학습',
  news: '🗞️ 뉴스',
  selfdev: '💪 자기계발',
  travel: '🧳 여행',
  story: '🍿 스토리',
  tips: '💡 팁',
  voice: '🎙 녹음 메모',
  report: '📋 보고서',
}

const CATEGORY_ORDER = ['recipe', 'english', 'learning', 'news', 'selfdev', 'travel', 'story', 'tips', 'voice', 'report']

// ── 폴더 트리 헬퍼 ──
function buildFolderTree(allFolders: Folder[], parentId: string | null): Folder[] {
  return allFolders
    .filter(f => (f.parentId ?? null) === parentId)
    .sort((a, b) => (a.createdAt?.toMillis?.() ?? 0) - (b.createdAt?.toMillis?.() ?? 0))
}

function getFolderPath(allFolders: Folder[], folderId: string): Folder[] {
  const path: Folder[] = []
  let current = allFolders.find(f => f.id === folderId)
  while (current) {
    path.unshift(current)
    const pid = current.parentId ?? null
    current = pid ? allFolders.find(f => f.id === pid) : undefined
  }
  return path
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
          const indent = (f.depth ?? 0) * 12
          return (
            <button
              key={f.id}
              onClick={() => handleMove(f.id)}
              disabled={!!moving}
              style={{ paddingLeft: `${12 + indent}px` }}
              className={`w-full text-left pr-3 py-2 text-sm transition-colors flex items-center gap-2 ${
                isCurrent
                  ? 'text-orange-400 bg-orange-500/10 cursor-default'
                  : 'text-[#a4a09c] hover:bg-[#32302e] hover:text-white'
              } disabled:opacity-50`}
            >
              <span>{isMoving ? '⏳' : isCurrent ? '📂' : (f.depth ?? 0) > 0 ? '📂' : '📁'}</span>
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

// ── 폴더 트리 아이템 ──
interface FolderTreeItemProps {
  folder: Folder
  allFolders: Folder[]
  activeFolder: string
  expandedFolders: Set<string>
  folderMenuId: string | null
  renamingId: string | null
  renameValue: string
  creatingSubFolderIn: string | null
  newSubFolderName: string
  shareOptionsId: string | null
  onFolderClick: (id: string) => void
  onToggleExpand: (id: string) => void
  onMenuToggle: (e: React.MouseEvent, id: string) => void
  onRenameStart: (id: string, name: string) => void
  onRenameConfirm: (id: string) => void
  onRenameCancel: () => void
  onRenameValueChange: (v: string) => void
  onToggleVisibility: (f: Folder) => void
  onShareOptions: (id: string) => void
  onShare: (id: string, name: string, includeChildren: boolean) => void
  onDelete: (id: string, name: string) => void
  onCreateSubFolder: (parentId: string) => void
  onSubFolderNameChange: (v: string) => void
  onSubFolderConfirm: (parentId: string) => void
  onSubFolderCancel: () => void
  onSubFolderKeyDown: (e: React.KeyboardEvent, parentId: string) => void
}

function FolderTreeItem({
  folder, allFolders, activeFolder, expandedFolders, folderMenuId, renamingId,
  renameValue, creatingSubFolderIn, newSubFolderName, shareOptionsId,
  onFolderClick, onToggleExpand, onMenuToggle, onRenameStart, onRenameConfirm,
  onRenameCancel, onRenameValueChange, onToggleVisibility, onShareOptions, onShare,
  onDelete, onCreateSubFolder, onSubFolderNameChange, onSubFolderConfirm,
  onSubFolderCancel, onSubFolderKeyDown,
}: FolderTreeItemProps) {
  const children = buildFolderTree(allFolders, folder.id)
  const hasChildren = children.length > 0
  const isExpanded = expandedFolders.has(folder.id)
  const isActive = activeFolder === folder.id
  const depth = folder.depth ?? 0
  const indent = depth * 14

  return (
    <div>
      <div className="relative group/folder" style={{ marginLeft: `${indent}px` }}>
        {renamingId === folder.id ? (
          <div className="flex gap-1 px-1 py-1">
            <input
              autoFocus
              value={renameValue}
              onChange={e => onRenameValueChange(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') onRenameConfirm(folder.id)
                if (e.key === 'Escape') onRenameCancel()
              }}
              className="flex-1 bg-[#1c1a18] border border-orange-500/50 rounded-lg px-2 py-1 text-sm text-white focus:outline-none min-w-0"
            />
            <button onClick={() => onRenameConfirm(folder.id)} className="text-orange-400 text-xs px-1.5 py-1 rounded-lg hover:bg-orange-500/10">✓</button>
            <button onClick={onRenameCancel} className="text-[#75716e] text-xs px-1.5 py-1 rounded-lg hover:bg-white/5">✕</button>
          </div>
        ) : (
          <div className="flex items-center gap-0.5">
            {/* 확장/축소 화살표 */}
            <button
              onClick={() => onToggleExpand(folder.id)}
              className={`w-5 h-7 flex items-center justify-center text-[#75716e] hover:text-white transition-colors shrink-0 ${!hasChildren ? 'invisible' : ''}`}
            >
              <svg className={`w-3 h-3 transition-transform duration-150 ${isExpanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
              </svg>
            </button>

            {/* 폴더 버튼 */}
            <button
              onClick={() => onFolderClick(folder.id)}
              className={`flex-1 text-left py-2 px-2.5 rounded-xl whitespace-nowrap transition-all text-sm min-w-0 ${
                isActive
                  ? 'bg-orange-500 text-white font-bold'
                  : folder.clonedFrom
                    ? 'bg-orange-500/5 border border-orange-500/20 text-[#e2e2e2] hover:bg-orange-500/10'
                    : 'bg-[#32302e] text-[#a4a09c] hover:bg-[#3d3a38]'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <span className="shrink-0">{folder.clonedFrom ? '✨' : depth === 0 ? '📁' : '📂'}</span>
                <span className="truncate">{folder.name}</span>
                {hasChildren && (
                  <span className={`ml-auto text-[10px] shrink-0 ${isActive ? 'text-white/60' : 'text-[#75716e]'}`}>{children.length}</span>
                )}
              </span>
            </button>

            {/* 공개 토글 — clonedFrom 폴더는 숨김 */}
            {!folder.clonedFrom && (
              <button
                onClick={e => { e.stopPropagation(); onToggleVisibility(folder) }}
                className={`w-6 h-6 flex items-center justify-center rounded-lg text-[11px] transition-all shrink-0 ${
                  folder.visibility === 'public' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                  : folder.visibility === 'friends' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                  : 'bg-[#3d3a38] text-[#75716e] border border-white/5'
                }`}
                title={folder.visibility === 'public' ? '전체공개' : folder.visibility === 'friends' ? '친구만' : '나만 보기'}
              >
                {folder.visibility === 'public' ? '🌐' : folder.visibility === 'friends' ? '👥' : '🔒'}
              </button>
            )}

            {/* ⋯ 메뉴 */}
            <button
              onClick={e => onMenuToggle(e, folder.id)}
              className="w-6 h-6 opacity-0 group-hover/folder:opacity-100 rounded-lg flex items-center justify-center text-[#75716e] hover:text-white hover:bg-white/10 transition-all shrink-0"
            >⋯</button>
          </div>
        )}

        {/* 드롭다운 메뉴 */}
        {folderMenuId === folder.id && renamingId !== folder.id && (
          <div
            className="absolute right-0 top-full mt-1 z-30 bg-[#2a2826] border border-white/10 rounded-xl shadow-xl overflow-hidden min-w-[160px]"
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => { onRenameStart(folder.id, folder.name) }}
              className="w-full text-left px-4 py-2.5 text-sm text-[#a4a09c] hover:text-white hover:bg-white/5 transition-colors"
            >✏️ 이름 변경</button>

            {depth < 2 && (
              <button
                onClick={() => onCreateSubFolder(folder.id)}
                className="w-full text-left px-4 py-2.5 text-sm text-[#a4a09c] hover:text-white hover:bg-white/5 transition-colors"
              >📁 하위폴더 추가</button>
            )}

            {/* 공유 — 범위 선택 */}
            {shareOptionsId === folder.id ? (
              <div className="border-t border-white/5">
                <p className="px-4 pt-2 pb-1 text-[10px] text-[#75716e] font-semibold uppercase tracking-wider">공유 범위 선택</p>
                <button
                  onClick={() => onShare(folder.id, folder.name, false)}
                  className="w-full text-left px-4 py-2 text-sm text-[#a4a09c] hover:text-white hover:bg-white/5 transition-colors"
                >📄 이 폴더만</button>
                {hasChildren && (
                  <button
                    onClick={() => onShare(folder.id, folder.name, true)}
                    className="w-full text-left px-4 py-2 text-sm text-[#a4a09c] hover:text-white hover:bg-white/5 transition-colors"
                  >🗂️ 하위폴더 포함 전체</button>
                )}
              </div>
            ) : (
              <button
                onClick={() => onShareOptions(folder.id)}
                className="w-full text-left px-4 py-2.5 text-sm text-[#a4a09c] hover:text-white hover:bg-white/5 transition-colors"
              >🔗 공유 링크 복사</button>
            )}

            <button
              onClick={() => onDelete(folder.id, folder.name)}
              className="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
            >🗑️ 삭제</button>
          </div>
        )}
      </div>

      {/* 하위폴더 인라인 생성 */}
      {creatingSubFolderIn === folder.id && (
        <div className="flex gap-1 mt-1" style={{ marginLeft: `${indent + 19}px` }}>
          <input
            autoFocus
            value={newSubFolderName}
            onChange={e => onSubFolderNameChange(e.target.value)}
            onKeyDown={e => onSubFolderKeyDown(e, folder.id)}
            placeholder="하위폴더 이름..."
            className="flex-1 bg-[#1c1a18] border border-orange-500/50 rounded-lg px-2 py-1 text-sm text-white placeholder:text-[#75716e] focus:outline-none min-w-0"
          />
          <button onClick={() => onSubFolderConfirm(folder.id)} disabled={!newSubFolderName.trim()} className="text-orange-400 text-xs px-1.5 py-1 rounded-lg hover:bg-orange-500/10 disabled:opacity-40">✓</button>
          <button onClick={onSubFolderCancel} className="text-[#75716e] text-xs px-1.5 py-1 rounded-lg hover:bg-white/5">✕</button>
        </div>
      )}

      {/* 하위폴더 재귀 렌더 */}
      {isExpanded && hasChildren && (
        <div className="mt-1 flex flex-col gap-1">
          {children.map(child => (
            <FolderTreeItem
              key={child.id}
              folder={child}
              allFolders={allFolders}
              activeFolder={activeFolder}
              expandedFolders={expandedFolders}
              folderMenuId={folderMenuId}
              renamingId={renamingId}
              renameValue={renameValue}
              creatingSubFolderIn={creatingSubFolderIn}
              newSubFolderName={newSubFolderName}
              shareOptionsId={shareOptionsId}
              onFolderClick={onFolderClick}
              onToggleExpand={onToggleExpand}
              onMenuToggle={onMenuToggle}
              onRenameStart={onRenameStart}
              onRenameConfirm={onRenameConfirm}
              onRenameCancel={onRenameCancel}
              onRenameValueChange={onRenameValueChange}
              onToggleVisibility={onToggleVisibility}
              onShareOptions={onShareOptions}
              onShare={onShare}
              onDelete={onDelete}
              onCreateSubFolder={onCreateSubFolder}
              onSubFolderNameChange={onSubFolderNameChange}
              onSubFolderConfirm={onSubFolderConfirm}
              onSubFolderCancel={onSubFolderCancel}
              onSubFolderKeyDown={onSubFolderKeyDown}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── 여행 탭 (찜 + 저장 일정 서브탭) ──
function TravelTab({ userId }: { userId: string }) {
  const [subTab, setSubTab] = useState<'wishlist' | 'itineraries'>('wishlist')
  return (
    <div className="max-w-7xl mx-auto px-6 pb-12">
      <div className="mb-5">
        <h2 className="text-white font-bold text-lg mb-3">🧳 여행</h2>
        <div className="flex gap-1 bg-[#32302e]/60 rounded-xl p-1 w-fit">
          <button
            onClick={() => setSubTab('wishlist')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              subTab === 'wishlist' ? 'bg-[#3d3a38] text-white shadow' : 'text-[#75716e] hover:text-white'
            }`}
          >
            📍 여행 찜
          </button>
          <button
            onClick={() => setSubTab('itineraries')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              subTab === 'itineraries' ? 'bg-[#3d3a38] text-white shadow' : 'text-[#75716e] hover:text-white'
            }`}
          >
            🗓️ 저장된 일정
          </button>
        </div>
      </div>
      {subTab === 'wishlist' && <TravelWishlist userId={userId} />}
      {subTab === 'itineraries' && <SavedItineraries userId={userId} />}
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

function InviteButton({ isTeacher }: { isTeacher?: boolean }) {
  const [copied, setCopied] = useState<'teacher' | 'normal' | null>(null)
  const copy = (url: string, type: 'teacher' | 'normal') => {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(type)
      setTimeout(() => setCopied(null), 2000)
    })
  }
  if (isTeacher) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={() => copy('https://ssoktube.com?invite=teacher', 'teacher')}
          className="text-[11px] text-emerald-400 hover:text-emerald-300 transition-colors"
        >
          {copied === 'teacher' ? '✅ 복사됨!' : '🏫 선생님으로 초대'}
        </button>
        <span className="text-[#4a4745] text-[10px]">·</span>
        <button
          onClick={() => copy('https://ssoktube.com', 'normal')}
          className="text-[11px] text-orange-400 hover:text-orange-300 transition-colors"
        >
          {copied === 'normal' ? '✅ 복사됨!' : '🔗 일반 초대'}
        </button>
      </div>
    )
  }
  return (
    <button
      onClick={() => copy('https://ssoktube.com', 'normal')}
      className="text-[11px] text-orange-400 hover:text-orange-300 transition-colors"
    >
      {copied === 'normal' ? '✅ 복사됨!' : '🔗 친구 초대하기'}
    </button>
  )
}

export default function MyPage() {
  const { user, userProfile, needsProfile, refreshProfile } = useAuth()
  const [activeTab, setActiveTab] = useState<'library' | 'friends' | 'travel' | 'blog' | 'shorts' | 'bookmarks' | 'quizzes' | 'youtube'>('library')
  const [folders, setFolders] = useState<Folder[]>([])
  const [summaries, setSummaries] = useState<SavedSummary[]>([])
  const [allSummaries, setAllSummaries] = useState<SavedSummary[]>([])
  const [activeFolder, setActiveFolder] = useState<string>('all')
  const [folderMenuId, setFolderMenuId] = useState<string | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [openMoveId, setOpenMoveId] = useState<string | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [savingOrder, setSavingOrder] = useState(false)
  // 폴더 트리 확장/하위폴더 생성
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [creatingSubFolderIn, setCreatingSubFolderIn] = useState<string | null>(null)
  const [newSubFolderName, setNewSubFolderName] = useState('')
  const [shareOptionsId, setShareOptionsId] = useState<string | null>(null)
  const [pendingCount, setPendingCount] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [committedQuery, setCommittedQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [catDropdownOpen, setCatDropdownOpen] = useState(false)
  const catDropdownRef = useRef<HTMLDivElement>(null)
  const [creatingFolder, setCreatingFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [showAvatarPicker, setShowAvatarPicker] = useState(false)
  const [showAvatarMenu, setShowAvatarMenu] = useState(false)
  const [showPhotoUpload, setShowPhotoUpload] = useState(false)
  const [currentAvatar, setCurrentAvatar] = useState<string>('')
  const [currentPhotoURL, setCurrentPhotoURL] = useState<string>('')
  const [savingAvatar, setSavingAvatar] = useState(false)
  // 선생님 전환 모달
  const [showTeacherModal, setShowTeacherModal] = useState(false)
  const [teacherSchool, setTeacherSchool] = useState('')
  const [teacherGrade, setTeacherGrade] = useState('')
  const [teacherClassNum, setTeacherClassNum] = useState('')
  const [teacherSaving, setTeacherSaving] = useState(false)
  const [teacherError, setTeacherError] = useState('')
  const [teacherDoneCode, setTeacherDoneCode] = useState('')
  // 회원탈퇴
  const [showWithdrawModal, setShowWithdrawModal] = useState(false)
  const [withdrawConfirm, setWithdrawConfirm] = useState('')
  const [withdrawing, setWithdrawing] = useState(false)
  const [withdrawError, setWithdrawError] = useState('')

  // 폴더 메뉴 외부 클릭 시 닫기
  useEffect(() => {
    if (!folderMenuId) return
    const handler = () => setFolderMenuId(null)
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [folderMenuId])

  // 카테고리 드롭다운 외부 클릭 시 닫기
  useEffect(() => {
    if (!catDropdownOpen) return
    const handler = (e: MouseEvent) => {
      if (catDropdownRef.current && !catDropdownRef.current.contains(e.target as Node)) {
        setCatDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [catDropdownOpen])

  // userProfile 로드되면 currentAvatar 초기화
  useEffect(() => {
    if (userProfile?.avatarEmoji) setCurrentAvatar(userProfile.avatarEmoji)
  }, [userProfile])

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

  const handleAvatarChange = async (emoji: string) => {
    if (!user) return
    setSavingAvatar(true)
    try {
      await updateUserAvatar(user.uid, emoji)
      setCurrentAvatar(emoji)
      setShowAvatarPicker(false)
    } catch {
      alert('아바타 변경에 실패했습니다.')
    } finally {
      setSavingAvatar(false)
    }
  }

  const handleTeacherSetup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !teacherSchool.trim() || !teacherGrade || !teacherClassNum) {
      setTeacherError('모든 항목을 입력해주세요.')
      return
    }
    setTeacherSaving(true)
    setTeacherError('')
    try {
      const idToken = await user.getIdToken()
      const res = await fetch('/api/classroom/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: user.uid,
          idToken,
          teacherName: userProfile?.displayName || user.displayName || '',
          schoolName: teacherSchool.trim(),
          grade: Number(teacherGrade),
          classNum: Number(teacherClassNum),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setTeacherDoneCode(data.classCode)
      await refreshProfile()
    } catch (err: any) {
      setTeacherError(err.message || '오류가 발생했습니다.')
    } finally {
      setTeacherSaving(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (!user) return
    setWithdrawing(true)
    setWithdrawError('')
    try {
      const idToken = await user.getIdToken()
      const res = await fetch('/api/user/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({ classCode: userProfile?.classCode || null }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      // 탈퇴 완료 → 홈으로 이동
      window.location.href = '/'
    } catch (err: any) {
      setWithdrawError(err.message || '탈퇴 처리 중 오류가 발생했습니다.')
      setWithdrawing(false)
    }
  }

  const handleSearch = () => {
    setCommittedQuery(searchQuery)
  }

  const clearSearch = () => {
    setSearchQuery('')
    setCommittedQuery('')
  }

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
    setSelectedCategory('all')
    setFolderMenuId(null)
    setShareOptionsId(null)
    // 사이드바에서 조상 폴더 자동 확장
    if (folderId !== 'all') {
      const path = getFolderPath(folders, folderId)
      setExpandedFolders(prev => {
        const next = new Set(prev)
        path.forEach(f => next.add(f.id))
        return next
      })
    }
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

  // 폴더 이름 변경
  const handleRenameConfirm = async (id: string) => {
    if (!renameValue.trim()) return
    await renameFolder(id, renameValue.trim())
    setFolders(prev => prev.map(f => f.id === id ? { ...f, name: renameValue.trim() } : f))
    setRenamingId(null)
    setFolderMenuId(null)
  }

  // 새 루트 폴더 생성
  const handleCreateFolder = async () => {
    const name = newFolderName.trim()
    if (!name) return
    const uid = getLocalUserId()
    try {
      const created = await createFolder(uid, name, null, 0)
      setFolders(prev => [...prev, created])
      setNewFolderName('')
      setCreatingFolder(false)
    } catch {
      alert('폴더 생성에 실패했습니다.')
    }
  }

  // 하위폴더 생성
  const handleCreateSubFolder = async (parentId: string) => {
    const name = newSubFolderName.trim()
    if (!name) return
    const uid = getLocalUserId()
    const parentFolder = folders.find(f => f.id === parentId)
    const newDepth = (parentFolder?.depth ?? 0) + 1
    try {
      const created = await createFolder(uid, name, parentId, newDepth)
      setFolders(prev => [...prev, created])
      setExpandedFolders(prev => new Set([...prev, parentId]))
      setNewSubFolderName('')
      setCreatingSubFolderIn(null)
      setFolderMenuId(null)
    } catch {
      alert('하위폴더 생성에 실패했습니다.')
    }
  }

  const handleToggleVisibility = async (f: Folder) => {
    // 3단계 순환: private -> friends -> public -> private
    let next: 'private' | 'friends' | 'public' = 'private'
    if (!f.visibility || f.visibility === 'private') next = 'friends'
    else if (f.visibility === 'friends') next = 'public'
    else next = 'private'

    await updateFolderVisibility(f.id, next)
    setFolders(prev => prev.map(item => item.id === f.id ? { ...item, visibility: next } : item))
  }

  // 폴더 공유 링크 생성 (includeChildren = 하위폴더 포함 여부)
  const handleShareFolder = async (folderId: string, folderName: string, includeChildren: boolean) => {
    const uid = user?.uid || getLocalUserId()
    try {
      const shareId = await createSharedFolderWithTree(
        uid,
        user?.displayName || '익명',
        user?.photoURL || '',
        folderId,
        folderName,
        folders,
        includeChildren
      )
      const link = `${window.location.origin}/share/${shareId}`
      await navigator.clipboard.writeText(link)
      alert(`공유 링크가 클립보드에 복사됐습니다!${includeChildren ? '\n(하위폴더 포함)' : ''}`)
    } catch {
      alert('공유 링크 생성에 실패했습니다.')
    } finally {
      setFolderMenuId(null)
      setShareOptionsId(null)
    }
  }

  // 폴더 삭제 (하위폴더 연쇄 삭제)
  const handleDeleteFolder = async (folderId: string, folderName: string) => {
    const getAllDescendants = (id: string): string[] => {
      const children = folders.filter(f => f.parentId === id)
      return children.reduce<string[]>((acc, c) => [...acc, c.id, ...getAllDescendants(c.id)], [])
    }
    const descendants = getAllDescendants(folderId)
    const subCount = descendants.length
    if (!confirm(`"${folderName}" 폴더${subCount > 0 ? `와 하위폴더 ${subCount}개` : ''}를 삭제하시겠어요?\n폴더 안 항목들은 모든 저장 항목에서 계속 확인할 수 있습니다.`)) return
    try {
      await Promise.all([folderId, ...descendants].map(id => deleteFolder(id)))
      const deletedIds = new Set([folderId, ...descendants])
      setFolders(prev => prev.filter(f => !deletedIds.has(f.id)))
      if (deletedIds.has(activeFolder)) {
        setActiveFolder('all')
        const uid = getLocalUserId()
        const allItems = await getSavedSummariesByFolder(uid, 'all')
        setAllSummaries(allItems)
        setSummaries(allItems)
      }
    } catch { alert('폴더 삭제에 실패했습니다.') }
    finally { setFolderMenuId(null); setShareOptionsId(null) }
  }

  // 카테고리 필터 → 검색 필터 순서로 적용
  const catFiltered = selectedCategory === 'all'
    ? summaries
    : summaries.filter(s => s.category === selectedCategory)

  const filteredSummaries = committedQuery.trim()
    ? naturalSearch(
        catFiltered.map(s => ({
          ...s,
          categoryLabel: CATEGORY_LABEL[s.category] ?? s.category,
          tags: s.square_meta?.tags ?? [],
          topicCluster: s.square_meta?.topic_cluster ?? '',
        })),
        committedQuery,
      )
    : catFiltered

  // 현재 폴더 범위에서 실제 존재하는 카테고리만 드롭다운에 노출
  const availableCategories = CATEGORY_ORDER.filter(cat =>
    summaries.some(s => s.category === cat)
  )

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

      {/* 프로필 + 토큰 카드 */}
      {user && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 bg-[#32302e]/60 border border-white/5 rounded-2xl px-4 py-4 sm:px-5">
            {/* 윗줄: 아바타 + 이름 + 토큰 */}
            <div className="flex items-center gap-3 flex-1 min-w-0">
            {/* 아바타 */}
            <div className="relative shrink-0">
              {(currentPhotoURL || user.photoURL) ? (
                <img src={currentPhotoURL || user.photoURL!} alt="" className="w-11 h-11 rounded-full border border-white/10 object-cover" />
              ) : currentAvatar ? (
                <div
                  className="w-11 h-11 rounded-full flex items-center justify-center text-2xl border border-white/10"
                  style={{ backgroundColor: getAvatarBg(currentAvatar) }}
                >
                  {currentAvatar}
                </div>
              ) : (
                <div className="w-11 h-11 rounded-full bg-[#3d3a38] flex items-center justify-center text-xl border border-white/10">👤</div>
              )}
              {/* 아바타 변경 버튼 (항상 표시) */}
              <button
                  onClick={() => setShowAvatarMenu(v => !v)}
                  className="absolute -bottom-1 -right-1 w-5 h-5 bg-[#4a4745] hover:bg-orange-500 border border-white/20 rounded-full flex items-center justify-center transition-colors"
                  title="아바타 변경"
                >
                  <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
                    <path d="M9 1.5L10.5 3 4.5 9H3v-1.5L9 1.5z"/>
                  </svg>
                </button>
              {/* 아바타 변경 메뉴 */}
              {showAvatarMenu && (
                <div className="absolute top-14 left-0 z-50 bg-[#23211f] border border-white/15 rounded-2xl shadow-2xl w-44 py-1.5 overflow-hidden">
                  <button
                    onClick={() => { setShowAvatarMenu(false); setShowAvatarPicker(true) }}
                    className="w-full text-left px-4 py-2.5 text-sm text-[#a4a09c] hover:bg-[#32302e] hover:text-white transition-colors flex items-center gap-2"
                  >
                    <span>😊</span> 이모지 아바타
                  </button>
                  <button
                    onClick={() => { setShowAvatarMenu(false); setShowPhotoUpload(true) }}
                    className="w-full text-left px-4 py-2.5 text-sm text-[#a4a09c] hover:bg-[#32302e] hover:text-white transition-colors flex items-center gap-2"
                  >
                    <span>📷</span> 사진 업로드
                  </button>
                  <button
                    onClick={() => setShowAvatarMenu(false)}
                    className="w-full text-left px-4 py-2.5 text-xs text-[#75716e] hover:text-white transition-colors"
                  >
                    닫기
                  </button>
                </div>
              )}
              {/* 이모지 픽커 */}
              {showAvatarPicker && (
                <div className="absolute top-14 left-0 z-50 bg-[#23211f] border border-white/15 rounded-2xl p-3 shadow-2xl w-52">
                  <p className="text-[#75716e] text-[10px] font-semibold mb-2 uppercase tracking-wider">아바타 선택</p>
                  <div className="grid grid-cols-4 gap-1.5">
                    {AVATARS.map(a => (
                      <button
                        key={a.emoji}
                        onClick={() => handleAvatarChange(a.emoji)}
                        disabled={savingAvatar}
                        className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl transition-all border ${
                          currentAvatar === a.emoji
                            ? 'border-orange-500 scale-110'
                            : 'border-transparent hover:border-white/20 hover:scale-105'
                        }`}
                        style={{ backgroundColor: a.bg }}
                      >
                        {a.emoji}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setShowAvatarPicker(false)}
                    className="w-full mt-2 text-[#75716e] text-xs hover:text-white transition-colors py-1"
                  >
                    닫기
                  </button>
                </div>
              )}
            </div>
            {/* 이름 + 정보 */}
            <div className="flex-1 min-w-0">
              <p className="text-white font-bold text-sm truncate flex items-center gap-2">
                {user.displayName || '사용자'}
                {userProfile?.role === 'teacher' && (
                  <span className="text-[10px] px-1.5 py-0.5 bg-emerald-500/15 text-emerald-400 rounded-full border border-emerald-500/20 font-bold">선생님</span>
                )}
                {userProfile?.role === 'student' && (
                  <span className="text-[10px] px-1.5 py-0.5 bg-blue-500/15 text-blue-400 rounded-full border border-blue-500/20 font-bold">학생</span>
                )}
              </p>
              <p className="text-[#75716e] text-xs truncate">{user.email}</p>
            </div>
            {/* 토큰 잔액 (아바타 우측, 모바일에서도 한 줄) */}
            <div className="flex items-center gap-2 shrink-0 ml-auto">
              <div className="flex items-center gap-1.5 bg-[#23211f] border border-white/10 rounded-xl px-3 py-2">
                <span className="text-base">🪙</span>
                <span className="text-white font-bold text-sm">{userProfile?.tokens ?? 0}</span>
                <span className="text-[#75716e] text-xs hidden sm:inline">토큰</span>
              </div>
              {needsProfile && (
                <div className="flex items-center gap-1 bg-orange-500/10 border border-orange-500/30 rounded-xl px-2 py-2">
                  <span className="text-sm">🎁</span>
                  <span className="text-orange-400 text-xs font-bold hidden sm:inline">+{PROFILE_COMPLETE_TOKENS}</span>
                </div>
              )}
            </div>
          </div>
          {/* 아랫줄: 클래스/전환 링크 + 초대 + 탈퇴 */}
          <div className="flex items-center justify-between mt-2 px-1">
            <div className="flex items-center gap-3">
              {userProfile && !userProfile.role && (
                <button
                  onClick={() => { setShowTeacherModal(true); setTeacherDoneCode(''); setTeacherError('') }}
                  className="text-[11px] text-emerald-400 hover:text-emerald-300 transition-colors"
                >
                  🏫 선생님으로 전환
                </button>
              )}
              {userProfile?.role === 'teacher' && userProfile.classCode && (
                <Link href={`/classroom/${userProfile.classCode}`} className="text-[11px] text-emerald-400 hover:text-emerald-300 transition-colors">
                  🏫 내 클래스 대시보드 →
                </Link>
              )}
              <InviteButton isTeacher={userProfile?.role === 'teacher'} />
            </div>
            <button
              onClick={() => { setShowWithdrawModal(true); setWithdrawConfirm(''); setWithdrawError('') }}
              className="text-[#4a4745] hover:text-red-500/70 text-[10px] transition-colors"
              title="회원탈퇴"
            >
              탈퇴
            </button>
          </div>
          </div>
        </div>
      )}

      {/* 탭 */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 mb-4">
        <div className="overflow-x-auto scrollbar-none">
          <div className="flex gap-1 bg-[#32302e]/60 rounded-xl p-1 w-max min-w-full sm:w-fit">
            <button
              onClick={() => setActiveTab('library')}
              className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
                activeTab === 'library' ? 'bg-[#3d3a38] text-white shadow' : 'text-[#75716e] hover:text-white'
              }`}
            >
              📚 <span className="hidden xs:inline">내 </span>라이브러리
            </button>
            <button
              onClick={() => setActiveTab('friends')}
              className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 ${
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
            <button
              onClick={() => setActiveTab('travel')}
              className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
                activeTab === 'travel' ? 'bg-[#3d3a38] text-white shadow' : 'text-[#75716e] hover:text-white'
              }`}
            >
              🧳 여행
            </button>
            <button
              onClick={() => setActiveTab('blog')}
              className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
                activeTab === 'blog' ? 'bg-[#3d3a38] text-white shadow' : 'text-[#75716e] hover:text-white'
              }`}
            >
              ✍️ 블로그
            </button>
            <button
              onClick={() => setActiveTab('shorts')}
              className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
                activeTab === 'shorts' ? 'bg-[#3d3a38] text-white shadow' : 'text-[#75716e] hover:text-white'
              }`}
            >
              ✂️ 숏폼
            </button>
            <Link
              href="/report"
              className="px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap text-[#75716e] hover:text-white"
            >
              📊 멀티 리포트
            </Link>
            <button
              onClick={() => setActiveTab('bookmarks')}
              className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
                activeTab === 'bookmarks' ? 'bg-[#3d3a38] text-white shadow' : 'text-[#75716e] hover:text-white'
              }`}
            >
              🔖 북마크
            </button>
            <button
              onClick={() => setActiveTab('quizzes')}
              className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap ${
                activeTab === 'quizzes' ? 'bg-[#3d3a38] text-white shadow' : 'text-[#75716e] hover:text-white'
              }`}
            >
              🧩 퀴즈
            </button>
            <button
              onClick={() => setActiveTab('youtube')}
              className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'youtube' ? 'bg-[#3d3a38] text-white shadow' : 'text-[#75716e] hover:text-white'
              }`}
            >
              <svg className="w-3.5 h-3.5 text-red-500 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
              </svg>
              가져오기
            </button>
          </div>
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

      {activeTab === 'travel' && (
        <TravelTab userId={user?.uid ?? getLocalUserId()} />
      )}

      {activeTab === 'blog' && (
        <div className="max-w-7xl mx-auto px-6 pb-12">
          <div className="mb-4">
            <h2 className="text-white font-bold text-lg">✍️ 저장된 블로그 초안</h2>
            <p className="text-[#75716e] text-sm mt-0.5">요약 결과에서 생성한 SEO 블로그 초안을 저장하고 관리하세요.</p>
          </div>
          <SavedBlogDrafts userId={user?.uid ?? getLocalUserId()} />
        </div>
      )}

      {activeTab === 'shorts' && (
        <div className="max-w-7xl mx-auto px-6 pb-12">
          <div className="mb-4">
            <h2 className="text-white font-bold text-lg">✂️ 저장된 숏폼 스크립트</h2>
            <p className="text-[#75716e] text-sm mt-0.5">롱폼 영상에서 추출한 숏폼 구간 스크립트를 저장하고 관리하세요.</p>
          </div>
          <SavedShortsScripts userId={user?.uid ?? getLocalUserId()} />
        </div>
      )}

      {activeTab === 'bookmarks' && (
        <div className="max-w-7xl mx-auto px-6 pb-12">
          <div className="mb-5">
            <h2 className="text-white font-bold text-lg">🔖 타임스탬프 북마크</h2>
            <p className="text-[#75716e] text-sm mt-0.5">영상 시청 중 저장한 구간과 메모를 한눈에 확인하세요.</p>
          </div>
          <SavedBookmarks userId={user?.uid ?? getLocalUserId()} />
        </div>
      )}

      {activeTab === 'quizzes' && (
        <div className="max-w-2xl mx-auto px-6 pb-12">
          <div className="mb-5">
            <h2 className="text-white font-bold text-lg">🧩 타임스탬프 퀴즈</h2>
            <p className="text-[#75716e] text-sm mt-0.5">영상 특정 시점에 추가한 퀴즈를 관리하세요. 영상이 해당 시점에 도달하면 자동으로 표시됩니다.</p>
          </div>
          <SavedVideoQuizzes userId={user?.uid ?? getLocalUserId()} />
        </div>
      )}

      {activeTab === 'youtube' && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-12">
          <div className="mb-5">
            <h2 className="text-white font-bold text-lg flex items-center gap-2">
              <svg className="w-5 h-5 text-red-500" viewBox="0 0 24 24" fill="currentColor">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
              </svg>
              YouTube 재생목록 가져오기
            </h2>
            <p className="text-[#75716e] text-sm mt-0.5">저장해둔 재생목록 영상을 선택하고 AI로 요약하세요.</p>
          </div>
          {user ? (
            <YouTubeImportTab />
          ) : (
            <div className="text-center py-20 text-[#75716e] text-sm">로그인 후 이용할 수 있습니다.</div>
          )}
        </div>
      )}

      {activeTab === 'library' && (
      <>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-12 flex flex-col md:flex-row gap-8">

        {/* Sidebar: Folders */}
        <aside className="w-full md:w-64 shrink-0 flex flex-col gap-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-bold text-white">폴더 목록</h2>
            <button
              onClick={() => { setCreatingFolder(true); setNewFolderName('') }}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-orange-500/15 text-orange-400 hover:bg-orange-500/25 text-xs font-bold transition-colors"
              title="새 폴더 만들기"
            >
              + 새 폴더
            </button>
          </div>

          {/* 새 폴더 인라인 입력 */}
          {creatingFolder && (
            <div className="flex gap-1 mb-2">
              <input
                autoFocus
                value={newFolderName}
                onChange={e => setNewFolderName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleCreateFolder()
                  if (e.key === 'Escape') { setCreatingFolder(false); setNewFolderName('') }
                }}
                placeholder="폴더 이름..."
                className="flex-1 bg-[#1c1a18] border border-orange-500/50 rounded-lg px-3 py-1.5 text-sm text-white placeholder:text-[#75716e] focus:outline-none min-w-0"
              />
              <button
                onClick={handleCreateFolder}
                disabled={!newFolderName.trim()}
                className="text-orange-400 text-xs px-2 py-1 rounded-lg hover:bg-orange-500/10 disabled:opacity-40 transition-colors"
              >✓</button>
              <button
                onClick={() => { setCreatingFolder(false); setNewFolderName('') }}
                className="text-[#75716e] text-xs px-2 py-1 rounded-lg hover:bg-white/5 transition-colors"
              >✕</button>
            </div>
          )}
          {/* 공개 설정 범례 */}
          <div className="flex items-center gap-2 mb-3 text-[10px] text-[#75716e] bg-[#32302e]/50 rounded-lg px-3 py-2 whitespace-nowrap overflow-hidden">
            <span className="flex items-center gap-0.5 shrink-0"><span>🔒</span><span>나만</span></span>
            <span className="text-white/10 shrink-0">·</span>
            <span className="flex items-center gap-0.5 shrink-0"><span>👥</span><span>친구</span></span>
            <span className="text-white/10 shrink-0">·</span>
            <span className="flex items-center gap-0.5 shrink-0"><span>🌐</span><span>공개</span></span>
            <span className="ml-auto text-[9px] text-white/20 shrink-0">탭으로 변경</span>
          </div>
          <div className="flex flex-col gap-1 overflow-x-auto md:overflow-visible pb-2 scrollbar-none">
            <button
              onClick={() => handleFolderClick('all')}
              className={`text-left px-4 py-3 rounded-xl whitespace-nowrap transition-colors text-sm ${
                activeFolder === 'all' ? 'bg-orange-500 text-white font-bold' : 'bg-[#32302e] text-[#a4a09c] hover:bg-[#3d3a38]'
              }`}
            >
              🌐 모든 저장 항목
            </button>
            {buildFolderTree(folders, null).map(f => (
              <FolderTreeItem
                key={f.id}
                folder={f}
                allFolders={folders}
                activeFolder={activeFolder}
                expandedFolders={expandedFolders}
                folderMenuId={folderMenuId}
                renamingId={renamingId}
                renameValue={renameValue}
                creatingSubFolderIn={creatingSubFolderIn}
                newSubFolderName={newSubFolderName}
                shareOptionsId={shareOptionsId}
                onFolderClick={handleFolderClick}
                onToggleExpand={id => setExpandedFolders(prev => {
                  const next = new Set(prev)
                  next.has(id) ? next.delete(id) : next.add(id)
                  return next
                })}
                onMenuToggle={(e, id) => { e.stopPropagation(); setFolderMenuId(prev => prev === id ? null : id); setShareOptionsId(null) }}
                onRenameStart={(id, name) => { setRenamingId(id); setRenameValue(name); setFolderMenuId(null) }}
                onRenameConfirm={handleRenameConfirm}
                onRenameCancel={() => { setRenamingId(null); setFolderMenuId(null) }}
                onRenameValueChange={setRenameValue}
                onToggleVisibility={handleToggleVisibility}
                onShareOptions={id => setShareOptionsId(prev => prev === id ? null : id)}
                onShare={handleShareFolder}
                onDelete={handleDeleteFolder}
                onCreateSubFolder={id => { setCreatingSubFolderIn(id); setExpandedFolders(prev => new Set([...prev, id])); setFolderMenuId(null) }}
                onSubFolderNameChange={setNewSubFolderName}
                onSubFolderConfirm={handleCreateSubFolder}
                onSubFolderCancel={() => { setCreatingSubFolderIn(null); setNewSubFolderName('') }}
                onSubFolderKeyDown={(e, parentId) => {
                  if (e.key === 'Enter') handleCreateSubFolder(parentId)
                  if (e.key === 'Escape') { setCreatingSubFolderIn(null); setNewSubFolderName('') }
                }}
              />
            ))}
          </div>
        </aside>

        {/* Content Grid */}
        <main className="flex-1">
          {/* 브레드크럼 */}
          {activeFolder !== 'all' && (() => {
            const path = getFolderPath(folders, activeFolder)
            return (
              <nav className="flex items-center gap-1 text-xs text-[#75716e] mb-3 overflow-x-auto scrollbar-none flex-wrap">
                <button onClick={() => handleFolderClick('all')} className="hover:text-white whitespace-nowrap transition-colors">모든 저장 항목</button>
                {path.map(f => (
                  <span key={f.id} className="flex items-center gap-1">
                    <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    <button
                      onClick={() => handleFolderClick(f.id)}
                      className={`whitespace-nowrap transition-colors ${f.id === activeFolder ? 'text-white font-semibold' : 'hover:text-white'}`}
                    >{f.name}</button>
                  </span>
                ))}
              </nav>
            )
          })()}

          {/* 검색창 + 카테고리 드롭다운 */}
          {committedQuery && (
            <div className="flex items-center gap-2 mb-2 text-[11px] text-orange-400/80">
              <span>"{committedQuery}" 검색 결과 {filteredSummaries.length}개</span>
              <button onClick={clearSearch} className="text-[#75716e] hover:text-white">전체 보기</button>
            </div>
          )}
          <div className="flex items-center gap-2 mb-5">
            <div className="relative flex-1">
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSearch() }}
                placeholder="검색어 입력 후 검색 버튼을 누르세요"
                className={`w-full h-10 pl-9 pr-8 bg-[#32302e] border rounded-xl text-sm text-white placeholder:text-[#75716e] focus:outline-none transition-colors ${
                  committedQuery ? 'border-orange-500/50' : 'border-white/10 focus:border-orange-500/50'
                }`}
              />
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#75716e]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              {(searchQuery || committedQuery) && (
                <button onClick={clearSearch} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#75716e] hover:text-white text-xs">✕</button>
              )}
            </div>
            <button
              onClick={handleSearch}
              className="h-10 px-4 bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold rounded-xl transition-colors shrink-0"
            >
              검색
            </button>

            {/* 카테고리 드롭다운 */}
            <div ref={catDropdownRef} className="relative shrink-0">
              <button
                onClick={() => setCatDropdownOpen(prev => !prev)}
                className={`h-10 flex items-center gap-2 px-3 rounded-xl border text-sm font-medium transition-all ${
                  selectedCategory !== 'all'
                    ? 'border-orange-500/50 bg-orange-500/10 text-orange-300'
                    : 'border-white/10 bg-[#32302e] text-[#a4a09c] hover:text-white hover:border-white/20'
                }`}
              >
                <span>{selectedCategory === 'all' ? '🏷' : CATEGORY_LABEL[selectedCategory]?.split(' ')[0]}</span>
                <span className="hidden sm:inline">
                  {selectedCategory === 'all' ? '전체 카테고리' : CATEGORY_LABEL[selectedCategory]?.split(' ').slice(1).join(' ')}
                </span>
                <svg className={`w-3.5 h-3.5 transition-transform ${catDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {catDropdownOpen && (
                <div className="absolute right-0 top-full mt-1.5 z-40 bg-[#23211f] border border-white/10 rounded-2xl shadow-2xl overflow-hidden min-w-[160px] py-1.5">
                  {/* 전체 */}
                  <button
                    onClick={() => { setSelectedCategory('all'); setCatDropdownOpen(false) }}
                    className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-2.5 transition-colors ${
                      selectedCategory === 'all'
                        ? 'text-orange-400 bg-orange-500/10'
                        : 'text-[#a4a09c] hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <span>🌐</span>
                    <span>전체 카테고리</span>
                    {selectedCategory === 'all' && <span className="ml-auto text-[10px]">✓</span>}
                  </button>
                  <div className="h-px bg-white/5 mx-3 my-1" />
                  {/* 현재 폴더에 존재하는 카테고리만 */}
                  {availableCategories.map(cat => (
                    <button
                      key={cat}
                      onClick={() => { setSelectedCategory(cat); setCatDropdownOpen(false) }}
                      className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-2.5 transition-colors ${
                        selectedCategory === cat
                          ? 'text-orange-400 bg-orange-500/10'
                          : 'text-[#a4a09c] hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <span>{CATEGORY_LABEL[cat]?.split(' ')[0]}</span>
                      <span>{CATEGORY_LABEL[cat]?.split(' ').slice(1).join(' ')}</span>
                      <span className="ml-auto text-[10px] text-[#75716e]">
                        {summaries.filter(s => s.category === cat).length}
                      </span>
                      {selectedCategory === cat && <span className="text-[10px] text-orange-400">✓</span>}
                    </button>
                  ))}
                  {availableCategories.length === 0 && (
                    <p className="px-4 py-2 text-xs text-[#75716e]">항목이 없습니다</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 하위폴더 카드 — 항상 표시 (영상 그리드 위) */}
          {(() => {
            if (activeFolder === 'all') return null
            const subFolders = buildFolderTree(folders, activeFolder)
            if (subFolders.length === 0) return null
            return (
              <div className="mb-6">
                <p className="text-[10px] text-[#75716e] font-semibold uppercase tracking-wider mb-2">하위 폴더</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {subFolders.map(sf => {
                    const grandChildren = buildFolderTree(folders, sf.id)
                    return (
                      <button
                        key={sf.id}
                        onClick={() => handleFolderClick(sf.id)}
                        className="flex items-center gap-2.5 px-3 py-3 bg-[#32302e] hover:bg-[#3d3a38] rounded-xl border border-white/5 hover:border-orange-500/30 text-left transition-all group"
                      >
                        <span className="text-xl shrink-0">📂</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-[#e2e2e2] group-hover:text-white truncate">{sf.name}</p>
                          {grandChildren.length > 0 && (
                            <p className="text-[10px] text-[#75716e]">{grandChildren.length}개 하위폴더</p>
                          )}
                        </div>
                        <svg className="w-3.5 h-3.5 text-[#75716e] group-hover:text-orange-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })()}

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500" />
            </div>
          ) : allSummaries.length === 0 ? (
            <div className="bg-[#32302e]/50 rounded-[32px] p-12 text-center border border-white/5">
              <span className="text-4xl mb-4 block">📭</span>
              <h2 className="text-xl text-white font-medium mb-2">저장된 영상이 없습니다</h2>
              <p className="text-[#75716e] text-sm">영상을 요약하면 자동으로 라이브러리에 저장됩니다.</p>
            </div>
          ) : summaries.length === 0 && buildFolderTree(folders, activeFolder === 'all' ? null : activeFolder).length === 0 ? (
            <div className="bg-[#32302e]/50 rounded-[32px] p-12 text-center border border-white/5">
              <span className="text-4xl mb-4 block">📂</span>
              <h2 className="text-xl text-white font-medium mb-2">이 폴더는 비어있습니다</h2>
              <p className="text-[#75716e] text-sm">카드의 📁 아이콘으로 항목을 폴더에 추가하세요.</p>
            </div>
          ) : summaries.length === 0 ? null : (
            <>
              {/* 드래그 순서 변경 안내 + 필터 상태 */}
              <div className="flex items-center justify-between mb-4 min-h-[20px]">
                <p className="text-[#75716e] text-xs flex items-center gap-1.5">
                  {canDrag && (
                    <>
                      <span className="hidden md:inline">⠿ 드래그로 순서를 변경할 수 있어요</span>
                      <span className="md:hidden">↑↓ 버튼으로 순서를 변경할 수 있어요</span>
                    </>
                  )}
                  {(selectedCategory !== 'all' || searchQuery) && (
                    <span className="flex items-center gap-1 flex-wrap">
                      {selectedCategory !== 'all' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-[10px]">
                          {CATEGORY_LABEL[selectedCategory]}
                          <button onClick={() => setSelectedCategory('all')} className="hover:text-white ml-0.5">✕</button>
                        </span>
                      )}
                      {committedQuery && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[#a4a09c] text-[10px]">
                          &quot;{committedQuery}&quot;
                          <button onClick={clearSearch} className="hover:text-white ml-0.5">✕</button>
                        </span>
                      )}
                      <span className="text-[#75716e]">· {filteredSummaries.length}개</span>
                    </span>
                  )}
                </p>
                {savingOrder && <p className="text-[#75716e] text-xs animate-pulse">저장 중...</p>}
              </div>

              {filteredSummaries.length === 0 ? (
                <div className="bg-[#32302e]/50 rounded-[32px] p-12 text-center border border-white/5">
                  <span className="text-3xl mb-3 block">🔍</span>
                  <p className="text-white font-medium mb-1">결과가 없습니다</p>
                  <p className="text-[#75716e] text-sm">다른 카테고리나 검색어를 시도해보세요</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredSummaries.map((item, idx) => (
                    <div
                      key={item.id}
                      className={`relative group transition-all ${
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
                          {activeFolder === 'all' && item.folderId && folders.find(f => f.id === item.folderId) && (
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
                        <div className="relative">
                          <button
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpenMoveId(openMoveId === item.id ? null : item.id) }}
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
              )}
            </>
          )}
        </main>
      </div>
      </>
      )}

      <FloatingChat summaries={allSummaries} source="mypage" userId={user?.uid || getLocalUserId()} />

      {/* 사진 업로드 모달 */}
      {showPhotoUpload && user && (
        <AvatarUploadModal
          userId={user.uid}
          onClose={() => setShowPhotoUpload(false)}
          onSuccess={(url) => {
            setCurrentPhotoURL(url)
            setCurrentAvatar('')
            setShowPhotoUpload(false)
          }}
        />
      )}

      {/* 회원탈퇴 모달 */}
      {showWithdrawModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => { if (!withdrawing) setShowWithdrawModal(false) }} />
          <div className="relative w-full max-w-sm bg-[#1c1a18] rounded-3xl border border-red-500/20 shadow-2xl p-7">
            <button
              onClick={() => setShowWithdrawModal(false)}
              disabled={withdrawing}
              className="absolute top-4 right-4 text-[#75716e] hover:text-white transition-colors text-xl leading-none"
            >✕</button>
            <div className="text-center mb-5">
              <div className="text-4xl mb-3">⚠️</div>
              <h2 className="text-lg font-bold text-white mb-2">회원 탈퇴</h2>
              <p className="text-[#a4a09c] text-sm leading-relaxed">
                탈퇴하면 저장된 모든 영상, 폴더, 친구 관계가 <span className="text-red-400 font-bold">영구 삭제</span>됩니다.
                이 작업은 되돌릴 수 없습니다.
              </p>
            </div>
            <div className="bg-[#2a2826] rounded-2xl p-4 mb-5">
              <p className="text-[#75716e] text-xs mb-2">탈퇴를 진행하려면 아래에 <span className="text-white font-bold">탈퇴합니다</span>를 입력하세요</p>
              <input
                type="text"
                value={withdrawConfirm}
                onChange={e => setWithdrawConfirm(e.target.value)}
                placeholder="탈퇴합니다"
                disabled={withdrawing}
                className="w-full bg-[#1c1a18] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-[#4a4745] focus:outline-none focus:border-red-500/50 transition-colors"
              />
            </div>
            {withdrawError && (
              <p className="text-red-400 text-xs text-center mb-4">{withdrawError}</p>
            )}
            <button
              onClick={handleDeleteAccount}
              disabled={withdrawConfirm !== '탈퇴합니다' || withdrawing}
              className="w-full py-3 bg-red-600 hover:bg-red-500 disabled:bg-[#3a3836] disabled:text-[#75716e] text-white font-bold rounded-2xl text-sm transition-colors flex items-center justify-center gap-2"
            >
              {withdrawing ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  탈퇴 처리 중...
                </>
              ) : '탈퇴하기'}
            </button>
          </div>
        </div>
      )}

      {/* 선생님 전환 모달 */}
      {showTeacherModal && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => { if (!teacherSaving) setShowTeacherModal(false) }} />
          <div className="relative w-full max-w-sm bg-[#1c1a18] rounded-3xl border border-white/10 shadow-2xl p-8">
            <button
              onClick={() => setShowTeacherModal(false)}
              disabled={teacherSaving}
              className="absolute top-4 right-4 text-[#75716e] hover:text-white transition-colors text-xl leading-none"
            >✕</button>

            {teacherDoneCode ? (
              /* 완료 화면 */
              <div className="text-center">
                <div className="text-5xl mb-4">🏫</div>
                <h2 className="text-xl font-bold text-white mb-2">클래스 개설 완료!</h2>
                <p className="text-[#a4a09c] text-sm mb-5">학생들에게 아래 코드를 알려주세요.</p>
                <div className="bg-[#2a2826] rounded-2xl p-4 mb-5">
                  <p className="text-[#75716e] text-xs mb-1">우리 반 코드</p>
                  <p className="text-4xl font-black text-emerald-400 tracking-widest">{teacherDoneCode}</p>
                  <p className="text-[#75716e] text-xs mt-2">{teacherSchool} {teacherGrade}학년 {teacherClassNum}반</p>
                </div>
                <Link
                  href={`/classroom/${teacherDoneCode}`}
                  onClick={() => setShowTeacherModal(false)}
                  className="block w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl text-sm transition-colors text-center"
                >
                  클래스 대시보드로 이동
                </Link>
              </div>
            ) : (
              /* 입력 폼 */
              <>
                <h2 className="text-lg font-bold text-white mb-1">🏫 선생님으로 전환</h2>
                <p className="text-[#a4a09c] text-sm mb-6">클래스를 개설하면 학생들을 초대할 수 있어요.</p>
                <form onSubmit={handleTeacherSetup} className="flex flex-col gap-4">
                  <div>
                    <label className="block text-xs text-[#75716e] mb-1.5">학교명</label>
                    <input
                      type="text"
                      value={teacherSchool}
                      onChange={e => setTeacherSchool(e.target.value)}
                      placeholder="예) 제주초등학교"
                      className="w-full bg-[#2a2826] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-[#75716e] focus:outline-none focus:border-emerald-500/50 transition-colors"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-[#75716e] mb-1.5">학년</label>
                      <select
                        value={teacherGrade}
                        onChange={e => setTeacherGrade(e.target.value)}
                        className="w-full bg-[#2a2826] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-colors"
                      >
                        <option value="">선택</option>
                        {[1,2,3,4,5,6].map(n => <option key={n} value={n}>{n}학년</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-[#75716e] mb-1.5">반</label>
                      <select
                        value={teacherClassNum}
                        onChange={e => setTeacherClassNum(e.target.value)}
                        className="w-full bg-[#2a2826] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-colors"
                      >
                        <option value="">선택</option>
                        {Array.from({length: 15}, (_, i) => i+1).map(n => <option key={n} value={n}>{n}반</option>)}
                      </select>
                    </div>
                  </div>
                  {teacherError && <p className="text-red-400 text-xs text-center">{teacherError}</p>}
                  <button
                    type="submit"
                    disabled={teacherSaving}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2 mt-1"
                  >
                    {teacherSaving ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                        </svg>
                        클래스 개설 중...
                      </>
                    ) : '클래스 개설하기'}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
