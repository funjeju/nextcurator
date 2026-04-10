'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Header from '@/components/common/Header'
import {
  getUserProfile, getUserPublicSummaries, getAllSavedSummariesByUser,
  getOrCreateConversation, sendFriendRequest, getFriendStatus,
  acceptFriendRequest, rejectFriendRequest, cancelFriendRequest, removeFriend,
  UserProfile, SavedSummary,
} from '@/lib/db'
import { useAuth } from '@/providers/AuthProvider'
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
  const router = useRouter()

  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [summaries, setSummaries] = useState<SavedSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [friendStatus, setFriendStatus] = useState<FriendStatus>('none')
  const [friendLoading, setFriendLoading] = useState(false)
  const [messaging, setMessaging] = useState(false)

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

        // 친구면 전체 큐레이션, 아니면 공개만
        const isFriend = status === 'friends'
        const s = isFriend
          ? await getAllSavedSummariesByUser(userId)
          : await getUserPublicSummaries(userId)
        setSummaries(s)
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [userId, user, isMyProfile])

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
        // 전체 큐레이션으로 갱신
        const s = await getAllSavedSummariesByUser(userId)
        setSummaries(s)
      } else if (friendStatus === 'friends') {
        if (!confirm('친구를 삭제하시겠습니까?')) return
        await removeFriend(user.uid, userId)
        setFriendStatus('none')
        // 공개 요약만으로 갱신
        const s = await getUserPublicSummaries(userId)
        setSummaries(s)
      }
    } catch { alert('오류가 발생했습니다.') }
    finally { setFriendLoading(false) }
  }

  const handleReject = async () => {
    if (!user) return
    setFriendLoading(true)
    try {
      await rejectFriendRequest(userId, user.uid)
      setFriendStatus('none')
    } catch { alert('오류가 발생했습니다.') }
    finally { setFriendLoading(false) }
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
      router.push(`/messages/${cid}`)
    } catch { alert('오류가 발생했습니다.') }
    finally { setMessaging(false) }
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
                  {friendStatus === 'friends' ? `큐레이션 ${summaries.length}개` : `공개 요약 ${summaries.length}개`}
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

            {/* 요약 목록 */}
            {summaries.length === 0 ? (
              <div className="text-center py-16 text-[#75716e]">
                {friendStatus === 'friends' ? '저장된 큐레이션이 없습니다.' : '공개된 요약이 없습니다.'}
              </div>
            ) : (
              <>
                {friendStatus === 'friends' && (
                  <p className="text-[10px] text-[#75716e] mb-3 px-1">전체 큐레이션 — 비공개 포함</p>
                )}
                <div className="columns-2 gap-3 space-y-3">
                  {summaries.map(item => (
                    <Link
                      key={item.id}
                      href={`/result/${item.sessionId}`}
                      className="break-inside-avoid block rounded-[18px] bg-[#32302e] border border-white/5 overflow-hidden hover:border-white/20 transition-all"
                    >
                      <div className="relative overflow-hidden bg-[#23211f]">
                        <img src={item.thumbnail} alt={item.title} className="w-full object-cover aspect-video" />
                        <div className="absolute top-2 right-2 flex items-center gap-1">
                          {!item.isPublic && (
                            <span className="px-1.5 py-0.5 rounded-full bg-black/70 text-[8px] text-white/50">🔒</span>
                          )}
                          <span className="px-2 py-0.5 rounded-full bg-black/60 text-[9px] font-bold text-white">
                            {CATEGORY_LABEL[item.category] ?? '분석됨'}
                          </span>
                        </div>
                      </div>
                      <div className="p-2.5">
                        <p className="text-[#f4f4f5] text-[11px] font-bold leading-snug line-clamp-2 mb-1">{item.title}</p>
                        <div className="flex items-center gap-2 text-[#75716e] text-[9px]">
                          {item.createdAt && <span>{formatRelativeDate(item.createdAt)}</span>}
                          <span>❤️ {item.likeCount ?? 0}</span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
