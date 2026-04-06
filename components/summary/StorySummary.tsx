'use client'

import { StorySummary as StorySummaryType } from '@/types/summary'
import TimestampBadge from './TimestampBadge'

interface Props {
  data: StorySummaryType
  onSeek: (ts: string) => void
}

export default function StorySummary({ data, onSeek }: Props) {
  return (
    <div className="space-y-6 bg-[#32302e]/80 backdrop-blur-3xl p-6 md:p-8 rounded-[32px] border border-white/5 shadow-2xl mt-4">
      
      {/* Title & Genre */}
      <div className="pb-4 border-b border-white/10">
        <h2 className="text-2xl font-bold text-white mb-2">{data.title}</h2>
        <span className="inline-block px-3 py-1 bg-pink-500/10 text-pink-400 text-sm font-medium rounded-full border border-pink-500/20">
          {data.genre}
        </span>
      </div>

      {/* Characters */}
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

      {/* Timeline */}
      {data.timeline && data.timeline.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <span>⏱️</span> 스토리 타임라인
          </h3>
          <div className="space-y-3 relative before:absolute before:inset-0 before:ml-4 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-white/10 before:to-transparent">
            {data.timeline.map((item, i) => (
              <div key={i} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                <div className="flex items-center justify-center w-8 h-8 rounded-full border-4 border-[#32302e] bg-[#23211f] text-pink-500 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 group-hover:bg-pink-500/20 transition-colors z-10" />
                <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2rem)] p-4 rounded-2xl bg-[#23211f] border border-white/5 flex gap-3 hover:bg-[#3d3a38] transition-colors">
                  <div className="shrink-0 pt-0.5">
                    <TimestampBadge timestamp={item.timestamp} onSeek={onSeek} />
                  </div>
                  <p className="text-[#e2e2e2] leading-relaxed text-[15px]">{item.event}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Conclusion */}
      {data.conclusion && (
        <div className="space-y-3 pt-6 border-t border-white/10">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <span>🎬</span> 핵심 요약 / 결말
          </h3>
          <div className="p-5 rounded-2xl bg-[#23211f] border border-white/5">
            <p className="text-[#a4a09c] text-[15px] leading-relaxed whitespace-pre-wrap">
              {data.conclusion}
            </p>
          </div>
        </div>
      )}

    </div>
  )
}
