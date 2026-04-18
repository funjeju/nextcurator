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
  onCommentPosted?: (text: string, segmentId: string | null) => void
  summaryData?: unknown
  title?: string
  category?: string
}

export default function CommentSection({
  sessionId,
  focusSegmentId,
  focusSegmentLabel,
  onClearFocus,
  onCountChange,
  onCommentPosted,
  summaryData,
  title = '',
  category = '',
}: Props) {
  const { user } = useAuth()
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [replyTo, setReplyTo] = useState<{ id: string; userName: string } | null>(null)
  const [aiLoadingId, setAiLoadingId] = useState<string | null>(null)
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

  useEffect(() => {
    const handler = (e: Event) => {
      const comment = (e as CustomEvent<Comment>).detail
      if (comment.sessionId !== sessionId) return
      setComments(prev => {
        if (prev.some(c => c.id === comment.id)) return prev
        const updated = [...prev, comment]
        onCountChange?.(updated.filter(c => !c.parentId).length)
        return updated
      })
    }
    window.addEventListener('segment-comment-added', handler)
    return () => window.removeEventListener('segment-comment-added', handler)
  }, [sessionId, onCountChange])

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
        isAI: false,
      })
      const updated = [...comments, newComment]
      setComments(updated)
      onCountChange?.(updated.filter(c => !c.parentId).length)
      onCommentPosted?.(text.trim(), replyTo ? null : focusSegmentId)
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

  // 댓글 or 대댓글에 AI가 반응
  const handleAIReply = async (targetComment: Comment, allRepliesInThread: Comment[]) => {
    setAiLoadingId(targetComment.id)
    try {
      const thread = allRepliesInThread.map(r => ({
        role: r.isAI ? 'ai' as const : 'user' as const,
        text: r.text,
        userName: r.userDisplayName,
      }))
      const parentComment = targetComment.parentId
        ? comments.find(c => c.id === targetComment.parentId)
        : null
      const contextThread = parentComment
        ? [{ role: 'user' as const, text: parentComment.text, userName: parentComment.userDisplayName }, ...thread]
        : thread

      const parentId = targetComment.parentId ?? targetComment.id

      const res = await fetch('/api/ai-comment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          commentText: targetComment.text,
          threadContext: contextThread,
          summaryContext: summaryData ? JSON.stringify(summaryData) : '',
          title,
          category,
          sessionId,
          parentId,
        }),
      })
      const data = await res.json()
      if (!data.comment) throw new Error(data.error ?? 'AI 응답 실패')

      // 서버에서 저장 완료된 댓글 객체를 상태에 추가 (클라이언트 Firestore 쓰기 없음)
      setComments(prev => [...prev, data.comment as Comment])
    } catch (e) {
      console.error('[AI Reply]', e)
    } finally {
      setAiLoadingId(null)
    }
  }

  const scrollToSegment = (segmentId: string) => {
    const el = document.getElementById(`seg-${segmentId}`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    if (el) {
      el.classList.add('ring-2', 'ring-orange-400', 'ring-offset-1', 'ring-offset-transparent')
      setTimeout(() => el.classList.remove('ring-2', 'ring-orange-400', 'ring-offset-1', 'ring-offset-transparent'), 2000)
    }
  }

  return (
    <div ref={sectionRef} className="bg-[#2a2826] rounded-2xl border border-white/5 p-5 flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          💬 댓글
          <span className="text-sm text-[#75716e] font-normal">{topLevel.length}개</span>
        </h3>
        <span className="text-[10px] text-[#75716e] bg-[#32302e] px-2 py-1 rounded-full">📌 단락명 클릭 시 해당 위치로 이동</span>
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
              aiLoadingId={aiLoadingId}
              onReply={c => {
                setReplyTo({ id: c.id, userName: c.userDisplayName })
                setTimeout(() => textareaRef.current?.focus(), 100)
              }}
              onDelete={handleDelete}
              onScrollToSegment={scrollToSegment}
              onAIReply={handleAIReply}
              allComments={comments}
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
  aiLoadingId: string | null
  onReply: (c: Comment) => void
  onDelete: (id: string) => void
  onScrollToSegment: (segmentId: string) => void
  onAIReply: (target: Comment, thread: Comment[]) => void
  allComments: Comment[]
}

function CommentItem({ comment, replies, currentUserId, aiLoadingId, onReply, onDelete, onScrollToSegment, onAIReply, allComments }: CommentItemProps) {
  return (
    <div className="py-3 flex flex-col gap-2">
      <div className="flex gap-2.5">
        <Avatar src={comment.userPhotoURL} size={28} isAI={comment.isAI} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-xs font-bold text-white">{comment.userDisplayName}</span>
            {comment.isAI && (
              <span className="text-[9px] bg-violet-600/30 text-violet-300 border border-violet-500/30 px-1.5 py-0.5 rounded-full">🤖 AI</span>
            )}
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
            {!comment.isAI && (
              <button onClick={() => onReply(comment)} className="text-[10px] text-[#75716e] hover:text-white transition-colors">
                ↩️ 답글
              </button>
            )}
            {!comment.isAI && (
              <AIReplyButton
                commentId={comment.id}
                aiLoadingId={aiLoadingId}
                onClick={() => onAIReply(comment, replies)}
              />
            )}
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
        <div className="ml-9 flex flex-col gap-3 border-l-2 border-white/5 pl-3 mt-1">
          {replies.map(reply => (
            <div key={reply.id} className="flex gap-2">
              <Avatar src={reply.userPhotoURL} size={20} isAI={reply.isAI} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                  <span className="text-[11px] font-bold text-white">{reply.userDisplayName}</span>
                  {reply.isAI && (
                    <span className="text-[9px] bg-violet-600/30 text-violet-300 border border-violet-500/30 px-1.5 py-0.5 rounded-full">🤖 AI</span>
                  )}
                  <span className="text-[9px] text-[#75716e]">{formatRelativeDate(reply.createdAt)}</span>
                </div>
                <p className="text-[#d4d4d8] text-xs leading-relaxed break-words">{reply.text}</p>
                <div className="flex items-center gap-3 mt-1">
                  {!reply.isAI && (
                    <AIReplyButton
                      commentId={reply.id}
                      aiLoadingId={aiLoadingId}
                      onClick={() => {
                        const thread = allComments.filter(c => c.parentId === comment.id)
                        onAIReply(reply, thread)
                      }}
                    />
                  )}
                  {currentUserId === reply.userId && (
                    <button onClick={() => onDelete(reply.id)} className="text-[9px] text-[#75716e] hover:text-red-400 mt-0.5 transition-colors">
                      삭제
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function AIReplyButton({ commentId, aiLoadingId, onClick }: {
  commentId: string
  aiLoadingId: string | null
  onClick: () => void
}) {
  const isLoading = aiLoadingId === commentId
  return (
    <button
      onClick={onClick}
      disabled={aiLoadingId !== null}
      className="text-[10px] text-violet-400 hover:text-violet-300 disabled:opacity-40 transition-colors flex items-center gap-1"
    >
      {isLoading ? (
        <>
          <span className="inline-flex gap-0.5">
            <span className="w-1 h-1 rounded-full bg-violet-400 animate-bounce [animation-delay:0ms]" />
            <span className="w-1 h-1 rounded-full bg-violet-400 animate-bounce [animation-delay:150ms]" />
            <span className="w-1 h-1 rounded-full bg-violet-400 animate-bounce [animation-delay:300ms]" />
          </span>
          AI 생각중...
        </>
      ) : (
        <>🤖 AI 반응</>
      )}
    </button>
  )
}

function Avatar({ src, size, isAI }: { src: string; size: number; isAI?: boolean }) {
  const style = { width: size, height: size }
  if (isAI) return (
    <div style={style} className="rounded-full bg-violet-600/30 border border-violet-500/40 shrink-0 flex items-center justify-center text-[10px]">
      🤖
    </div>
  )
  if (src) return <img src={src} alt="" style={style} className="rounded-full shrink-0 border border-white/10" />
  return (
    <div style={style} className="rounded-full bg-[#3d3a38] shrink-0 flex items-center justify-center text-[10px] text-white/40">
      👤
    </div>
  )
}
