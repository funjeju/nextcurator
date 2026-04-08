'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Header from '@/components/common/Header'
import { getMessages, sendMessage, markConversationRead, getConversations, Message, Conversation } from '@/lib/db'
import { useAuth } from '@/providers/AuthProvider'

export default function ConversationPage() {
  const { cid } = useParams<{ cid: string }>()
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [messages, setMessages] = useState<Message[]>([])
  const [convo, setConvo] = useState<Conversation | null>(null)
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (authLoading) return
    if (!user) { router.push('/'); return }

    Promise.all([getMessages(cid), getConversations(user.uid)])
      .then(([msgs, convos]) => {
        setMessages(msgs)
        setConvo(convos.find(c => c.id === cid) ?? null)
        markConversationRead(cid, user.uid).catch(() => {})
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [cid, user, authLoading, router])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const otherId = convo?.participants.find(p => p !== user?.uid) ?? ''
  const other = convo?.participantProfiles?.[otherId]

  const handleSend = async () => {
    if (!text.trim() || !user || sending) return
    setSending(true)
    const optimistic: Message = {
      id: Date.now().toString(),
      senderId: user.uid,
      text: text.trim(),
      createdAt: null,
      read: false,
    }
    setMessages(prev => [...prev, optimistic])
    setText('')
    try {
      await sendMessage(cid, user.uid, optimistic.text, otherId)
    } catch {
      setMessages(prev => prev.filter(m => m.id !== optimistic.id))
      setText(optimistic.text)
      alert('전송에 실패했습니다.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#252423] font-sans flex flex-col">
      <Header title="🎬 Next Curator" />

      {/* 상대방 정보 */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5 bg-[#252423]">
        <button onClick={() => router.back()} className="text-[#a4a09c] hover:text-white mr-1">←</button>
        {other?.photoURL ? (
          <img src={other.photoURL} alt="" className="w-8 h-8 rounded-full border border-white/10" />
        ) : (
          <div className="w-8 h-8 rounded-full bg-[#32302e] flex items-center justify-center">👤</div>
        )}
        <span className="text-white font-semibold text-sm">{other?.displayName || '익명'}</span>
      </div>

      {/* 메시지 목록 */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-orange-500" />
          </div>
        ) : messages.length === 0 ? (
          <p className="text-center text-[#75716e] text-sm py-10">첫 메시지를 보내보세요!</p>
        ) : (
          messages.map(msg => {
            const isMine = msg.senderId === user?.uid
            return (
              <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                  isMine
                    ? 'bg-orange-500 text-white rounded-br-sm'
                    : 'bg-[#32302e] text-[#e2e2e2] rounded-bl-sm border border-white/5'
                }`}>
                  {msg.text}
                </div>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* 입력창 */}
      <div className="px-4 py-3 border-t border-white/5 flex gap-2 bg-[#252423]">
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
          placeholder="메시지 입력..."
          className="flex-1 bg-[#32302e] border border-white/10 rounded-full px-4 py-2.5 text-sm text-white placeholder:text-[#75716e] outline-none focus:border-orange-500/50"
        />
        <button
          onClick={handleSend}
          disabled={!text.trim() || sending}
          className="bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white rounded-full w-10 h-10 flex items-center justify-center transition-colors shrink-0"
        >
          ↑
        </button>
      </div>
    </div>
  )
}
