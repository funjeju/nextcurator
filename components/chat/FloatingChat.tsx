'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { SavedSummary } from '@/lib/db'

interface ChatMsg {
  role: 'user' | 'model'
  content: string
  relatedIds?: string[]
}

interface FloatingChatProps {
  summaries: SavedSummary[]
  source: 'mypage' | 'square'
}

const CATEGORY_LABEL: Record<string, string> = {
  recipe: '🍳 요리', english: '🔤 영어', learning: '📐 학습', news: '🗞️ 뉴스',
  selfdev: '💪 자기계발', travel: '🧳 여행', story: '🍿 스토리', tips: '💡 팁',
}

const QUICK_QUESTIONS: Record<'mypage' | 'square', string[]> = {
  mypage: ['저번에 저장한 요리 영상 있어?', '학습 관련 저장한 거 보여줘', '최근에 뭐 저장했어?'],
  square: ['초보자용 영어 콘텐츠 추천해줘', '최근 올라온 팁 영상 뭐 있어?', '요리 영상 인기 있는 거 뭐야?'],
}

export default function FloatingChat({ summaries, source }: FloatingChatProps) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const contextLabel = source === 'mypage' ? '내 라이브러리' : '스퀘어'

  useEffect(() => {
    if (open) {
      setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
        inputRef.current?.focus()
      }, 100)
    }
  }, [open])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const getSummaryById = (id: string) =>
    summaries.find(s => s.id === id || s.sessionId === id)

  const handleSend = async (text?: string) => {
    const query = (text ?? input).trim()
    if (!query || loading) return

    const userMsg: ChatMsg = { role: 'user', content: query }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    try {
      const payload = summaries.slice(0, 100).map(s => ({
        id: s.id,
        title: s.title,
        category: s.category,
        channel: s.channel,
        summary: s.summary,
        tags: s.square_meta?.tags ?? [],
      }))

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          summaries: payload,
          source,
        }),
      })

      const data = await res.json()
      setMessages(prev => [...prev, {
        role: 'model',
        content: data.text ?? '오류가 발생했습니다.',
        relatedIds: data.relatedIds ?? [],
      }])
    } catch {
      setMessages(prev => [...prev, {
        role: 'model',
        content: '죄송해요, 오류가 발생했어요. 다시 시도해 주세요.',
      }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* 플로팅 버튼 */}
      <button
        onClick={() => setOpen(v => !v)}
        className={`fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-2xl flex items-center justify-center text-xl transition-all hover:scale-110 active:scale-95 ${
          open ? 'bg-[#3d3a38] text-white' : 'bg-orange-500 hover:bg-orange-600 text-white'
        }`}
        title={`${contextLabel} AI 어시스턴트`}
      >
        {open ? '✕' : '💬'}
      </button>

      {/* 채팅 패널 */}
      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-[calc(100vw-3rem)] max-w-[380px] h-[500px] bg-[#1c1a18] rounded-2xl flex flex-col shadow-2xl border border-white/10 overflow-hidden">

          {/* 헤더 */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 bg-[#23211f] shrink-0">
            <div className="w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center text-sm">💬</div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-semibold">AI 어시스턴트</p>
              <p className="text-[#75716e] text-[11px]">{contextLabel} · {summaries.length}개 콘텐츠</p>
            </div>
            {messages.length > 0 && (
              <button
                onClick={() => setMessages([])}
                className="text-[#75716e] hover:text-white text-xs px-2 py-1 rounded-lg hover:bg-white/5 transition-colors"
              >
                초기화
              </button>
            )}
          </div>

          {/* 메시지 목록 */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && (
              <div className="space-y-3">
                <p className="text-[#75716e] text-sm text-center pt-2">
                  {contextLabel}에 대해 무엇이든 물어보세요.
                </p>
                <div className="space-y-1.5">
                  {QUICK_QUESTIONS[source].map(q => (
                    <button
                      key={q}
                      onClick={() => handleSend(q)}
                      className="w-full text-left text-xs px-3 py-2.5 rounded-xl bg-[#32302e] text-[#a4a09c] hover:text-white hover:bg-[#3d3a38] transition-colors border border-white/5"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className="max-w-[88%] space-y-1.5">
                  <div className={`px-3 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-orange-500 text-white rounded-br-sm'
                      : 'bg-[#32302e] text-[#e8e4e0] rounded-bl-sm'
                  }`}>
                    {msg.content}
                  </div>

                  {/* 관련 콘텐츠 카드 */}
                  {msg.relatedIds && msg.relatedIds.length > 0 && (
                    <div className="space-y-1">
                      {msg.relatedIds.map(id => {
                        const item = getSummaryById(id)
                        if (!item) return null
                        return (
                          <Link
                            key={id}
                            href={`/result/${item.sessionId}`}
                            className="flex items-center gap-2 px-2.5 py-2 rounded-xl bg-[#2a2826] border border-white/5 hover:border-orange-500/40 transition-colors group"
                          >
                            {item.thumbnail ? (
                              <img
                                src={item.thumbnail}
                                alt=""
                                className="w-12 h-8 object-cover rounded-md shrink-0 bg-[#32302e]"
                              />
                            ) : (
                              <div className="w-12 h-8 rounded-md bg-[#32302e] shrink-0 flex items-center justify-center text-base">
                                {item.category === 'pdf' ? '📄' : '🌐'}
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="text-white text-xs font-medium truncate group-hover:text-orange-400 transition-colors">
                                {item.title}
                              </p>
                              <p className="text-[#75716e] text-[10px]">
                                {CATEGORY_LABEL[item.category] ?? item.category}
                              </p>
                            </div>
                          </Link>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="px-3 py-2 rounded-2xl rounded-bl-sm bg-[#32302e] text-[#75716e] text-sm">
                  <span className="inline-flex gap-1 items-center">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#75716e] animate-bounce [animation-delay:0ms]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-[#75716e] animate-bounce [animation-delay:150ms]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-[#75716e] animate-bounce [animation-delay:300ms]" />
                  </span>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* 입력창 */}
          <div className="px-3 py-3 border-t border-white/10 bg-[#23211f] shrink-0">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
                placeholder={`${contextLabel}에서 찾아보기...`}
                disabled={loading}
                className="flex-1 h-9 px-3 bg-[#32302e] border border-white/10 rounded-xl text-sm text-white placeholder:text-[#75716e] focus:outline-none focus:border-orange-500/50 transition-colors disabled:opacity-60"
              />
              <button
                onClick={() => handleSend()}
                disabled={loading || !input.trim()}
                className="w-9 h-9 rounded-xl bg-orange-500 hover:bg-orange-600 text-white flex items-center justify-center disabled:opacity-40 transition-colors shrink-0"
              >
                <svg className="w-4 h-4 rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
