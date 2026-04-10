'use client'

import { TipsSummary as TipsSummaryType } from '@/types/summary'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import TimestampBadge from './TimestampBadge'
import CopyButton from './CopyButton'
import CommentBubble from '@/components/comments/CommentBubble'

interface Props {
  data: TipsSummaryType
  onSeek: (ts: string) => void
  sessionId?: string
  commentCounts?: Record<string, number>
  onComment?: (segmentId: string, segmentLabel: string) => void
}

const DIFFICULTY_STYLE: Record<string, string> = {
  '쉬움': 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  '보통': 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  '어려움': 'bg-red-500/15 text-red-400 border-red-500/30',
}

export default function TipsSummary({ data, onSeek, sessionId, commentCounts = {} }: Props) {
  const copyText = `[${data.topic}]\n\n핵심 메시지: ${data.key_message}\n\n팁 목록:\n${data.tips.map(t => `${t.number}. ${t.title} — ${t.desc}`).join('\n')}\n\n바로 적용할 Top 3:\n${data.top3.map((t, i) => `${i + 1}. ${t}`).join('\n')}${data.tools.length > 0 ? `\n\n준비물: ${data.tools.join(', ')}` : ''}`

  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-yellow-400 text-sm mb-1">💡 팁 카드</CardTitle>
          <p className="text-zinc-400 text-xs">{data.topic}</p>
        </div>
        <CopyButton text={copyText} />
      </CardHeader>
      <CardContent className="flex flex-col gap-6">

        {/* 핵심 메시지 */}
        <div id="seg-key-message" className="bg-zinc-800 rounded-lg p-4 border-l-4 border-yellow-500">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="text-yellow-400 text-sm font-semibold">💬 핵심 메시지</span>
            {sessionId && (
              <CommentBubble sessionId={sessionId} segmentId="key-message" segmentLabel="핵심 메시지" initialCount={commentCounts['key-message'] ?? 0} />
            )}
          </div>
          <p className="text-zinc-100 text-base font-medium leading-relaxed">&quot;{data.key_message}&quot;</p>
        </div>

        {/* 팁 카드 목록 */}
        <div>
          <h3 className="text-zinc-300 font-semibold mb-3">팁 {data.tips.length}가지</h3>
          <div className="flex flex-col gap-3">
            {data.tips.map((tip) => {
              const segId = `tip-${tip.number}`
              const diffStyle = tip.difficulty ? (DIFFICULTY_STYLE[tip.difficulty] ?? DIFFICULTY_STYLE['보통']) : null
              return (
                <div key={tip.number} id={`seg-${segId}`} className="bg-zinc-800 rounded-xl p-4 flex gap-3">
                  {/* 번호 배지 */}
                  <div className="shrink-0 w-7 h-7 rounded-full bg-yellow-500/20 border border-yellow-500/40 flex items-center justify-center">
                    <span className="text-yellow-400 text-xs font-bold">{tip.number}</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <span className="text-zinc-100 text-sm font-semibold">{tip.title}</span>
                      {diffStyle && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${diffStyle}`}>
                          {tip.difficulty}
                        </span>
                      )}
                      <TimestampBadge timestamp={tip.timestamp} onSeek={onSeek} />
                      {sessionId && (
                        <CommentBubble sessionId={sessionId} segmentId={segId} segmentLabel={`팁 ${tip.number}: ${tip.title}`} initialCount={commentCounts[segId] ?? 0} />
                      )}
                    </div>
                    <p className="text-zinc-400 text-sm leading-relaxed">{tip.desc}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <Separator className="bg-zinc-800" />

        {/* 바로 적용할 Top 3 */}
        {data.top3.length > 0 && (
          <div id="seg-top3">
            <div className="flex items-center gap-2 mb-3">
              <h3 className="text-yellow-400 font-semibold">⭐ 바로 적용할 Top 3</h3>
              {sessionId && (
                <CommentBubble sessionId={sessionId} segmentId="top3" segmentLabel="Top 3" initialCount={commentCounts['top3'] ?? 0} />
              )}
            </div>
            <div className="flex flex-col gap-2">
              {data.top3.map((item, i) => (
                <div key={i} className="flex items-start gap-3 bg-zinc-800/60 rounded-lg px-3 py-2.5">
                  <span className="shrink-0 text-yellow-400 font-bold text-sm w-4">{i + 1}</span>
                  <p className="text-zinc-200 text-sm">{item}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 준비물/도구 */}
        {data.tools.length > 0 && (
          <>
            <Separator className="bg-zinc-800" />
            <div>
              <h3 className="text-zinc-300 font-semibold mb-3">🛠️ 준비물 / 도구</h3>
              <div className="flex flex-wrap gap-2">
                {data.tools.map((tool, i) => (
                  <span key={i} className="px-3 py-1 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs">
                    {tool}
                  </span>
                ))}
              </div>
            </div>
          </>
        )}

      </CardContent>
    </Card>
  )
}
