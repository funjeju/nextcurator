'use client'

import { Badge } from '@/components/ui/badge'

interface TimestampBadgeProps {
  timestamp: string
  onSeek: (ts: string) => void
}

export default function TimestampBadge({ timestamp, onSeek }: TimestampBadgeProps) {
  // 빈 문자열이거나 "00:00"이면 PDF/웹 소스 → 숨김
  if (!timestamp || timestamp === '00:00') return null

  return (
    <Badge
      variant="outline"
      className="cursor-pointer font-mono text-xs border-zinc-600 text-blue-400 hover:bg-blue-500 hover:text-white hover:border-blue-500 transition-colors"
      onClick={() => onSeek(timestamp)}
    >
      ▶ {timestamp}
    </Badge>
  )
}
