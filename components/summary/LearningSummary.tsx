'use client'

import { LearningSummary as LearningSummaryType } from '@/types/summary'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import TimestampBadge from './TimestampBadge'
import CopyButton from './CopyButton'
import CommentBubble from '@/components/comments/CommentBubble'

interface Props {
  data: LearningSummaryType
  onSeek: (ts: string) => void
  sessionId?: string
  commentCounts?: Record<string, number>
  onComment?: (segmentId: string, segmentLabel: string) => void
}

export default function LearningSummary({ data, onSeek, sessionId, commentCounts = {} }: Props) {
  const copyText = `${data.subject}\n\n핵심 개념:\n${data.concepts.map(c => `[${c.timestamp}] ${c.name}: ${c.desc}`).join('\n')}\n\n핵심 포인트:\n${data.key_points.map(p => `[${p.timestamp}] • ${p.point}`).join('\n')}\n\n예시:\n${data.examples.map(e => `[${e.timestamp}] ${e.desc}`).join('\n')}`

  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-violet-400 text-sm mb-1">📐 학습 정리 카드</CardTitle>
          <h2 className="text-xl font-bold text-zinc-100">{data.subject}</h2>
        </div>
        <CopyButton text={copyText} />
      </CardHeader>
      <CardContent className="flex flex-col gap-6">

        {/* 핵심 개념 */}
        <div>
          <h3 className="text-zinc-300 font-semibold mb-3">핵심 개념</h3>
          <div className="flex flex-col gap-3">
            {data.concepts.map((concept, i) => {
              const segId = `concept-${i}`
              return (
                <div key={i} id={`seg-${segId}`} className="bg-zinc-800 rounded-lg p-3 flex flex-col gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <TimestampBadge timestamp={concept.timestamp} onSeek={onSeek} />
                    <span className="text-violet-300 font-medium text-sm">{concept.name}</span>
                    {sessionId && (
                      <CommentBubble sessionId={sessionId} segmentId={segId} segmentLabel={`개념 - ${concept.name}`} initialCount={commentCounts[segId] ?? 0} />
                    )}
                  </div>
                  <p className="text-zinc-300 text-sm">{concept.desc}</p>
                </div>
              )
            })}
          </div>
        </div>

        <Separator className="bg-zinc-800" />

        {/* 핵심 포인트 */}
        <div>
          <h3 className="text-zinc-300 font-semibold mb-3">핵심 포인트</h3>
          <div className="flex flex-col gap-2">
            {data.key_points.map((kp, i) => {
              const segId = `keypoint-${i}`
              return (
                <div key={i} id={`seg-${segId}`} className="flex items-start gap-3">
                  <TimestampBadge timestamp={kp.timestamp} onSeek={onSeek} />
                  <p className="text-zinc-200 text-sm flex-1">• {kp.point}</p>
                  {sessionId && (
                    <CommentBubble sessionId={sessionId} segmentId={segId} segmentLabel={`핵심 포인트 ${i + 1}`} initialCount={commentCounts[segId] ?? 0} />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* 예시 */}
        {data.examples.length > 0 && (
          <>
            <Separator className="bg-zinc-800" />
            <div>
              <h3 className="text-zinc-300 font-semibold mb-3">영상 내 예시</h3>
              <div className="flex flex-col gap-2">
                {data.examples.map((ex, i) => {
                  const segId = `example-${i}`
                  return (
                    <div key={i} id={`seg-${segId}`} className="flex items-start gap-3">
                      <TimestampBadge timestamp={ex.timestamp} onSeek={onSeek} />
                      <p className="text-zinc-300 text-sm flex-1">{ex.desc}</p>
                      {sessionId && (
                        <CommentBubble sessionId={sessionId} segmentId={segId} segmentLabel={`예시 ${i + 1}`} initialCount={commentCounts[segId] ?? 0} />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
