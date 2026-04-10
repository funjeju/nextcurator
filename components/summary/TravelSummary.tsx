'use client'

import { TravelSummary as TravelSummaryType } from '@/types/summary'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import TimestampBadge from './TimestampBadge'
import CopyButton from './CopyButton'
import CommentBubble from '@/components/comments/CommentBubble'

interface Props {
  data: TravelSummaryType
  onSeek: (ts: string) => void
  sessionId?: string
  commentCounts?: Record<string, number>
  onComment?: (segmentId: string, segmentLabel: string) => void
}

export default function TravelSummary({ data, onSeek, sessionId, commentCounts = {} }: Props) {
  const copyText = `${data.destination}\n\n방문지:\n${data.places.map(p => `[${p.timestamp}] ${p.name}\n${p.desc}${p.price ? `\n가격: ${p.price}` : ''}${p.tip ? `\n팁: ${p.tip}` : ''}`).join('\n\n')}\n\n추천 동선: ${data.route}\n\n실용 정보:\n${data.practical_info.map(i => `• ${i}`).join('\n')}\n\n주의사항:\n${data.warnings.map(w => `⚠️ ${w}`).join('\n')}`

  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-cyan-400 text-sm mb-1">🧳 여행 가이드 카드</CardTitle>
          <h2 className="text-xl font-bold text-zinc-100">{data.destination}</h2>
        </div>
        <CopyButton text={copyText} />
      </CardHeader>
      <CardContent className="flex flex-col gap-6">

        {/* 방문지 */}
        <div>
          <h3 className="text-zinc-300 font-semibold mb-3">📍 방문지 리스트</h3>
          <div className="flex flex-col gap-3">
            {data.places.map((place, i) => {
              const segId = `place-${i}`
              return (
                <div key={i} id={`seg-${segId}`} className="bg-zinc-800 rounded-lg p-3 flex flex-col gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <TimestampBadge timestamp={place.timestamp} onSeek={onSeek} />
                    <span className="text-cyan-300 font-medium text-sm">{place.name}</span>
                    {place.price && <span className="text-zinc-400 text-xs">{place.price}</span>}
                    {sessionId && (
                      <CommentBubble sessionId={sessionId} segmentId={segId} segmentLabel={`방문지 - ${place.name}`} initialCount={commentCounts[segId] ?? 0} />
                    )}
                  </div>
                  <p className="text-zinc-300 text-sm">{place.desc}</p>
                  {place.tip && <p className="text-amber-400 text-xs">💡 {place.tip}</p>}
                </div>
              )
            })}
          </div>
        </div>

        <Separator className="bg-zinc-800" />

        {/* 추천 동선 */}
        <div id="seg-route">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-zinc-300 font-semibold">🗺️ 추천 동선</h3>
            {sessionId && (
              <CommentBubble sessionId={sessionId} segmentId="route" segmentLabel="추천 동선" initialCount={commentCounts['route'] ?? 0} />
            )}
          </div>
          <p className="text-zinc-300 text-sm">{data.route}</p>
        </div>

        {/* 실용 정보 */}
        {data.practical_info.length > 0 && (
          <>
            <Separator className="bg-zinc-800" />
            <div>
              <h3 className="text-zinc-300 font-semibold mb-2">실용 정보</h3>
              <ul className="flex flex-col gap-1">
                {data.practical_info.map((info, i) => {
                  const segId = `practical-${i}`
                  return (
                    <li key={i} id={`seg-${segId}`} className="flex items-start gap-2">
                      <span className="text-zinc-300 text-sm flex-1">• {info}</span>
                      {sessionId && (
                        <CommentBubble sessionId={sessionId} segmentId={segId} segmentLabel={`실용 정보 ${i + 1}`} initialCount={commentCounts[segId] ?? 0} />
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          </>
        )}

        {/* 주의사항 */}
        {data.warnings.length > 0 && (
          <>
            <Separator className="bg-zinc-800" />
            <div>
              <h3 className="text-amber-400 font-semibold mb-2">⚠️ 주의사항</h3>
              <ul className="flex flex-col gap-1">
                {data.warnings.map((warning, i) => {
                  const segId = `warning-${i}`
                  return (
                    <li key={i} id={`seg-${segId}`} className="flex items-start gap-2">
                      <span className="text-amber-300 text-sm flex-1">• {warning}</span>
                      {sessionId && (
                        <CommentBubble sessionId={sessionId} segmentId={segId} segmentLabel={`주의사항 ${i + 1}`} initialCount={commentCounts[segId] ?? 0} />
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
