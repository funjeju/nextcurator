'use client'

import { useState, useEffect, useRef } from 'react'
import { useChat } from '@/providers/ChatProvider'
import { useAuth } from '@/providers/AuthProvider'
import { sendMessage, subscribeMessages, Message } from '@/lib/db'

export default function FloatingChatWindow() {
  const { chat, closeChat } = useChat()
  const { user } = useAuth()
  const [messages, setMessages] = useState<Message[]>([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [minimized, setMinimized] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!chat.isOpen || !chat.conversationId) {
      setMessages([])
      return
    }

    // 실시간 리스너 구독
    const unsubscribe = subscribeMessages(chat.conversationId, (msgs) => {
      setMessages(msgs)
    })

    return () => unsubscribe()
  }, [chat.isOpen, chat.conversationId])

  useEffect(() => {
    if (!minimized) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, minimized])

  const handleSend = async () => {
    if (!text.trim() || !user || !chat.conversationId || !chat.otherUser || sending) return
    setSending(true)
    const t = text.trim()
    setText('')
    try {
      await sendMessage(chat.conversationId, user.uid, t, chat.otherUser.uid)
    } catch (e) {
      console.error(e)
      alert('전송 실패')
      setText(t)
    } finally {
      setSending(false)
    }
  }

  if (!chat.isOpen || !chat.otherUser) return null

  return (
    <div 
      className={`fixed bottom-0 right-6 z-[100] w-80 bg-[#1c1a18] border border-white/10 rounded-t-2xl shadow-2xl transition-all duration-300 transform ${
        minimized ? 'h-14 translate-y-0' : 'h-[450px] translate-y-0'
      }`}
    >
      {/* 헤더 */}
      <div 
        className="flex items-center justify-between px-4 h-14 border-b border-white/5 bg-[#2a2826] rounded-t-2xl cursor-pointer"
        onClick={() => setMinimized(!minimized)}
      >
        <div className="flex items-center gap-2">
          {chat.otherUser.photoURL ? (
            <img src={chat.otherUser.photoURL} alt="" className="w-8 h-8 rounded-full border border-white/10" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-[#32302e] flex items-center justify-center text-xs">👤</div>
          )}
          <span className="text-white text-sm font-bold truncate max-w-[120px]">{chat.otherUser.displayName}</span>
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        </div>
        <div className="flex items-center gap-1">
          <button className="p-1.5 text-[#75716e] hover:text-white" onClick={(e) => { e.stopPropagation(); setMinimized(!minimized) }}>
            {minimized ? '△' : '▽'}
          </button>
          <button className="p-1.5 text-[#75716e] hover:text-white" onClick={(e) => { e.stopPropagation(); closeChat() }}>
            ✕
          </button>
        </div>
      </div>

      {!minimized && (
        <>
          {/* 메시지 영역 */}
          <div className="flex-1 h-[calc(450px-112px)] overflow-y-auto p-4 space-y-3 scrollbar-message">
            {messages.length === 0 ? (
              <p className="text-center text-[#75716e] text-[11px] py-10 opacity-50">첫 인사로 대화를 시작해보세요! 👋</p>
            ) : (
              messages.map(msg => {
                const isMine = msg.senderId === user?.uid
                return (
                  <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-[13px] leading-relaxed break-words shadow-sm ${
                      isMine 
                        ? 'bg-orange-500 text-white rounded-br-sm' 
                        : 'bg-[#32302e] text-[#e2e2e2] rounded-bl-sm'
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
          <div className="p-3 border-t border-white/5 bg-[#252423]">
            <div className="flex gap-2 items-center bg-[#32302e] rounded-2xl px-3 py-1.5 border border-white/5 focus-within:border-orange-500/40 transition-all">
              <input
                type="text"
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                placeholder="메시지 입력..."
                className="flex-1 bg-transparent border-none text-white text-sm outline-none placeholder:text-[#75716e]"
              />
              <button 
                onClick={handleSend}
                disabled={!text.trim() || sending}
                className="text-orange-500 hover:text-orange-400 disabled:opacity-30 transition-colors p-1"
              >
                <svg className="w-5 h-5 rotate-90" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                </svg>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
