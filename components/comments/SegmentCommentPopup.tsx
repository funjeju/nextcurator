'use client'

import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/providers/AuthProvider'
import { getCommentsBySession, addComment } from '@/lib/comments'
import type { Comment } from '@/lib/comments'

interface Props {
  sessionId: string
  segmentId: string
  segmentLabel: string
  onClose: () => void
  onCommentAdded: () => void
}

export default function SegmentCommentPopup({ sessionId, segmentId, segmentLabel, onClose, onCommentAdded }: Props) {
  const { user } = useAuth()
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    getCommentsBySession(sessionId)
      .then(all => setComments(all.filter(c => c.segmentId === segmentId && !c.parentId)))
      .catch(() => {})
      .finally(() => setLoading(false))
    // focus input on open
    setTimeout(() => inputRef.current?.focus(), 80)
  }, [sessionId, segmentId])

  const handleSubmit = async () => {
    if (!text.trim() || !user) return
    setSubmitting(true)
    try {
      const newComment = await addComment({
        sessionId,
        segmentId,
        segmentLabel,
        parentId: null,
        userId: user.uid,
        userDisplayName: user.displayName || '익명',
        userPhotoURL: user.photoURL || '',
        text: text.trim(),
      })
      setComments(prev => [...prev, newComment])
      setText('')
      onCommentAdded()
    } catch {
      alert('댓글 작성에 실패했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm bg-[#23211f] border border-white/10 rounded-2xl shadow-2xl flex flex-col max-h-[80vh]">

        {/* 헤더 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
          <p className="text-xs text-[#75716e] font-medium truncate max-w-[220px]">
            💬 {segmentLabel}
          </p>
          <button onClick={onClose} className="text-[#75716e] hover:text-white text-lg leading-none ml-2">×</button>
        </div>

        {/* 댓글 목록 */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-[60px]">
          {loading ? (
            <p className="text-xs text-[#75716e] text-center py-2">불러오는 중...</p>
          ) : comments.length === 0 ? (
            <p className="text-xs text-[#75716e] text-center py-3">내용 없음</p>
          ) : (
            comments.map(c => (
              <div key={c.id} className="flex gap-2 items-start">
                {c.userPhotoURL ? (
                  <img src={c.userPhotoURL} alt="" className="w-6 h-6 rounded-full shrink-0 mt-0.5 border border-white/10" />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-zinc-700 shrink-0 mt-0.5 flex items-center justify-center text-[10px] text-zinc-300">
                    {(c.userDisplayName || '?')[0]}
                  </div>
                )}
                <div className="flex-1 bg-[#2a2826] rounded-xl px-3 py-2">
                  <p className="text-[11px] text-[#a4a09c] font-medium mb-0.5">{c.userDisplayName}</p>
                  <p className="text-sm text-[#e2e2e2] leading-snug whitespace-pre-wrap">{c.text}</p>
                </div>
              </div>
            ))
          )}
        </div>

        {/* 입력 영역 */}
        <div className="px-4 py-3 border-t border-white/8">
          {user ? (
            <div className="flex gap-2 items-end">
              <textarea
                ref={inputRef}
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="댓글 작성... (Enter로 전송)"
                rows={2}
                className="flex-1 bg-[#32302e] border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-[#75716e] resize-none outline-none focus:border-orange-500/40 transition-colors"
              />
              <button
                onClick={handleSubmit}
                disabled={!text.trim() || submitting}
                className="h-10 px-3 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white text-xs font-bold rounded-xl transition-colors shrink-0"
              >
                {submitting ? '...' : '전송'}
              </button>
            </div>
          ) : (
            <p className="text-xs text-[#75716e] text-center py-1">로그인 후 댓글 작성 가능합니다.</p>
          )}
        </div>
      </div>
    </div>
  )
}
