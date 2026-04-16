'use client'

import { useState } from 'react'
import type { SummarizeResponse } from '@/types/summary'

interface ShortsSegment {
  id: number
  title: string
  start_time: string
  end_time: string
  start_seconds: number
  end_seconds: number
  duration_seconds: number
  script: string
  hook: string
  type: 'hook' | 'tip' | 'highlight' | 'emotion'
}

interface ShortsResult {
  segments: ShortsSegment[]
  edit_tips: string
  videoId: string
  sessionId: string
}

const TYPE_META: Record<string, { label: string; color: string; bg: string }> = {
  hook:      { label: '훅·반전',   color: 'text-pink-400',   bg: 'bg-pink-500/15 border-pink-500/30' },
  tip:       { label: '실용 팁',   color: 'text-yellow-400', bg: 'bg-yellow-500/15 border-yellow-500/30' },
  highlight: { label: '핵심 장면', color: 'text-cyan-400',   bg: 'bg-cyan-500/15 border-cyan-500/30' },
  emotion:   { label: '감동·웃음', color: 'text-emerald-400', bg: 'bg-emerald-500/15 border-emerald-500/30' },
}

function formatDuration(secs: number): string {
  if (secs <= 0) return '?초'
  return secs < 60 ? `${secs}초` : `${Math.floor(secs / 60)}분 ${secs % 60}초`
}

interface Props {
  data: SummarizeResponse
  onClose: () => void
}

