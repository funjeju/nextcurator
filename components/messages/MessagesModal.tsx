'use client'

import { useEffect, useState } from 'react'
import { getConversations, Conversation } from '@/lib/db'
import { useAuth } from '@/providers/AuthProvider'
import { useChat } from '@/providers/ChatProvider'
import { formatRelativeDate } from '@/lib/formatDate'

interface Props {
  onClose: () => void
}

export default function MessagesModal({ onClose }: Props) {
  const { user } = useAuth()
  const { openChat } = useChat()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    getConversations(user.uid)
      .then(setConversations)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [user])

  const handleOpen = (convo: Conversation) => {
    const otherId = convo.participants.find(p => p !== user!.uid) ?? ''
    const other = convo.participantProfiles?.[otherId]
    openChat(convo.id, {
      uid: otherId,
      displayName: other?.displayName || '익명',
      photoURL: other?.photoURL || '',
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-end">
      {/* backdrop */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* panel — top-right, below header */}
      <div className="relative mt-14 mr-4 w-80 max-h-[80vh] bg-[#252423] rounded-2xl border border-white/10 shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-[#2a2826] shrink-0">
          <h2 className="text-sm font-bold text-white">✉️ 쪽지함</h2>
          <button onClick={onClose} className="text-[#75716e] hover:text-white transition-colors text-lg leading-none">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-10">
              <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-orange-500" />
            </div>
          ) : conversations.length === 0 ? (
            <p className="text-center text-[#75716e] text-sm py-10">쪽지가 없습니다.</p>
          ) : (
            <div className="flex flex-col divide-y divide-white/5">
              {conversations.map(convo => {
                const otherId = convo.participants.find(p => p !== user!.uid) ?? ''
                const other = convo.participantProfiles?.[otherId]
                const unread = convo.unread?.[user!.uid] ?? 0
                return (
                  <button
                    key={convo.id}
                    onClick={() => handleOpen(convo)}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left w-full"
                  >
                    {other?.photoURL ? (
                      <img src={other.photoURL} alt="" className="w-9 h-9 rounded-full shrink-0 border border-white/10" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-[#32302e] shrink-0 flex items-center justify-center text-base">👤</div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-xs font-semibold">{other?.displayName || '익명'}</p>
                      <p className="text-[#75716e] text-[11px] truncate">{convo.lastMessage || '대화를 시작해보세요'}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {convo.lastAt && (
                        <span className="text-[9px] text-[#75716e]">{formatRelativeDate(convo.lastAt)}</span>
                      )}
                      {unread > 0 && (
                        <span className="bg-orange-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                          {unread > 9 ? '9+' : unread}
                        </span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
