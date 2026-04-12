'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Header from '@/components/common/Header'
import { 
  getUserProfile, getUserPublicSummaries, getAllSavedSummariesByUser,
  getOrCreateConversation, sendFriendRequest, getFriendStatus,
  acceptFriendRequest, rejectFriendRequest, cancelFriendRequest, removeFriend,
  UserProfile, SavedSummary, Folder,
  getVisibleFolders, cloneFolder, getSavedSummariesByFolder, saveSummary,
} from '@/lib/db'
import { useAuth } from '@/providers/AuthProvider'
import { useChat } from '@/providers/ChatProvider'
import { formatRelativeDate } from '@/lib/formatDate'

const CATEGORY_LABEL: Record<string, string> = {
  recipe: '🍳 요리', english: '🔤 영어', learning: '📐 학습',
  news: '🗞️ 뉴스', selfdev: '💪 자기계발', travel: '🧳 여행',
  story: '🍿 스토리', tips: '💡 팁',
}

type FriendStatus = 'none' | 'pending_sent' | 'pending_received' | 'friends'

export default function ProfilePage() {
  const { userId } = useParams<{ userId: string }>()
  const { user } = useAuth()
  const { openChat } = useChat()
  const router = useRouter()

  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [folders, setFolders] = useState<Folder[]>([])
  const [loading, setLoading] = useState(true)
  const [friendStatus, setFriendStatus] = useState<FriendStatus>('none')
  const [friendLoading, setFriendLoading] = useState(false)
  const [messaging, setMessaging] = useState(false)

  // 폴더 모달용 상태
  const [selectedFolder, setSelectedFolder] = useState<Folder | null>(null)
  const [folderItems, setFolderItems] = useState<SavedSummary[]>([])
  const [itemsLoading, setItemsLoading] = useState(false)
  const [cloning, setCloning] = useState(false)

  const isMyProfile = user?.uid === userId

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [p, status] = await Promise.all([
          getUserProfile(userId),
          user && !isMyProfile ? getFriendStatus(user.uid, userId) : Promise.resolve('none' as FriendStatus),
        ])
        setProfile(p)
        setFriendStatus(status)

        // 친구 여부에 따라 폴더 목록 가져오기
        const isFriend = status === 'friends'
        const f = await getVisibleFolders(userId, isFriend)
        setFolders(f)
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [userId, user, isMyProfile])

  // 폴더 오픈 핸들러
  const handleOpenFolder = async (f: Folder) => {
    setSelectedFolder(f)
    setItemsLoading(true)
    try {
      const items = await getSavedSummariesByFolder(userId, f.id)
      setFolderItems(items)
    } catch (e) {
      console.error(e)
    } finally {
      setItemsLoading(false)
    }
  }

  // 폴더 복제(Clone) 핸들러
  const handleCloneFolder = async () => {
    if (!user || !selectedFolder) return
    const newName = prompt('복제할 폴더 이름을 입력해주세요:', `${selectedFolder.name} (from ${profile?.displayName})`)
    if (!newName) return

    setCloning(true)
    try {
      await cloneFolder(
        selectedFolder.id,
        profile?.displayName || '익명',
        userId,
        newName,
        user.uid,
        { displayName: user.displayName || '익명', photoURL: user.photoURL || '' }
      )
      alert('폴더가 성공적으로 복제되었습니다! 마이페이지에서 확인해보세요.')
    } catch (e) {
      console.error(e)
      alert('복제 중 오류가 발생했습니다.')
    } finally {
      setCloning(false)
    }
  }

  // 개별 영상 저장 핸들러
  const handleSaveItem = async (item: SavedSummary) => {
    if (!user) { alert('로그인이 필요합니다.'); return }
    try {
      await saveSummary({
        ...item,
        userId: user.uid,
        userDisplayName: user.displayName || '익명',
        userPhotoURL: user.photoURL || '',
        folderId: 'all', // 기본 폴더
        isPublic: false,
        createdAt: null, // 서버에서 재생성
      })
      alert('나의 라이브러리에 저장되었습니다.')
    } catch (e) {
      console.error(e)
      alert('저장 실패')
    }
  }

  const handleFriendAction = async () => {
    if (!user) { alert('로그인이 필요합니다.'); return }
    setFriendLoading(true)
    try {
      if (friendStatus === 'none') {
        await sendFriendRequest(user.uid, user.displayName || '익명', user.photoURL || '', userId)
        setFriendStatus('pending_sent')
      } else if (friendStatus === 'pending_sent') {
        await cancelFriendRequest(user.uid, userId)
        setFriendStatus('none')
      } else if (friendStatus === 'pending_received') {
        await acceptFriendRequest(userId, user.uid)
        setFriendStatus('friends')
        // 폴더 목록 갱신 (권한에 맞게)
        const f = await getVisibleFolders(userId, true)
        setFolders(f)
      } else if (friendStatus === 'friends') {
        if (!confirm('친구를 삭제하시겠습니까?')) return
        await removeFriend(user.uid, userId)
        setFriendStatus('none')
        // 폴더 목록 갱신 (공개 전용으로)
        const f = await getVisibleFolders(userId, false)
        setFolders(f)
      }
    } catch (e: any) {
      console.error('[FriendAction Error]', e)
      alert(`오류가 발생했습니다: ${e.message || '잠시 후 다시 시도해주세요.'}`)
    } finally { setFriendLoading(false) }
  }

  const handleReject = async () => {
    if (!user) return
    setFriendLoading(true)
    try {
      await rejectFriendRequest(userId, user.uid)
      setFriendStatus('none')
    } catch (e: any) {
      console.error('[RejectFriend Error]', e)
      alert('오류가 발생했습니다.')
    } finally { setFriendLoading(false) }
  }

  const handleMessage = async () => {
    if (!user) { alert('로그인이 필요합니다.'); return }
    setMessaging(true)
    try {
      const cid = await getOrCreateConversation(
        user.uid,
        { displayName: user.displayName || '', photoURL: user.photoURL || '' },
        userId,
        { displayName: profile?.displayName || '익명', photoURL: profile?.photoURL || '' }
      )
      openChat(cid, { 
        uid: userId, 
        displayName: profile?.displayName || '익명', 
        photoURL: profile?.photoURL || '' 
      })
    } catch (e: any) {
      console.error('[MessageAction Error]', e)
      alert('오류가 발생했습니다.')
    } finally { setMessaging(false) }
  }

  const friendButtonConfig = {
    none:             { label: '친구 추가', icon: '➕', style: 'bg-orange-500 hover:bg-orange-600 text-white' },
    pending_sent:     { label: '요청됨', icon: '⏳', style: 'bg-[#32302e] border border-white/10 text-[#a4a09c]' },
    pending_received: { label: '수락하기', icon: '✅', style: 'bg-emerald-600 hover:bg-emerald-700 text-white' },
    friends:          { label: '친구', icon: '✓', style: 'bg-[#32302e] border border-orange-500/40 text-orange-400' },
  }[friendStatus]

  return (
    <div className="min-h-screen bg-[#252423] font-sans">
      <Header title="🎬 Next Curator" />
      <div className="max-w-2xl mx-auto px-4 pb-16">

        {loading ? (
          <div className="flex justify-center py-24">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-orange-500" />
          </div>
        ) : (
          <>
            {/* 프로필 카드 */}
            <div className="flex flex-col items-center gap-4 py-10">
              {profile?.photoURL ? (
                <img src={profile.photoURL} alt="" className="w-20 h-20 rounded-full border-2 border-white/10 shadow-xl" />
              ) : (
                <div className="w-20 h-20 rounded-full bg-[#32302e] flex items-center justify-center text-3xl">👤</div>
              )}

              <div className="text-center">
                <h1 className="text-xl font-bold text-white">{profile?.displayName || '익명'}</h1>
                <p className="text-[#75716e] text-sm mt-1">
                  공개된 폴더 {folders.length}개
                </p>
                {friendStatus === 'friends' && (
                  <span className="inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-400 border border-orange-500/30">
                    ✓ 친구
                  </span>
                )}
              </div>

              {/* 액션 버튼 */}
              {!isMyProfile && user && (
                <div className="flex items-center gap-2">
                  {/* 친구 요청 버튼 */}
                  <button
                    onClick={handleFriendAction}
                    disabled={friendLoading}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition-all disabled:opacity-50 ${friendButtonConfig.style}`}
                  >
                    <span>{friendButtonConfig.icon}</span>
                    <span>{friendLoading ? '...' : friendButtonConfig.label}</span>
                  </button>

                  {/* 받은 요청이면 거절 버튼도 표시 */}
                  {friendStatus === 'pending_received' && (
                    <button
                      onClick={handleReject}
                      disabled={friendLoading}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold bg-[#32302e] border border-white/10 text-[#a4a09c] hover:text-white transition-all disabled:opacity-50"
                    >
                      거절
                    </button>
                  )}

                  {/* 쪽지 */}
                  <button
                    onClick={handleMessage}
                    disabled={messaging}
                    className="flex items-center gap-1.5 px-4 py-2 bg-[#32302e] hover:bg-[#3d3a38] border border-white/10 rounded-full text-sm text-white transition-all disabled:opacity-50"
                  >
                    ✉️ {messaging ? '이동 중...' : '쪽지'}
                  </button>
                </div>
              )}
            </div>

            {/* 친구 큐레이션 안내 */}
            {friendStatus !== 'friends' && !isMyProfile && (
              <div className="mb-5 px-4 py-3 rounded-xl bg-[#32302e]/60 border border-white/5 text-center">
                <p className="text-[#75716e] text-xs">
                  {friendStatus === 'none'
                    ? '친구를 맺으면 이 유저의 전체 큐레이션을 볼 수 있어요'
                    : friendStatus === 'pending_sent'
                    ? '친구 요청을 보냈습니다. 수락되면 전체 큐레이션을 볼 수 있어요'
                    : '친구 요청을 수락하면 서로의 전체 큐레이션을 볼 수 있어요'}
                </p>
              </div>
            )}

            {/* 폴더 목록 그리드 */}
            {folders.length === 0 ? (
              <div className="text-center py-20 text-[#75716e]">
                공개된 폴더가 없습니다.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {folders.map(f => (
                  <button
                    key={f.id}
                    onClick={() => handleOpenFolder(f)}
                    className="group relative flex flex-col gap-3 p-4 rounded-3xl bg-[#32302e] border border-white/5 hover:border-orange-500/40 transition-all text-left"
                  >
                    <div className="w-full aspect-[4/3] rounded-2xl bg-[#252423] flex items-center justify-center text-4xl shadow-inner group-hover:scale-[1.02] transition-transform">
                      {f.clonedFrom ? '✨' : '📁'}
                    </div>
                    <div>
                      <h3 className="text-white font-bold truncate">{f.name}</h3>
                      <p className="text-[#75716e] text-xs mt-1">큐레이션 보기 →</p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Folder Modal */}
            {selectedFolder && (
              <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setSelectedFolder(null)} />
                <div className="relative w-full max-w-2xl max-h-[85vh] bg-[#252423] rounded-[32px] overflow-hidden flex flex-col shadow-2xl border border-white/10 slide-up">
                  {/* 모달 헤더 */}
                  <div className="flex items-center justify-between px-6 py-5 border-b border-white/5 bg-[#2a2826]">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl text-orange-500">📁</span>
                      <h2 className="text-xl font-bold text-white truncate max-w-[300px]">{selectedFolder.name}</h2>
                    </div>
                    <div className="flex items-center gap-3">
                      {!isMyProfile && user && (
                        <button
                          onClick={handleCloneFolder}
                          disabled={cloning}
                          className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-full transition-all disabled:opacity-50"
                        >
                          {cloning ? '복제 중...' : '✨ 폴더 전체 복제'}
                        </button>
                      )}
                      <button onClick={() => setSelectedFolder(null)} className="text-[#75716e] hover:text-white p-1">✕</button>
                    </div>
                  </div>

                  {/* 모달 바디 - 영상 목록 */}
                  <div className="flex-1 overflow-y-auto p-6">
                    {itemsLoading ? (
                      <div className="flex justify-center py-20">
                        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-orange-500" />
                      </div>
                    ) : folderItems.length === 0 ? (
                      <p className="text-center text-[#75716e] py-20">폴더가 비어있습니다.</p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {folderItems.map(item => (
                          <div key={item.id} className="group flex flex-col rounded-2xl bg-[#32302e] border border-white/5 overflow-hidden border-transparent hover:border-orange-500/30 transition-all">
                            <Link href={`/result/${item.sessionId}`} className="relative aspect-video overflow-hidden">
                              <img src={item.thumbnail} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                                <span className="text-white text-[10px] font-medium">내용 자세히 보기 →</span>
                              </div>
                            </Link>
                            <div className="p-3 space-y-2">
                              <p className="text-white text-xs font-bold line-clamp-2 leading-tight">{item.title}</p>
                              <button
                                onClick={() => handleSaveItem(item)}
                                className="w-full py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-[#a4a09c] hover:text-white text-[10px] font-medium transition-all"
                              >
                                내 라이브러리에 저장
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
