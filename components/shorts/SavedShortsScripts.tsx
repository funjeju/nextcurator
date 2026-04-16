'use client'

import { useEffect, useState } from 'react'
import { getSavedShortsScripts, deleteShortsScript, SavedShortsScript, SavedShortsSegment } from '@/lib/shortsScript'
import { formatRelativeDate } from '@/lib/formatDate'

const TYPE_META: Record<string, { label: string; color: string; bg: string }> = {
  hook:      { label: '훅·반전',   color: 'text-pink-400',    bg: 'bg-pink-500/15 border-pink-500/30' },
  tip:       { label: '실용 팁',   color: 'text-yellow-400',  bg: 'bg-yellow-500/15 border-yellow-500/30' },
  highlight: { label: '핵심 장면', color: 'text-cyan-400',    bg: 'bg-cyan-500/15 border-cyan-500/30' },
  emotion:   { label: '감동·웃음', color: 'text-emerald-400', bg: 'bg-emerald-500/15 border-emerald-500/30' },
}

function formatDuration(secs: number): string {
  if (secs <= 0) return '?초'
  return secs < 60 ? `${secs}초` : `${Math.floor(secs / 60)}분 ${secs % 60}초`
}

function DetailModal({ script, onClose }: { script: SavedShortsScript; onClose: () => void }) {
  const [copiedId, setCopiedId] = useState<number | null>(null)
  const [copiedAll, setCopiedAll] = useState(false)

  const copyScript = async (seg: SavedShortsSegment) => {
    const text = `[${seg.title}]\n⏱ ${seg.start_time} ~ ${seg.end_time} (${formatDuration(seg.duration_seconds)})\n\n${seg.script.replace(/\\n/g, '\n')}`
    await navigator.clipboard.writeText(text)
    setCopiedId(seg.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const copyAll = async () => {
    const text = script.segments.map((seg, i) =>
      `━━━ 클립 ${i + 1}: ${seg.title} ━━━\n⏱ ${seg.start_time} ~ ${seg.end_time} (${formatDuration(seg.duration_seconds)})\n\n${seg.script.replace(/\\n/g, '\n')}`
    ).join('\n\n')
    await navigator.clipboard.writeText(text)
    setCopiedAll(true)
    setTimeout(() => setCopiedAll(false), 2000)
  }

  const ytUrl = (secs: number) => `https://youtu.be/${script.videoId}?t=${secs}`

  return (
    <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-[#1c1a18] border border-white/10 rounded-3xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="shrink-0 flex items-center justify-between px-6 pt-6 pb-4 border-b border-white/5">
          <div className="min-w-0 flex-1">
            <h2 className="text-white font-bold text-base truncate">{script.videoTitle}</h2>
            <p className="text-zinc-500 text-xs mt-0.5">{script.channel} · {script.segments.length}개 클립</p>
          </div>
          <button onClick={onClose} className="ml-4 text-zinc-500 hover:text-white text-xl leading-none shrink-0">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {script.edit_tips && (
            <div className="bg-white/4 border border-white/8 rounded-2xl px-4 py-3">
              <p className="text-zinc-500 text-[10px] font-semibold uppercase tracking-wider mb-1">편집 총평</p>
              <p className="text-zinc-300 text-sm leading-relaxed">{script.edit_tips}</p>
            </div>
          )}

          {script.segments.map((seg, idx) => {
            const meta = TYPE_META[seg.type] ?? TYPE_META.highlight
            return (
              <div key={seg.id} className="bg-[#23211f] border border-white/8 rounded-2xl overflow-hidden">
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

        <div className="shrink-0 flex gap-2 px-6 py-4 border-t border-white/5">
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
      </div>
    </div>
  )
}

export default function SavedShortsScripts({ userId }: { userId: string }) {
  const [scripts, setScripts] = useState<SavedShortsScript[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<SavedShortsScript | null>(null)

  useEffect(() => {
    if (!userId || userId.startsWith('user_')) { setLoading(false); return }
    getSavedShortsScripts(userId)
      .then(setScripts)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [userId])

  const handleDelete = async (s: SavedShortsScript) => {
    if (!confirm(`"${s.videoTitle}" 숏폼 스크립트를 삭제할까요?`)) return
    await deleteShortsScript(s.id)
    setScripts(prev => prev.filter(x => x.id !== s.id))
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-8 h-8 rounded-full border-2 border-pink-500/30 border-t-pink-500 animate-spin" />
      </div>
    )
  }

  if (scripts.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-center">
        <span className="text-5xl">✂️</span>
        <div>
          <p className="text-white font-semibold mb-1">저장된 숏폼 스크립트가 없습니다</p>
          <p className="text-zinc-500 text-sm">영상 결과 페이지에서 ✂️ 버튼으로 스크립트를 생성하고 저장하세요.</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {scripts.map(s => (
          <div
            key={s.id}
            className="bg-[#23211f] border border-white/8 rounded-2xl overflow-hidden hover:border-white/20 transition-all group cursor-pointer"
            onClick={() => setSelected(s)}
          >
            {/* 썸네일 */}
            <div className="relative aspect-video bg-zinc-900">
              {s.thumbnail ? (
                <img src={s.thumbnail} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-3xl">✂️</div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
              <div className="absolute bottom-2 left-3 right-3">
                <div className="flex gap-1 flex-wrap">
                  {s.segments.slice(0, 3).map((seg, i) => {
                    const meta = TYPE_META[seg.type] ?? TYPE_META.highlight
                    return (
                      <span key={i} className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${meta.bg} ${meta.color}`}>
                        {meta.label}
                      </span>
                    )
                  })}
                  {s.segments.length > 3 && (
                    <span className="text-[9px] text-zinc-400 px-1">+{s.segments.length - 3}</span>
                  )}
                </div>
              </div>
            </div>

            {/* 정보 */}
            <div className="p-4">
              <p className="text-white font-semibold text-sm leading-snug line-clamp-2 mb-1">{s.videoTitle}</p>
              <p className="text-zinc-500 text-xs mb-3">{s.channel}</p>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-zinc-500">
                  <span>✂️ {s.segments.length}개 클립</span>
                  {s.createdAt && (
                    <span>· {formatRelativeDate(s.createdAt.toDate?.() ?? new Date(s.createdAt))}</span>
                  )}
                </div>
                <button
                  onClick={e => { e.stopPropagation(); handleDelete(s) }}
                  className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-red-400 transition-all text-xs px-2 py-1 rounded-lg hover:bg-red-500/10"
                >
                  삭제
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {selected && <DetailModal script={selected} onClose={() => setSelected(null)} />}
    </>
  )
}
