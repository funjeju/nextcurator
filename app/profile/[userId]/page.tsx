'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Header from '@/components/common/Header'
import { getUserProfile, getUserPublicSummaries, getOrCreateConversation, UserProfile, SavedSummary } from '@/lib/db'
import { useAuth } from '@/providers/AuthProvider'
import { formatRelativeDate } from '@/lib/formatDate'

const CATEGORY_LABEL: Record<string, string> = {
  recipe: '🍳 요리', english: '🔤 영어', learning: '📐 학습',
  news: '🗞️ 뉴스', selfdev: '💪 자기계발', travel: '🧳 여행', story: '🍿 스토리',
}

export default function ProfilePage() {
  const { userId } = useParams<{ userId: string }>()
  const { user } = useAuth()
  const router = useRouter()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [summaries, setSummaries] = useState<SavedSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [messaging, setMessaging] = useState(false)

  useEffect(() => {
    Promise.all([getUserProfile(userId), getUserPublicSummaries(userId)])
      .then(([p, s]) => { setProfile(p); setSummaries(s) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [userId])

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

  const isMyProfile = user?.uid === userId

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
                <p className="text-[#75716e] text-sm mt-1">공개 요약 {summaries.length}개</p>
              </div>

              {!isMyProfile && user && (
                <button
                  onClick={handleMessage}
                  disabled={messaging}
                  className="flex items-center gap-2 px-5 py-2 bg-[#32302e] hover:bg-[#3d3a38] border border-white/10 rounded-full text-sm text-white transition-all disabled:opacity-50"
                >
                  ✉️ {messaging ? '이동 중...' : '쪽지 보내기'}
                </button>
              )}
            </div>

            {/* 공개 요약 목록 */}
            {summaries.length === 0 ? (
              <div className="text-center py-16 text-[#75716e]">공개된 요약이 없습니다.</div>
            ) : (
              <div className="columns-2 gap-3 space-y-3">
                {summaries.map(item => (
                  <Link
                    key={item.id}
                    href={`/result/${item.sessionId}`}
                    className="break-inside-avoid block rounded-[18px] bg-[#32302e] border border-white/5 overflow-hidden hover:border-white/20 transition-all"
                  >
                    <div className="relative overflow-hidden bg-[#23211f]">
                      <img src={item.thumbnail} alt={item.title} className="w-full object-cover aspect-video" />
                      <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-black/60 text-[9px] font-bold text-white">
                        {CATEGORY_LABEL[item.category] ?? '분석됨'}
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
            )}
          </>
        )}
      </div>
    </div>
  )
}
