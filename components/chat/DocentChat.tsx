'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

interface ChatMsg {
  role: 'user' | 'model'
  content: string
  isQuote?: boolean   // 드래그 인용 메시지 표시
}

interface YoutubePlayerRef {
  getCurrentTime?: () => number
}

interface DocentChatProps {
  title: string
  category: string
  summaryData: unknown   // SummaryData JSON
  playerRef?: React.RefObject<YoutubePlayerRef | null>
  transcript?: string   // 원본 자막 전문
}

// 카테고리별 첫 질문 제안
const SUGGESTIONS: Record<string, string[]> = {
  recipe:  ['이 요리에서 가장 중요한 핵심 포인트가 뭐야?', '초보자가 실수하기 쉬운 부분이 있어?', '재료를 대체할 수 있는 게 있어?'],
  english: ['이 표현을 실생활에서 어떻게 써?', '비슷한 표현이랑 어떻게 달라?', '이 단어 더 쉽게 외우는 방법 있어?'],
  learning:['이 개념을 한 줄로 설명하면?', '실생활에서 이게 어디에 쓰여?', '관련된 개념을 더 알고 싶어'],
  news:    ['이 뉴스의 배경이 뭐야?', '앞으로 어떻게 전개될 것 같아?', '이 사건이 나한테 미치는 영향은?'],
  selfdev: ['이 내용 중 당장 실천할 수 있는 게 뭐야?', '핵심 메시지를 한 줄로 요약하면?', '비슷한 책이나 콘텐츠 추천해줘'],
  travel:  ['여기서 꼭 챙겨야 할 준비물이 뭐야?', '예산은 얼마나 잡아야 해?', '초보 여행자에게 주의할 점은?'],
  story:   ['결말의 의미가 뭐야?', '주인공이 왜 그런 선택을 했을까?', '이 작품의 핵심 메시지는?'],
  tips:    ['이 팁 중에 가장 효과적인 게 뭐야?', '어떤 준비물이 필요해?', '처음 해보는 사람도 바로 할 수 있어?'],
}

const DEFAULT_SUGGESTIONS = ['이 내용에서 가장 중요한 포인트가 뭐야?', '이해가 안 되는 부분을 설명해줘', '관련해서 더 알아볼 만한 내용이 있어?']

/** 초 → "M:SS" 포맷 */
function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

/**
 * transcript 전문에서 현재 시간 ±windowSec 범위 텍스트를 추출.
 * YouTube 자막 형식 "[M:SS]" 타임스탬프가 있으면 해당 구간을,
 * 없으면 전체 텍스트의 앞 1500자를 반환.
 */
function extractNearbyTranscript(transcript: string, currentSec: number, windowSec = 45): string {
  if (!transcript) return ''

  // "[0:12] 텍스트" 또는 "[1:23:45] 텍스트" 형식 파싱
  const lines = transcript.split('\n')
  const timestampPattern = /^\[(\d+):(\d{2})(?::(\d{2}))?\]\s*(.*)/

  const timed: { sec: number; text: string }[] = []
  let hasTimestamps = false

  for (const line of lines) {
    const m = line.match(timestampPattern)
    if (m) {
      hasTimestamps = true
      const sec = m[3]
        ? parseInt(m[1]) * 3600 + parseInt(m[2]) * 60 + parseInt(m[3])
        : parseInt(m[1]) * 60 + parseInt(m[2])
      timed.push({ sec, text: m[4] })
    }
  }

  if (!hasTimestamps || timed.length === 0) {
    // 타임스탬프 없는 plain text → 전체의 앞 1500자
    return transcript.slice(0, 1500)
  }

  const nearby = timed
    .filter(t => Math.abs(t.sec - currentSec) <= windowSec)
    .map(t => `[${fmtTime(t.sec)}] ${t.text}`)
    .join('\n')

  return nearby || timed.slice(0, 20).map(t => `[${fmtTime(t.sec)}] ${t.text}`).join('\n')
}

