'use client'

import { EnglishSummary as EnglishSummaryType } from '@/types/summary'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import TimestampBadge from './TimestampBadge'
import CopyButton from './CopyButton'

interface Props {
  data: EnglishSummaryType
  onSeek: (ts: string) => void
}

export default function EnglishSummary({ data, onSeek }: Props) {
  const copyText = `${data.song_or_title}${data.artist ? ` — ${data.artist}` : ''}\n\n핵심 표현:\n${data.expressions.map(e => `[${e.timestamp}] "${e.text}" → ${e.meaning}\n💡 ${e.note}`).join('\n\n')}\n\n주요 단어:\n${data.vocabulary.map(v => `${v.word}: ${v.meaning} (${v.pronunciation})`).join('\n')}\n\n반복 패턴:\n${data.patterns.join('\n')}`

  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-blue-400 text-sm mb-1">🔤 영어 학습 카드</CardTitle>
          <h2 className="text-xl font-bold text-zinc-100">{data.song_or_title}</h2>
          {data.artist && <p className="text-zinc-400 text-sm mt-1">{data.artist}</p>}
        </div>
        <CopyButton text={copyText} />
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div>
          <h3 className="text-zinc-300 font-semibold mb-3">핵심 표현</h3>
          <div className="flex flex-col gap-4">
            {data.expressions.map((expr, i) => (
              <div key={i} className="bg-zinc-800 rounded-lg p-3 flex flex-col gap-2">
                <TimestampBadge timestamp={expr.timestamp} onSeek={onSeek} />
                <p className="text-zinc-100 font-mono text-sm">&quot;{expr.text}&quot;</p>
                <p className="text-zinc-300 text-sm">→ {expr.meaning}</p>
                <p className="text-blue-300 text-xs">💡 {expr.note}</p>
              </div>
            ))}
          </div>
        </div>

        {data.vocabulary.length > 0 && (
          <>
            <Separator className="bg-zinc-800" />
            <div>
              <h3 className="text-zinc-300 font-semibold mb-3">주요 단어</h3>
              <Table>
                <TableHeader>
                  <TableRow className="border-zinc-700">
                    <TableHead className="text-zinc-400">단어</TableHead>
                    <TableHead className="text-zinc-400">뜻</TableHead>
                    <TableHead className="text-zinc-400">발음 팁</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.vocabulary.map((vocab, i) => (
                    <TableRow key={i} className="border-zinc-800">
                      <TableCell className="text-zinc-200 font-medium">{vocab.word}</TableCell>
                      <TableCell className="text-zinc-300">{vocab.meaning}</TableCell>
                      <TableCell className="text-zinc-400 text-sm">{vocab.pronunciation}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}

        {data.patterns.length > 0 && (
          <>
            <Separator className="bg-zinc-800" />
            <div>
              <h3 className="text-zinc-300 font-semibold mb-2">반복 패턴</h3>
              {data.patterns.map((pattern, i) => (
                <p key={i} className="text-zinc-300 text-sm font-mono bg-zinc-800 p-2 rounded mt-2">{pattern}</p>
              ))}
            </div>
          </>
        )}

        {data.cultural_context && (
          <>
            <Separator className="bg-zinc-800" />
            <div>
              <h3 className="text-zinc-300 font-semibold mb-2">문화 맥락</h3>
              <p className="text-zinc-400 text-sm">{data.cultural_context}</p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
