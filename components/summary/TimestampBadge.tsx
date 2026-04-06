'use client'

import { Badge } from '@/components/ui/badge'

interface TimestampBadgeProps {
  timestamp: string
  onSeek: (ts: string) => void
}

export default function TimestampBadge({ timestamp, onSeek }: TimestampBadgeProps) {
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
