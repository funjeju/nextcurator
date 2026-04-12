'use client'

import { useState } from 'react'
import { VoiceSummary as VoiceSummaryType } from '@/types/summary'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import CopyButton from './CopyButton'

interface Props {
  data: VoiceSummaryType
}

const COLOR_CLASSES: Record<string, string> = {
  blue:   'from-blue-900/40 to-blue-600/20 border-blue-500/20',
  green:  'from-green-900/40 to-green-600/20 border-green-500/20',
  orange: 'from-orange-900/40 to-orange-600/20 border-orange-500/20',
  purple: 'from-purple-900/40 to-purple-600/20 border-purple-500/20',
  pink:   'from-pink-900/40 to-pink-600/20 border-pink-500/20',
  teal:   'from-teal-900/40 to-teal-600/20 border-teal-500/20',
  amber:  'from-amber-900/40 to-amber-600/20 border-amber-500/20',
}

const ACCENT_CLASSES: Record<string, string> = {
  blue:   'text-blue-400',
  green:  'text-green-400',
  orange: 'text-orange-400',
  purple: 'text-purple-400',
  pink:   'text-pink-400',
  teal:   'text-teal-400',
  amber:  'text-amber-400',
}

export default function VoiceSummary({ data }: Props) {
  const [showTranscript, setShowTranscript] = useState(false)
  const theme = data.color_theme || 'purple'
  const colorClass = COLOR_CLASSES[theme] ?? COLOR_CLASSES.purple
  const accentClass = ACCENT_CLASSES[theme] ?? ACCENT_CLASSES.purple

  const copyText = [
    `🎙 ${data.title}`,
    `📌 핵심 주제: ${data.main_topic}`,
    '',
    '💡 핵심 포인트:',
    ...data.key_points.map(k => `• ${k.point}${k.detail ? `\n  ${k.detail}` : ''}`),
    ...(data.action_items.length > 0 ? ['', '✅ 실행 항목:', ...data.action_items.map(a => `• ${a}`)] : []),
    '',
    '📝 전사 내용:',
    data.transcript,
  ].join('\n')

  return (
    <Card className={`bg-gradient-to-br ${colorClass} border`}>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="text-4xl shrink-0">{data.emoji}</span>
          <div>
            <CardTitle className={`${accentClass} text-sm mb-1`}>🎙 음성 녹음 메모</CardTitle>
            <h2 className="text-xl font-bold text-zinc-100">{data.title}</h2>
            <p className="text-zinc-400 text-sm mt-1">{data.duration_estimate}</p>
          </div>
        </div>
        <CopyButton text={copyText} />
      </CardHeader>

      <CardContent className="flex flex-col gap-5">
        {/* 핵심 주제 */}
        <div className={`rounded-xl bg-black/20 border border-white/5 px-4 py-3`}>
          <p className={`text-xs font-semibold ${accentClass} mb-1`}>📌 핵심 주제</p>
          <p className="text-zinc-200 text-sm leading-relaxed">{data.main_topic}</p>
        </div>

        <Separator className="bg-white/10" />

        {/* 핵심 포인트 */}
        {data.key_points.length > 0 && (
          <div>
            <h3 className={`${accentClass} font-semibold text-sm mb-3`}>💡 핵심 포인트</h3>
            <div className="flex flex-col gap-3">
              {data.key_points.map((kp, i) => (
                <div key={i} className="flex gap-3">
                  <span className={`shrink-0 w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold ${accentClass}`}>
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-zinc-200 text-sm font-medium">{kp.point}</p>
                    {kp.detail && <p className="text-zinc-400 text-xs mt-0.5 leading-relaxed">{kp.detail}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 실행 항목 */}
        {data.action_items.length > 0 && (
          <>
            <Separator className="bg-white/10" />
            <div>
              <h3 className="text-emerald-400 font-semibold text-sm mb-3">✅ 실행 항목</h3>
              <div className="flex flex-col gap-2">
                {data.action_items.map((item, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <span className="w-4 h-4 rounded border border-emerald-500/40 shrink-0 mt-0.5" />
                    <p className="text-zinc-300 text-sm">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* 태그 */}
        {data.square_meta?.tags?.length > 0 && (
          <>
            <Separator className="bg-white/10" />
            <div className="flex flex-wrap gap-1.5">
              {data.square_meta.tags.map((tag, i) => (
                <span key={i} className="px-2 py-1 rounded-md bg-white/5 border border-white/10 text-[11px] text-zinc-400">
                  #{tag}
                </span>
              ))}
            </div>
          </>
        )}

        <Separator className="bg-white/10" />

        {/* 전사 텍스트 (접이식) */}
        <div>
          <button
            onClick={() => setShowTranscript(v => !v)}
            className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors"
          >
            <span className={`transition-transform ${showTranscript ? 'rotate-90' : ''}`}>▶</span>
            📝 전체 전사 내용 {showTranscript ? '접기' : '펼치기'}
          </button>
          {showTranscript && (
            <div className="mt-3 bg-black/20 rounded-xl border border-white/5 p-4">
              <p className="text-zinc-300 text-sm leading-relaxed whitespace-pre-wrap">{data.transcript}</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
