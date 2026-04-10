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
        className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium transition-all bg-white/5 hover:bg-orange-500/15 hover:text-orange-300 border border-transparent hover:border-orange-500/20 text-[#75716e]"
        title={`"${segmentLabel}" 에 댓글 달기`}
      >
        <span>💬</span>
        {count > 0 && <span className="font-bold">{count}</span>}
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
