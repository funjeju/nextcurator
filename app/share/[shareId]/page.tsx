'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import Header from '@/components/common/Header'
import { getSharedFolder, copySharedFolder, SharedFolder } from '@/lib/db'
import { getLocalUserId } from '@/lib/user'
import { useAuth } from '@/providers/AuthProvider'

const CATEGORY_LABEL: Record<string, string> = {
  recipe: '🍳 요리', english: '🔤 영어', learning: '📐 학습', news: '🗞️ 뉴스',
  selfdev: '💪 자기계발', travel: '🧳 여행', story: '🍿 스토리', tips: '💡 팁',
}

export default function SharePage() {
  const { shareId } = useParams<{ shareId: string }>()
  const router = useRouter()
  const { user } = useAuth()
  const [shared, setShared] = useState<SharedFolder | null>(null)
  const [loading, setLoading] = useState(true)
  const [copying, setCopying] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    getSharedFolder(shareId)
      .then(data => {
        if (!data) setError('공유 폴더를 찾을 수 없습니다.')
        else setShared(data)
      })
      .catch(() => setError('불러오기에 실패했습니다.'))
      .finally(() => setLoading(false))
  }, [shareId])

  const handleCopy = async () => {
    if (copying || done) return
    setCopying(true)
    try {
      const uid = user?.uid || getLocalUserId()
      const displayName = user?.displayName || '익명'
      const photoURL = user?.photoURL || ''
      await copySharedFolder(shareId, uid, displayName, photoURL)
      setDone(true)
    } catch (e) {
      alert((e as Error).message || '복사에 실패했습니다.')
    } finally {
      setCopying(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#252423] font-sans">
      <Header title="공유 폴더" />
      <div className="max-w-2xl mx-auto px-4 py-10">

        {loading && (
          <div className="flex justify-center py-24">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-orange-500" />
          </div>
        )}

        {error && (
          <div className="text-center py-24">
            <p className="text-3xl mb-4">😢</p>
            <p className="text-white font-bold mb-2">{error}</p>
            <Link href="/" className="text-orange-400 text-sm underline">홈으로</Link>
          </div>
        )}

        {shared && !error && (
          <div className="space-y-6">
            {/* 폴더 헤더 */}
            <div className="bg-[#32302e] rounded-[24px] border border-white/10 p-6">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-2xl bg-orange-500/20 flex items-center justify-center text-2xl shrink-0">
                  📁
                </div>
                <div className="flex-1 min-w-0">
                  <h1 className="text-xl font-bold text-white truncate">{shared.folderName}</h1>
                  <div className="flex items-center gap-2 mt-1.5">
                    {shared.ownerPhotoURL ? (
                      <img src={shared.ownerPhotoURL} alt="" className="w-5 h-5 rounded-full border border-white/10" />
                    ) : (
                      <div className="w-5 h-5 rounded-full bg-[#3d3a38] flex items-center justify-center text-[9px]">👤</div>
                    )}
                    <span className="text-[#a4a09c] text-sm">{shared.ownerName}님이 공유한 폴더</span>
                  </div>
                  <p className="text-[#75716e] text-xs mt-1">영상 {shared.items.length}개</p>
                </div>
              </div>

              {/* 복사 버튼 */}
              <div className="mt-5">
                {done ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="flex items-center gap-2 text-emerald-400 font-bold">
                      <span>✅</span>
                      <span>내 라이브러리에 추가됐어요!</span>
                    </div>
                    <button
                      onClick={() => router.push('/mypage')}
                      className="px-6 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm transition-colors"
                    >
                      마이페이지에서 확인하기 →
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleCopy}
                    disabled={copying}
                    className="w-full py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {copying ? (
                      <>
                        <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                        복사 중...
                      </>
                    ) : (
                      '📥 내 라이브러리에 추가하기'
                    )}
                  </button>
                )}
                {!user && (
                  <p className="text-[#75716e] text-xs text-center mt-2">
                    비로그인 상태로 추가하면 로그인 후 기기가 달라질 때 보이지 않을 수 있어요
                  </p>
                )}
              </div>
            </div>

            {/* 영상 목록 */}
            <div className="space-y-2">
              <p className="text-[#75716e] text-xs px-1">포함된 영상</p>
              {shared.items.map((item, i) => (
                <div
                  key={item.sessionId}
                  className="flex items-center gap-3 bg-[#32302e] rounded-2xl border border-white/5 p-3 hover:border-white/15 transition-colors"
                >
                  <span className="text-[#75716e] text-xs w-5 text-right shrink-0">{i + 1}</span>
                  {item.thumbnail ? (
                    <img src={item.thumbnail} alt="" className="w-16 h-10 object-cover rounded-lg shrink-0 bg-[#23211f]" />
                  ) : (
                    <div className="w-16 h-10 rounded-lg bg-[#23211f] shrink-0 flex items-center justify-center text-lg">📄</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-xs font-medium line-clamp-1">{item.title}</p>
                    <p className="text-[#75716e] text-[10px] mt-0.5 flex items-center gap-1">
                      <span>{CATEGORY_LABEL[item.category] ?? item.category}</span>
                      {item.channel && <><span>·</span><span className="truncate">{item.channel}</span></>}
                    </p>
                    {item.contextSummary && (
                      <p className="text-[#75716e] text-[9px] mt-1 line-clamp-2 leading-relaxed">{item.contextSummary}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
