'use client'

interface Props {
  segmentId: string
  segmentLabel: string
  count: number
  onComment: (segmentId: string, segmentLabel: string) => void
}

export default function CommentBubble({ segmentId, segmentLabel, count, onComment }: Props) {
  return (
    <button
      onClick={() => onComment(segmentId, segmentLabel)}
      className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium transition-all bg-white/5 text-[#75716e] hover:bg-orange-500/15 hover:text-orange-300 border border-transparent hover:border-orange-500/20"
      title={`"${segmentLabel}" 에 댓글 달기`}
    >
      <span>💬</span>
      {count > 0 && <span>{count}</span>}
    </button>
  )
}