export default function DocentChat({ title, category, summaryData, playerRef, transcript = '' }: DocentChatProps) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectionPopup, setSelectionPopup] = useState<{ x: number; y: number; text: string } | null>(null)
  const cacheIdRef = useRef<string | undefined>(undefined)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const suggestions = SUGGESTIONS[category] ?? DEFAULT_SUGGESTIONS

  // 텍스트 선택 감지 → 팝업 표시
  const handleSelectionChange = useCallback(() => {
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed || sel.toString().trim().length < 5) {
      setSelectionPopup(null)
      return
    }
    const selectedText = sel.toString().trim()
    const range = sel.getRangeAt(0)
    const rect = range.getBoundingClientRect()
    setSelectionPopup({
      x: rect.left + rect.width / 2,
      y: rect.top + window.scrollY - 8,
      text: selectedText,
    })
  }, [])

  useEffect(() => {
    document.addEventListener('mouseup', handleSelectionChange)
    document.addEventListener('touchend', handleSelectionChange)
    return () => {
      document.removeEventListener('mouseup', handleSelectionChange)
      document.removeEventListener('touchend', handleSelectionChange)
    }
  }, [handleSelectionChange])

  // 패널 밖 클릭 시 선택 팝업 닫기
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && panelRef.current.contains(e.target as Node)) return
      // 선택 팝업 버튼 클릭이 아닐 때만 닫기
      const target = e.target as HTMLElement
      if (target.closest('[data-docent-popup]')) return
      setSelectionPopup(null)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (open) {
      setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
        inputRef.current?.focus()
      }, 150)
    }
  }, [open])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (text: string, isQuote = false) => {
    if (!text.trim() || loading) return
    setSelectionPopup(null)
    window.getSelection()?.removeAllRanges()

    const content = isQuote ? `> "${text}"\n\n이 부분이 궁금해요.` : text
    const userMsg: ChatMsg = { role: 'user', content, isQuote }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    if (!open) setOpen(true)

    // 현재 재생 위치 및 주변 자막 추출 (위치 참고용)
    const currentSec = playerRef?.current?.getCurrentTime?.() ?? null
    const nearbyTranscript = currentSec !== null
      ? extractNearbyTranscript(transcript, currentSec)
      : ''
    const positionHint = currentSec !== null
      ? `[현재 재생 위치: ${fmtTime(currentSec)}]`
      : ''

    try {
      const res = await fetch('/api/docent-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          summaryContext: JSON.stringify(summaryData),
          fullTranscript: transcript,
          title,
          category,
          positionHint,
          nearbyTranscript,
          cacheId: cacheIdRef.current,
        }),
      })
      const data = await res.json()
      if (data.cacheId) cacheIdRef.current = data.cacheId
      setMessages(prev => [...prev, {
        role: 'model',
        content: data.text ?? '오류가 발생했습니다.',
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  return (
    <>
      {/* 텍스트 선택 팝업 */}
      {selectionPopup && (
        <div
          data-docent-popup
          style={{
            position: 'absolute',
            left: selectionPopup.x,
            top: selectionPopup.y,
            transform: 'translate(-50%, -100%)',
            zIndex: 9999,
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1c1a18] border border-orange-500/50 rounded-full shadow-2xl whitespace-nowrap"
        >
          <span className="text-xs">🎓</span>
          <button
            onMouseDown={(e) => {
              e.preventDefault()
              sendMessage(selectionPopup.text, true)
            }}
            className="text-xs font-semibold text-orange-400 hover:text-orange-300 transition-colors"
          >
            AI 도슨트에게 질문
          </button>
        </div>
      )}

      {/* 플로팅 버튼 */}
      <button
        onClick={() => setOpen(v => !v)}
        className={`fixed bottom-6 right-6 z-50 shadow-2xl flex items-center justify-center transition-all hover:scale-105 active:scale-95 ${
          open
            ? 'w-14 h-14 rounded-full bg-[#3d3a38] text-white text-xl'
            : 'h-12 rounded-full bg-violet-600 hover:bg-violet-700 text-white px-4 gap-2'
        }`}
        title="AI 도슨트 — 이 내용의 전문 해설 AI"
      >
        {open ? (
          <span className="text-xl">✕</span>
        ) : (
          <>
            <span className="text-lg leading-none">🎓</span>
            <span className="text-sm font-bold whitespace-nowrap">AI 도슨트</span>
          </>
        )}
      </button>

      {/* 채팅 패널 */}
      {open && (
        <div
          ref={panelRef}
          className="fixed bottom-24 right-6 z-50 w-[calc(100vw-3rem)] max-w-[400px] h-[540px] bg-[#1c1a18] rounded-2xl flex flex-col shadow-2xl border border-violet-500/20 overflow-hidden"
        >
          {/* 헤더 */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 bg-[#23211f] shrink-0">
            <div className="w-9 h-9 rounded-full bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-base shrink-0">
              🎓
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-bold">AI 도슨트</p>
              <p className="text-violet-400/70 text-[11px] truncate">{title}</p>
            </div>
            {messages.length > 0 && (
              <button
                onClick={() => { setMessages([]); cacheIdRef.current = undefined }}
                className="text-[#75716e] hover:text-white text-xs px-2 py-1 rounded-lg hover:bg-white/5 transition-colors shrink-0"
              >
                초기화
              </button>
            )}
          </div>

          {/* 메시지 목록 */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && (
              <div className="space-y-3">
                {/* 도슨트 소개 + 사용 팁 */}
                <div className="bg-violet-600/10 border border-violet-500/20 rounded-xl px-3 py-3 space-y-1.5">
                  <p className="text-violet-300 text-xs font-semibold">이 콘텐츠의 전담 해설 AI예요.</p>
                  <p className="text-[#a4a09c] text-xs leading-relaxed">
                    내용이 궁금하거나 이해가 안 되는 부분을 물어보세요.<br/>
                    <span className="text-violet-400 font-medium">💡 팁: </span>
                    <span className="hidden md:inline">궁금한 부분을 <strong className="text-white">드래그</strong>하면 바로 질문할 수 있어요.</span>
                    <span className="md:hidden">궁금한 부분을 <strong className="text-white">길게 누른 후 복사</strong>하거나 직접 입력해보세요.</span>
                  </p>
                </div>

                {/* 빠른 질문 */}
                <p className="text-[#75716e] text-xs px-1">이런 것도 물어볼 수 있어요</p>
                <div className="space-y-1.5">
                  {suggestions.map(q => (
                    <button
                      key={q}
                      onClick={() => sendMessage(q)}
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
                <div className="max-w-[88%]">
                  {msg.role === 'model' && (
                    <p className="text-[10px] text-violet-400/60 mb-1 pl-1">🎓 AI 도슨트</p>
                  )}
                  <div className={`px-3 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-violet-600 text-white rounded-br-sm'
                      : 'bg-[#32302e] text-[#e8e4e0] rounded-bl-sm'
                  }`}>
                    {msg.content}
                  </div>
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="px-3 py-2 rounded-2xl rounded-bl-sm bg-[#32302e]">
                  <span className="inline-flex gap-1 items-center">
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce [animation-delay:0ms]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce [animation-delay:150ms]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce [animation-delay:300ms]" />
                  </span>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* 입력창 */}
          <div className="px-3 py-3 border-t border-white/10 bg-[#23211f] shrink-0">
            <div className="flex gap-2 items-end">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="궁금한 점을 물어보세요..."
                disabled={loading}
                rows={1}
                className="flex-1 min-h-[36px] max-h-[96px] px-3 py-2 bg-[#32302e] border border-white/10 rounded-xl text-sm text-white placeholder:text-[#75716e] focus:outline-none focus:border-violet-500/50 transition-colors disabled:opacity-60 resize-none"
                style={{ overflowY: 'auto' }}
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={loading || !input.trim()}
                className="w-9 h-9 rounded-xl bg-violet-600 hover:bg-violet-700 text-white flex items-center justify-center disabled:opacity-40 transition-colors shrink-0"
              >
                <svg className="w-4 h-4 rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
            <p className="text-[10px] text-[#4a4845] mt-1.5 text-center">Shift+Enter 줄바꿈 · Enter 전송</p>
          </div>
        </div>
      )}
    </>
  )
}
