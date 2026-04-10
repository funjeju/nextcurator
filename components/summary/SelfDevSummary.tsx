'use client'

import { SelfDevSummary as SelfDevSummaryType } from '@/types/summary'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Checkbox } from '@/components/ui/checkbox'
import TimestampBadge from './TimestampBadge'
import CopyButton from './CopyButton'
import CommentBubble from '@/components/comments/CommentBubble'

interface Props {
  data: SelfDevSummaryType
  onSeek: (ts: string) => void
  sessionId?: string
  commentCounts?: Record<string, number>
  onComment?: (segmentId: string, segmentLabel: string) => void
}

export default function SelfDevSummary({ data, onSeek, sessionId, commentCounts = {} }: Props) {
  const copyText = `핵심 메시지 [${data.core_message.timestamp}]:\n"${data.core_message.text}"\n\n주요 인사이트:\n${data.insights.map(i => `[${i.timestamp}] ${i.point}`).join('\n')}\n\n실천 체크리스트:\n${data.checklist.map(c => `□ ${c}`).join('\n')}\n\n명언:\n${data.quotes.map(q => `[${q.timestamp}] "${q.text}"`).join('\n')}`

  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-emerald-400 text-sm mb-1">💪 인사이트 카드</CardTitle>
        </div>
        <CopyButton text={copyText} />
      </CardHeader>
      <CardContent className="flex flex-col gap-6">

        {/* 핵심 메시지 */}
        <div id="seg-core-message" className="bg-zinc-800 rounded-lg p-4 border-l-4 border-emerald-500">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="text-emerald-400 text-sm font-semibold">💬 핵심 메시지</span>
            <TimestampBadge timestamp={data.core_message.timestamp} onSeek={onSeek} />
            {sessionId && (
              <CommentBubble sessionId={sessionId} segmentId="core-message" segmentLabel="핵심 메시지" initialCount={commentCounts['core-message'] ?? 0} />
            )}
          </div>
          <p className="text-zinc-100 text-lg font-medium leading-relaxed">&quot;{data.core_message.text}&quot;</p>
        </div>

        {/* 주요 인사이트 */}
        <div>
          <h3 className="text-zinc-300 font-semibold mb-3">주요 인사이트</h3>
          <div className="flex flex-col gap-3">
            {data.insights.map((insight, i) => {
              const segId = `insight-${i}`
              return (
                <div key={i} id={`seg-${segId}`} className="bg-zinc-800 rounded-lg p-3 flex flex-col gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <TimestampBadge timestamp={insight.timestamp} onSeek={onSeek} />
                    {sessionId && (
                      <CommentBubble sessionId={sessionId} segmentId={segId} segmentLabel={`인사이트 ${i + 1}`} initialCount={commentCounts[segId] ?? 0} />
                    )}
                  </div>
                  <p className="text-zinc-200 text-sm">{insight.point}</p>
                </div>
              )
            })}
          </div>
        </div>

        {/* 실천 체크리스트 */}
        {data.checklist.length > 0 && (
          <>
            <Separator className="bg-zinc-800" />
            <div>
              <h3 className="text-emerald-400 font-semibold mb-3">✅ 실천 체크리스트</h3>
              <div className="flex flex-col gap-2">
                {data.checklist.map((item, i) => {
                  const segId = `checklist-${i}`
                  return (
                    <div key={i} id={`seg-${segId}`} className="flex items-center gap-3">
                      <Checkbox id={`check-${i}`} className="border-zinc-600" />
                      <label htmlFor={`check-${i}`} className="text-zinc-300 text-sm cursor-pointer flex-1">{item}</label>
                      {sessionId && (
                        <CommentBubble sessionId={sessionId} segmentId={segId} segmentLabel={`체크리스트 - ${item.slice(0, 20)}`} initialCount={commentCounts[segId] ?? 0} />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )}

        {/* 명언 */}
        {data.quotes.length > 0 && (
          <>
            <Separator className="bg-zinc-800" />
            <div>
              <h3 className="text-zinc-300 font-semibold mb-3">명언 / 인용</h3>
              {data.quotes.map((quote, i) => {
                const segId = `quote-${i}`
                return (
                  <div key={i} id={`seg-${segId}`} className="flex items-start gap-3 mt-2">
                    <TimestampBadge timestamp={quote.timestamp} onSeek={onSeek} />
                    <p className="text-zinc-300 text-sm italic flex-1">&quot;{quote.text}&quot;</p>
                    {sessionId && (
                      <CommentBubble sessionId={sessionId} segmentId={segId} segmentLabel={`명언 ${i + 1}`} initialCount={commentCounts[segId] ?? 0} />
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
