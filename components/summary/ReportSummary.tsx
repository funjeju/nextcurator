'use client'

import { ReportSummary as ReportSummaryType } from '@/types/summary'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import TimestampBadge from './TimestampBadge'
import CopyButton from './CopyButton'
import CommentBubble from '@/components/comments/CommentBubble'

interface Props {
  data: ReportSummaryType
  onSeek: (ts: string) => void
  sessionId?: string
  commentCounts?: Record<string, number>
  onComment?: (segmentId: string, segmentLabel: string) => void
  hideTimestamp?: boolean
}

export default function ReportSummary({ data, onSeek, sessionId, commentCounts = {}, hideTimestamp }: Props) {
  const copyText = [
    `# ${data.title}`,
    '',
    `[개요] ${data.context_summary}`,
    '',
    '## 목차',
    ...data.table_of_contents.map(t => `  ${t}`),
    '',
    ...data.sections.map(s =>
      `## ${s.number}. ${s.heading}${s.timestamp && !hideTimestamp ? ` [${s.timestamp}]` : ''}\n${s.body}`
    ),
    '',
    `[결론] ${data.conclusion}`,
  ].join('\n')

  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <CardTitle className="text-blue-400 text-sm mb-1.5">📋 보고서</CardTitle>
          <p className="text-zinc-100 text-base font-semibold leading-snug">{data.title}</p>
        </div>
        <CopyButton text={copyText} />
      </CardHeader>

      <CardContent className="flex flex-col gap-6">

        {/* 맥락 요약 */}
        <div id="seg-context" className="bg-zinc-800/70 rounded-xl p-4 border-l-4 border-blue-500">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="text-blue-400 text-xs font-semibold uppercase tracking-wide">개요</span>
            {sessionId && (
              <CommentBubble sessionId={sessionId} segmentId="context" segmentLabel="개요" initialCount={commentCounts['context'] ?? 0} />
            )}
          </div>
          <p className="text-zinc-300 text-sm leading-relaxed">{data.context_summary}</p>
        </div>

        {/* 목차 */}
        {data.table_of_contents.length > 0 && (
          <div className="bg-zinc-800/40 rounded-xl p-4">
            <h3 className="text-zinc-400 text-xs font-semibold uppercase tracking-wide mb-3">목차</h3>
            <ol className="flex flex-col gap-1.5">
              {data.table_of_contents.map((item, i) => (
                <li key={i} className="text-zinc-300 text-sm flex items-start gap-2">
                  <span className="shrink-0 text-blue-500/70 font-mono text-xs mt-0.5">{String(i + 1).padStart(2, '0')}</span>
                  <span>{item.replace(/^\d+[\.\)]\s*/, '')}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        <Separator className="bg-zinc-800" />

        {/* 섹션별 본문 */}
        <div className="flex flex-col gap-5">
          {data.sections.map((section) => {
            const segId = `section-${section.number}`
            return (
              <div key={section.number} id={`seg-${segId}`} className="flex flex-col gap-2">
                <div className="flex items-center gap-2.5 flex-wrap">
                  {/* 섹션 번호 */}
                  <span className="shrink-0 w-6 h-6 rounded-full bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-400 text-xs font-bold">
                    {section.number}
                  </span>
                  <h3 className="text-zinc-100 text-sm font-semibold">{section.heading}</h3>
                  {!hideTimestamp && section.timestamp && (
                    <TimestampBadge timestamp={section.timestamp} onSeek={onSeek} />
                  )}
                  {sessionId && (
                    <CommentBubble sessionId={sessionId} segmentId={segId} segmentLabel={`${section.number}. ${section.heading}`} initialCount={commentCounts[segId] ?? 0} />
                  )}
                </div>
                <p className="text-zinc-400 text-sm leading-relaxed pl-8">{section.body}</p>
              </div>
            )
          })}
        </div>

        <Separator className="bg-zinc-800" />

        {/* 결론 */}
        <div id="seg-conclusion" className="bg-gradient-to-r from-blue-500/10 to-indigo-500/10 border border-blue-500/20 rounded-xl px-4 py-3.5">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="text-blue-400 text-xs font-semibold uppercase tracking-wide">핵심 결론</span>
            {sessionId && (
              <CommentBubble sessionId={sessionId} segmentId="conclusion" segmentLabel="핵심 결론" initialCount={commentCounts['conclusion'] ?? 0} />
            )}
          </div>
          <p className="text-zinc-200 text-sm font-medium leading-relaxed">{data.conclusion}</p>
        </div>

      </CardContent>
    </Card>
  )
}
