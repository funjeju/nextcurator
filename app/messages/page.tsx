'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Header from '@/components/common/Header'
import { getConversations, Conversation } from '@/lib/db'
import { useAuth } from '@/providers/AuthProvider'
import { formatRelativeDate } from '@/lib/formatDate'

export default function MessagesPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (authLoading) return
    if (!user) { router.push('/'); return }
    getConversations(user.uid)
      .then(setConversations)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [user, authLoading, router])

  return (
    <div className="min-h-screen bg-[#252423] font-sans">
      <Header title="🎬 Next Curator" />
      <div className="max-w-lg mx-auto px-4 pb-16">
        <h1 className="text-xl font-bold text-white mb-6">✉️ 쪽지함</h1>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-orange-500" />
          </div>
        ) : conversations.length === 0 ? (
          <div className="text-center py-20 text-[#75716e]">쪽지가 없습니다.</div>
        ) : (
          <div className="flex flex-col gap-2">
            {conversations.map(convo => {
              const otherId = convo.participants.find(p => p !== user!.uid) ?? ''
              const other = convo.participantProfiles?.[otherId]
              const unread = convo.unread?.[user!.uid] ?? 0
              return (
                <Link
                  key={convo.id}
                  href={`/messages/${convo.id}`}
                  className="flex items-center gap-3 p-4 bg-[#32302e] rounded-2xl border border-white/5 hover:border-white/20 transition-all"
                >
                  {other?.photoURL ? (
                    <img src={other.photoURL} alt="" className="w-10 h-10 rounded-full shrink-0 border border-white/10" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-[#3d3a38] shrink-0 flex items-center justify-center text-lg">👤</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-semibold">{other?.displayName || '익명'}</p>
                    <p className="text-[#75716e] text-xs truncate">{convo.lastMessage || '대화를 시작해보세요'}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {convo.lastAt && <span className="text-[9px] text-[#75716e]">{formatRelativeDate(convo.lastAt)}</span>}
                    {unread > 0 && (
                      <span className="bg-orange-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">{unread}</span>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
