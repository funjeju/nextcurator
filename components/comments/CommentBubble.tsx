'use client'

import { useState } from 'react'
import SegmentCommentPopup from './SegmentCommentPopup'

interface Props {
  sessionId: string
  segmentId: string
  segmentLabel: string
  initialCount: number
}

export default function CommentBubble({ sessionId, segmentId, segmentLabel, initialCount }: Props) {
  const [open, setOpen] = useState(false)
  const [count, setCount] = useState(initialCount)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium transition-all border ${
          count > 0
            ? 'bg-orange-500/10 border-orange-500/25 text-orange-300 hover:bg-orange-500/20'
            : 'bg-white/5 border-transparent text-[#75716e] hover:bg-orange-500/10 hover:text-orange-300 hover:border-orange-500/20'
        }`}
        title={`"${segmentLabel}" 에 댓글 달기`}
      >
        <span>💬</span>
        <span className="font-bold">{count}</span>
      </button>

      {open && (
        <SegmentCommentPopup
          sessionId={sessionId}
          segmentId={segmentId}
          segmentLabel={segmentLabel}
          onClose={() => setOpen(false)}
          onCommentAdded={() => setCount(c => c + 1)}
        />
      )}
    </>
  )
}
