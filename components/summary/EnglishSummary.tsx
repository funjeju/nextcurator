'use client'

import { EnglishSummary as EnglishSummaryType } from '@/types/summary'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import TimestampBadge from './TimestampBadge'
import CopyButton from './CopyButton'
import CommentBubble from '@/components/comments/CommentBubble'

interface Props {
  data: EnglishSummaryType
  onSeek: (ts: string) => void
  sessionId?: string
  commentCounts?: Record<string, number>
  onComment?: (segmentId: string, segmentLabel: string) => void
  hideTimestamp?: boolean
}

export default function EnglishSummary({ data, onSeek, sessionId, commentCounts = {} }: Props) {
  const displayTitle = data.title || data.song_or_title || ''

  const copyText = [
    displayTitle,
    data.key_message ? `\n핵심 내용:\n${data.key_message}` : '',
    `\n핵심 표현:\n${data.expressions.map(e => `[${e.timestamp}] "${e.text}" → ${e.meaning}\n💡 ${e.note}`).join('\n\n')}`,
    data.vocabulary.length
      ? `\n주요 단어:\n${data.vocabulary.map(v => `${v.word}: ${v.meaning}${v.example ? ` / 예) ${v.example} (${v.example_ko})` : v.pronunciation ? ` (${v.pronunciation})` : ''}`).join('\n')}`
      : '',
    data.patterns.length
      ? `\n반복 패턴:\n${data.patterns.map(p => typeof p === 'string' ? p : `${p.pattern} → ${p.desc}`).join('\n')}`
      : '',
  ].join('')

  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-blue-400 text-sm mb-1">🔤 영어 학습 카드</CardTitle>
          <h2 className="text-xl font-bold text-zinc-100">{displayTitle}</h2>
          {data.artist && <p className="text-zinc-400 text-sm mt-1">{data.artist}</p>}
        </div>
        <CopyButton text={copyText} />
      </CardHeader>
      <CardContent className="flex flex-col gap-6">

        {/* 핵심 내용 요약 */}
        {data.key_message && (
          <div className="bg-blue-950/40 border border-blue-800/40 rounded-lg p-4">
            <h3 className="text-blue-300 font-semibold text-sm mb-2">📌 핵심 내용</h3>
            <p className="text-zinc-200 text-sm leading-relaxed">{data.key_message}</p>
          </div>
        )}

        {/* 핵심 표현 */}
        <div>
          <h3 className="text-zinc-300 font-semibold mb-3">핵심 표현</h3>
          <div className="flex flex-col gap-4">
            {data.expressions.map((expr, i) => {
              const segId = `expr-${i}`
              return (
                <div key={i} id={`seg-${segId}`} className="bg-zinc-800 rounded-lg p-3 flex flex-col gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <TimestampBadge timestamp={expr.timestamp} onSeek={onSeek} />
                    {sessionId && (
                      <CommentBubble sessionId={sessionId} segmentId={segId} segmentLabel={`핵심 표현 - "${expr.text.slice(0, 20)}"`} initialCount={commentCounts[segId] ?? 0} />
                    )}
                  </div>
                  <p className="text-zinc-100 font-mono text-sm">&quot;{expr.text}&quot;</p>
                  <p className="text-zinc-300 text-sm">→ {expr.meaning}</p>
                  <p className="text-blue-300 text-xs">💡 {expr.note}</p>
                </div>
              )
            })}
          </div>
        </div>

        {/* 주요 단어 */}
        {data.vocabulary.length > 0 && (
          <>
            <Separator className="bg-zinc-800" />
            <div>
              <h3 className="text-zinc-300 font-semibold mb-3">주요 단어</h3>
              <Table>
                <TableHeader>
                  <TableRow className="border-zinc-700">
                    <TableHead className="text-zinc-400">단어</TableHead>
                    <TableHead className="text-zinc-400">한국어 뜻</TableHead>
                    <TableHead className="text-zinc-400">예문</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.vocabulary.map((vocab, i) => {
                    const segId = `vocab-${i}`
                    return (
                      <TableRow key={i} id={`seg-${segId}`} className="border-zinc-800">
                        <TableCell className="text-zinc-200 font-medium font-mono">{vocab.word}</TableCell>
                        <TableCell className="text-zinc-300">{vocab.meaning}</TableCell>
                        <TableCell className="text-zinc-400 text-sm">
                          {vocab.example && (
                            <span>
                              <span className="text-zinc-300 italic">{vocab.example}</span>
                              {vocab.example_ko && <span className="block text-zinc-500 text-xs">{vocab.example_ko}</span>}
                            </span>
                          )}
                          {!vocab.example && vocab.pronunciation && (
                            <span className="text-zinc-500">{vocab.pronunciation}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {sessionId && (
                            <CommentBubble sessionId={sessionId} segmentId={segId} segmentLabel={`단어 - ${vocab.word}`} initialCount={commentCounts[segId] ?? 0} />
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </>
        )}

        {/* 반복 패턴 */}
        {data.patterns.length > 0 && (
          <>
            <Separator className="bg-zinc-800" />
            <div>
              <h3 className="text-zinc-300 font-semibold mb-2">반복 패턴</h3>
              <div className="flex flex-col gap-2">
                {data.patterns.map((pattern, i) => {
                  const segId = `pattern-${i}`
                  const isObj = typeof pattern === 'object'
                  return (
                    <div key={i} id={`seg-${segId}`} className="bg-zinc-800 rounded p-3">
                      <div className="flex items-start gap-2">
                        <div className="flex-1">
                          <p className="text-zinc-200 text-sm font-mono">{isObj ? pattern.pattern : pattern}</p>
                          {isObj && pattern.desc && (
                            <p className="text-blue-300 text-xs mt-1">→ {pattern.desc}</p>
                          )}
                        </div>
                        {sessionId && (
                          <CommentBubble sessionId={sessionId} segmentId={segId} segmentLabel={`패턴 ${i + 1}`} initialCount={commentCounts[segId] ?? 0} />
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )}

        {/* 문화 맥락 */}
        {data.cultural_context && (
          <>
            <Separator className="bg-zinc-800" />
            <div id="seg-cultural">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-zinc-300 font-semibold">문화 맥락</h3>
                {sessionId && (
                  <CommentBubble sessionId={sessionId} segmentId="cultural" segmentLabel="문화 맥락" initialCount={commentCounts['cultural'] ?? 0} />
                )}
              </div>
              <p className="text-zinc-400 text-sm">{data.cultural_context}</p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