export default function ShortsScriptModal({ data, onClose }: Props) {
  const [result, setResult] = useState<ShortsResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [copiedId, setCopiedId] = useState<number | null>(null)
  const [copiedAll, setCopiedAll] = useState(false)

  const generate = async () => {
    if (!data.transcript || data.transcript.trim().length < 100) {
      alert('자막 데이터가 없는 영상은 숏폼 스크립트를 생성할 수 없습니다.')
      return
    }
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch('/api/shorts-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: data.transcript,
          title: data.title,
          channel: data.channel,
          videoId: data.videoId,
          sessionId: data.sessionId,
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      setResult(await res.json())
    } catch (e: any) {
      alert('생성 실패: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  const copyScript = async (seg: ShortsSegment) => {
    const text = `[${seg.title}]\n⏱ ${seg.start_time} ~ ${seg.end_time} (${formatDuration(seg.duration_seconds)})\n\n${seg.script.replace(/\\n/g, '\n')}`
    await navigator.clipboard.writeText(text)
    setCopiedId(seg.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const copyAll = async () => {
    if (!result) return
    const text = result.segments.map((seg, i) =>
      `━━━ 클립 ${i + 1}: ${seg.title} ━━━\n⏱ ${seg.start_time} ~ ${seg.end_time} (${formatDuration(seg.duration_seconds)})\n\n${seg.script.replace(/\\n/g, '\n')}`
    ).join('\n\n')
    await navigator.clipboard.writeText(text)
    setCopiedAll(true)
    setTimeout(() => setCopiedAll(false), 2000)
  }

  const ytUrl = (secs: number) => `https://youtu.be/${data.videoId}?t=${secs}`

  return (
    <div className="fixed inset-0 z-[150] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div
        className="bg-[#1c1a18] border border-white/10 rounded-3xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="shrink-0 flex items-center justify-between px-6 pt-6 pb-4 border-b border-white/5">
          <div>
            <h2 className="text-white font-bold text-lg">✂️ 숏폼 스크립트</h2>
            <p className="text-zinc-500 text-xs mt-0.5">핵심 구간 추출 · 자막 대본 · 편집 타임코드</p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white text-xl leading-none">✕</button>
        </div>

        {/* 본문 */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {!result && !loading && (
            <div className="flex flex-col items-center gap-5 py-10 text-center">
              <span className="text-5xl">✂️</span>
              <div>
                <p className="text-white font-semibold mb-1">롱폼 → 숏폼 구간 자동 추출</p>
                <p className="text-zinc-500 text-sm leading-relaxed">
                  자막을 분석해 Shorts·Reels·TikTok에 최적인<br />
                  핵심 구간 3~5개를 뽑아드립니다.<br />
                  <span className="text-zinc-600 text-xs">몇 초~몇 초 잘라쓰면 된다는 타임코드 포함</span>
                </p>
              </div>
              {(!data.transcript || data.transcript.trim().length < 100) ? (
                <div className="px-5 py-3 bg-zinc-800 rounded-2xl text-zinc-400 text-sm">
                  ⚠️ 이 영상은 자막 데이터가 없어 구간 추출이 불가합니다.
                </div>
              ) : (
                <button
                  onClick={generate}
                  className="px-8 py-3 bg-gradient-to-r from-pink-500 to-orange-500 text-white font-bold rounded-2xl text-sm transition-all hover:opacity-90 active:scale-95"
                >
                  핵심 구간 추출하기
                </button>
              )}
            </div>
          )}

          {loading && (
            <div className="flex flex-col items-center gap-4 py-16">
              <div className="w-10 h-10 rounded-full border-2 border-pink-500/30 border-t-pink-500 animate-spin" />
              <p className="text-zinc-400 text-sm">자막 분석 중... 핵심 구간을 찾고 있습니다</p>
            </div>
          )}

          {result && (
            <div className="space-y-4">
              {/* 편집 총평 */}
              {result.edit_tips && (
                <div className="bg-white/4 border border-white/8 rounded-2xl px-4 py-3">
                  <p className="text-zinc-500 text-[10px] font-semibold uppercase tracking-wider mb-1">편집 총평</p>
                  <p className="text-zinc-300 text-sm leading-relaxed">{result.edit_tips}</p>
                </div>
              )}

              {/* 구간 카드 목록 */}
              {result.segments.map((seg, idx) => {
                const meta = TYPE_META[seg.type] ?? TYPE_META.highlight
                return (
                  <div key={seg.id} className="bg-[#23211f] border border-white/8 rounded-2xl overflow-hidden">
                    {/* 카드 헤더 */}
                    <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5">
                      <span className="w-7 h-7 rounded-full bg-gradient-to-br from-pink-500 to-orange-500 text-white text-xs font-black flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-semibold text-sm truncate">{seg.title}</p>
                        <p className="text-zinc-500 text-xs mt-0.5">{seg.hook}</p>
                      </div>
                      <span className={`shrink-0 text-[10px] font-bold px-2 py-1 rounded-lg border ${meta.bg} ${meta.color}`}>
                        {meta.label}
                      </span>
                    </div>

                    {/* 타임코드 바 */}
                    <div className="flex items-center gap-3 px-4 py-3 bg-black/20">
                      <div className="flex items-center gap-2 flex-1">
                        <span className="text-zinc-400 text-xs font-mono bg-black/40 px-2 py-1 rounded-lg">{seg.start_time}</span>
                        <div className="flex-1 h-1 bg-white/10 rounded-full">
                          <div className="h-full bg-gradient-to-r from-pink-500 to-orange-500 rounded-full" style={{ width: '100%' }} />
                        </div>
                        <span className="text-zinc-400 text-xs font-mono bg-black/40 px-2 py-1 rounded-lg">{seg.end_time}</span>
                      </div>
                      <span className={`text-xs font-bold px-2 py-1 rounded-lg ${
                        seg.duration_seconds <= 30 ? 'text-emerald-400 bg-emerald-500/15' :
                        seg.duration_seconds <= 60 ? 'text-yellow-400 bg-yellow-500/15' :
                        'text-orange-400 bg-orange-500/15'
                      }`}>
                        {formatDuration(seg.duration_seconds)}
                      </span>
                      <a
                        href={ytUrl(seg.start_seconds)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] px-2.5 py-1.5 rounded-lg bg-red-500/15 text-red-400 hover:bg-red-500/25 border border-red-500/20 transition-colors font-semibold"
                      >
                        ▶ 구간 보기
                      </a>
                    </div>

                    {/* 스크립트 */}
                    <div className="px-4 pb-4 pt-3">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-zinc-500 text-[10px] font-semibold uppercase tracking-wider">자막 대본</p>
                        <button
                          onClick={() => copyScript(seg)}
                          className={`text-[10px] px-2.5 py-1 rounded-lg font-bold transition-colors ${
                            copiedId === seg.id
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : 'bg-white/5 text-zinc-400 hover:text-white border border-white/10'
                          }`}
                        >
                          {copiedId === seg.id ? '✓ 복사됨' : '복사'}
                        </button>
                      </div>
                      <p className="text-zinc-300 text-sm leading-relaxed whitespace-pre-wrap bg-black/20 rounded-xl px-3 py-3">
                        {seg.script.replace(/\\n/g, '\n')}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* 푸터 */}
        {result && (
          <div className="shrink-0 flex gap-2 px-6 py-4 border-t border-white/5">
            <button
              onClick={generate}
              className="px-4 h-10 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 text-xs transition-colors"
            >
              🔄 다시 추출
            </button>
            <div className="flex-1" />
            <button
              onClick={copyAll}
              className={`px-5 h-10 rounded-xl text-xs font-bold transition-colors ${
                copiedAll
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-gradient-to-r from-pink-500 to-orange-500 text-white hover:opacity-90'
              }`}
            >
              {copiedAll ? '✓ 전체 복사됨' : '📋 전체 스크립트 복사'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
