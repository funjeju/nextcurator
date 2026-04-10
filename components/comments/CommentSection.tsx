'use client'

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/providers/AuthProvider'
import { Comment, addComment, deleteComment, getCommentsBySession } from '@/lib/comments'
import { formatRelativeDate } from '@/lib/formatDate'

interface Props {
  sessionId: string
  focusSegmentId: string | null
  focusSegmentLabel: string | null
  onClearFocus: () => void
  onCountChange?: (count: number) => void
}

export default function CommentSection({
  sessionId,
  focusSegmentId,
  focusSegmentLabel,
  onClearFocus,
  onCountChange,
}: Props) {
  const { user } = useAuth()
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [replyTo, setReplyTo] = useState<{ id: string; userName: string } | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const sectionRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    getCommentsBySession(sessionId)
      .then(data => {
        setComments(data)
        onCountChange?.(data.filter(c => !c.parentId).length)
      })
      .finally(() => setLoading(false))
  }, [sessionId])

  // 세그먼트 포커스 시 스크롤 + 인풋 포커스
  useEffect(() => {
    if (focusSegmentId) {
      sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      setTimeout(() => textareaRef.current?.focus(), 400)
    }
  }, [focusSegmentId])

  const topLevel = comments.filter(c => !c.parentId)
  const getReplies = (parentId: string) => comments.filter(c => c.parentId === parentId)

  const handleSubmit = async () => {
    if (!text.trim() || !user) return
    setSubmitting(true)
    try {
      const newComment = await addComment({
        sessionId,
        segmentId: replyTo ? null : focusSegmentId,
        segmentLabel: replyTo ? null : focusSegmentLabel,
        parentId: replyTo?.id ?? null,
        userId: user.uid,
        userDisplayName: user.displayName || '익명',
        userPhotoURL: user.photoURL || '',
        text: text.trim(),
      })
      const updated = [...comments, newComment]
      setComments(updated)
      onCountChange?.(updated.filter(c => !c.parentId).length)
      setText('')
      setReplyTo(null)
      onClearFocus()
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (commentId: string) => {
    if (!confirm('댓글을 삭제하시겠습니까?')) return
    await deleteComment(commentId)
    const updated = comments.filter(c => c.id !== commentId && c.parentId !== commentId)
    setComments(updated)
    onCountChange?.(updated.filter(c => !c.parentId).length)
  }

  const scrollToSegment = (segmentId: string) => {
    const el = document.getElementById(`seg-${segmentId}`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    // 잠깐 하이라이트 효과
    if (el) {
      el.classList.add('ring-2', 'ring-orange-400', 'ring-offset-1', 'ring-offset-transparent')
      setTimeout(() => el.classList.remove('ring-2', 'ring-orange-400', 'ring-offset-1', 'ring-offset-transparent'), 2000)
    }
  }

  return (
    <div ref={sectionRef} className="bg-[#2a2826] rounded-2xl border border-white/5 p-5 flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          💬 토론
          <span className="text-sm text-[#75716e] font-normal">{topLevel.length}개</span>
        </h3>
        <span className="text-[10px] text-[#75716e] bg-[#32302e] px-2 py-1 rounded-full">단락 댓글은 요약 내 말풍선에서</span>
      </div>

      {/* 입력폼 */}
      {user ? (
        <div className="flex flex-col gap-2">
          {(focusSegmentLabel || replyTo) && (
            <div className="flex items-center gap-2 flex-wrap">
              {focusSegmentLabel && !replyTo && (
                <span className="text-xs bg-orange-500/20 text-orange-300 border border-orange-500/30 px-2 py-0.5 rounded-full">
                  📌 {focusSegmentLabel}
                </span>
              )}
              {replyTo && (
                <span className="text-xs bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded-full">
                  ↩️ @{replyTo.userName}에 답글
                </span>
              )}
              <button
                onClick={() => { setReplyTo(null); onClearFocus() }}
                className="text-[#75716e] text-xs hover:text-white transition-colors"
              >✕</button>
            </div>
          )}
          <div className="flex gap-2 items-end">
            <textarea
              ref={textareaRef}
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit() } }}
              placeholder={replyTo ? '답글을 입력하세요...' : focusSegmentLabel ? `"${focusSegmentLabel}"에 대한 댓글...` : '댓글을 입력하세요...'}
              rows={2}
              className="flex-1 bg-[#23211f] border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-[#75716e] resize-none focus:outline-none focus:border-orange-500/50 transition-colors"
            />
            <button
              onClick={handleSubmit}
              disabled={!text.trim() || submitting}
              className="px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-xl disabled:opacity-40 transition-colors whitespace-nowrap"
            >
              {submitting ? '...' : '등록'}
            </button>
          </div>
        </div>
      ) : (
        <p className="text-[#75716e] text-sm">로그인하면 댓글을 남길 수 있습니다.</p>
      )}

      {/* 댓글 목록 */}
      {loading ? (
        <div className="flex justify-center py-6">
          <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : topLevel.length === 0 ? (
        <p className="text-[#75716e] text-sm text-center py-4">첫 번째 댓글을 남겨보세요!</p>
      ) : (
        <div className="flex flex-col divide-y divide-white/5">
          {topLevel.map(comment => (
            <CommentItem
              key={comment.id}
              comment={comment}
              replies={getReplies(comment.id)}
              currentUserId={user?.uid ?? null}
              onReply={c => {
                setReplyTo({ id: c.id, userName: c.userDisplayName })
                setTimeout(() => textareaRef.current?.focus(), 100)
              }}
              onDelete={handleDelete}
              onScrollToSegment={scrollToSegment}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────
// 댓글 아이템 (대댓글 포함)
// ─────────────────────────────
interface CommentItemProps {
  comment: Comment
  replies: Comment[]
  currentUserId: string | null
  onReply: (c: Comment) => void
  onDelete: (id: string) => void
  onScrollToSegment: (segmentId: string) => void
}

function CommentItem({ comment, replies, currentUserId, onReply, onDelete, onScrollToSegment }: CommentItemProps) {
  return (
    <div className="py-3 flex flex-col gap-2">
      <div className="flex gap-2.5">
        <Avatar src={comment.userPhotoURL} size={28} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-xs font-bold text-white">{comment.userDisplayName}</span>
            <span className="text-[10px] text-[#75716e]">{formatRelativeDate(comment.createdAt)}</span>
            {comment.segmentId && comment.segmentLabel && (
              <button
                onClick={() => onScrollToSegment(comment.segmentId!)}
                className="text-[10px] bg-orange-500/20 text-orange-300 border border-orange-500/30 px-1.5 py-0.5 rounded-full hover:bg-orange-500/30 transition-colors"
              >
                📌 {comment.segmentLabel}
              </button>
            )}
          </div>
          <p className="text-[#e2e2e2] text-sm leading-relaxed break-words">{comment.text}</p>
          <div className="flex items-center gap-3 mt-1.5">
            <button onClick={() => onReply(comment)} className="text-[10px] text-[#75716e] hover:text-white transition-colors">
              ↩️ 답글
            </button>
            {currentUserId === comment.userId && (
              <button onClick={() => onDelete(comment.id)} className="text-[10px] text-[#75716e] hover:text-red-400 transition-colors">
                삭제
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 대댓글 */}
      {replies.length > 0 && (
        <div className="ml-9 flex flex-col gap-2 border-l-2 border-white/5 pl-3 mt-1">
          {replies.map(reply => (
            <div key={reply.id} className="flex gap-2">
              <Avatar src={reply.userPhotoURL} size={20} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[11px] font-bold text-white">{reply.userDisplayName}</span>
                  <span className="text-[9px] text-[#75716e]">{formatRelativeDate(reply.createdAt)}</span>
                </div>
                <p className="text-[#d4d4d8] text-xs leading-relaxed break-words">{reply.text}</p>
                {currentUserId === reply.userId && (
                  <button onClick={() => onDelete(reply.id)} className="text-[9px] text-[#75716e] hover:text-red-400 mt-0.5 transition-colors">
                    삭제
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Avatar({ src, size }: { src: string; size: number }) {
  const style = { width: size, height: size }
  if (src) return <img src={src} alt="" style={style} className="rounded-full shrink-0 border border-white/10" />
  return (
    <div style={style} className="rounded-full bg-[#3d3a38] shrink-0 flex items-center justify-center text-[10px] text-white/40">
      👤
    </div>
  )
}
