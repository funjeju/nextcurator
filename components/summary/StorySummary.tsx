'use client'

import { useState } from 'react'
import { StorySummary as StorySummaryType } from '@/types/summary'
import TimestampBadge from './TimestampBadge'
import CommentBubble from '@/components/comments/CommentBubble'
import TranslateButton from './TranslateButton'

interface Props {
  data: StorySummaryType
  onSeek: (ts: string) => void
  sessionId?: string
  commentCounts?: Record<string, number>
  onComment?: (segmentId: string, segmentLabel: string) => void
  hideTimestamp?: boolean
  showTranslate?: boolean
}

function buildWebtoonPrompt(title: string, genre: string, event: string, characters: { name: string; desc: string }[]): string {
  const charDesc = characters.slice(0, 3).map(c => `${c.name}(${c.desc})`).join(', ')
  return `Webtoon panel illustration, ${genre} style, vibrant colors, expressive characters.\n\nScene: "${event}"\n\nCharacters: ${charDesc || 'main characters'}\nTitle context: "${title}"\n\nArt style: Korean webtoon, detailed backgrounds, cinematic composition, dramatic lighting`
}

export default function StorySummary({ data, onSeek, sessionId, commentCounts = {}, hideTimestamp, showTranslate }: Props) {
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)
  const hasTimestamps = !hideTimestamp && data.timeline?.some(t => t.timestamp && t.timestamp !== '00:00')

  const handleCopyWebtoon = async (event: string, idx: number) => {
    const prompt = buildWebtoonPrompt(data.title, data.genre, event, data.characters || [])
    try {
      await navigator.clipboard.writeText(prompt)
      setCopiedIdx(idx)
      setTimeout(() => setCopiedIdx(null), 2000)
    } catch { /* ignore */ }
  }
  return (
    <div className="space-y-6 bg-[#32302e]/80 backdrop-blur-3xl p-6 md:p-8 rounded-[32px] border border-white/5 shadow-2xl mt-4">

      {/* 제목 & 장르 */}
      <div className="pb-4 border-b border-white/10">
        <h2 className="text-2xl font-bold text-white mb-2">{data.title}</h2>
        <span className="inline-block px-3 py-1 bg-pink-500/10 text-pink-400 text-sm font-medium rounded-full border border-pink-500/20">
          {data.genre}
        </span>
      </div>

      {/* 주요 인물 */}
      {data.characters && data.characters.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <span>👥</span> 주요 인물
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {data.characters.map((char, i) => (
              <div key={i} className="p-4 rounded-2xl bg-[#23211f] border border-white/5 flex flex-col gap-1">
                <span className="font-medium text-pink-300">{char.name}</span>
                <span className="text-sm text-[#a4a09c]">{char.desc}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 스토리 타임라인 */}
      {data.timeline && data.timeline.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <span>{hasTimestamps ? '⏱️' : '📋'}</span> 스토리 {hasTimestamps ? '타임라인' : '전개'}
          </h3>
          <div className="space-y-3 relative before:absolute before:left-4 before:top-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-white/10 before:to-transparent">
            {data.timeline.map((item, i) => {
              const segId = `timeline-${i}`
              const segLabel = `타임라인 ${i + 1}번째`
              return (
                <div key={i} id={`seg-${segId}`} className="relative flex items-start gap-3 group transition-all">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full border-4 border-[#32302e] bg-[#23211f] text-pink-500 shadow shrink-0 mt-1 group-hover:bg-pink-500/20 transition-colors z-10" />
                  <div className="flex-1 p-4 rounded-2xl bg-[#23211f] border border-white/5 flex flex-col gap-2 hover:bg-[#3d3a38] transition-colors">
                    <div className="flex items-center gap-2 flex-wrap">
                      <TimestampBadge timestamp={item.timestamp} onSeek={onSeek} />
                      {sessionId && (
                        <CommentBubble
                          sessionId={sessionId}
                          segmentId={segId}
                          segmentLabel={segLabel}
                          initialCount={commentCounts[segId] ?? 0}
                        />
                      )}
                    </div>
                    <p className="text-[#e2e2e2] leading-relaxed text-[15px]">{item.event}</p>
                    <div className="flex items-center gap-2 flex-wrap mt-1">
                      {showTranslate && <TranslateButton text={item.event} />}
                      <button
                        onClick={() => handleCopyWebtoon(item.event, i)}
                        className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border transition-all ${
                          copiedIdx === i
                            ? 'bg-pink-500/15 border-pink-500/30 text-pink-400'
                            : 'bg-[#32302e] border-white/10 text-[#75716e] hover:text-pink-300 hover:border-pink-500/30'
                        }`}
                        title="이 장면의 웹툰 이미지 생성 프롬프트를 클립보드에 복사"
                      >
                        {copiedIdx === i ? '✅ 복사됨' : '🎨 웹툰 프롬프트'}
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 결말 */}
      {data.conclusion && (
        <div className="space-y-3 pt-6 border-t border-white/10">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <span>🎬</span> 핵심 요약 / 결말
          </h3>
          <div id="seg-conclusion" className="p-5 rounded-2xl bg-[#23211f] border border-white/5 flex items-start gap-3">
            <p className="text-[#a4a09c] text-[15px] leading-relaxed whitespace-pre-wrap flex-1">
              {data.conclusion}
            </p>
            {sessionId && (
              <CommentBubble
                sessionId={sessionId}
                segmentId="conclusion"
                segmentLabel="결말/핵심 요약"
                initialCount={commentCounts['conclusion'] ?? 0}
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
