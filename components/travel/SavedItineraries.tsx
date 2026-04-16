'use client'

import { useEffect, useState } from 'react'
import { getSavedItineraries, deleteItinerary, SavedItinerary } from '@/lib/travelItinerary'

function formatDate(dateStr: string) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function DetailModal({ item, onClose }: { item: SavedItinerary; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#1c1a18] border border-white/10 rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="shrink-0 flex items-center justify-between px-6 pt-6 pb-4 border-b border-white/5">
          <div>
            <h2 className="text-white font-bold text-base">
              {item.regionEmoji} {item.regionName} 여행 일정
            </h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs px-2 py-0.5 rounded-lg bg-orange-500/15 text-orange-400 border border-orange-500/20 font-semibold">
                {item.nights}박 {item.days}일
              </span>
              <span className="text-zinc-500 text-xs">
                {formatDate(item.startDate)} → {formatDate(item.endDate)}
              </span>
              {item.mode === 'with_recommendations' && (
                <span className="text-xs px-2 py-0.5 rounded-lg bg-cyan-500/15 text-cyan-400 border border-cyan-500/20 font-semibold">
                  AI 추천 포함
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white text-xl leading-none">✕</button>
        </div>

        {/* 본문 */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {item.result.accommodation_suggestion && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl px-4 py-3">
              <p className="text-amber-400 text-[10px] font-bold uppercase tracking-wider mb-1">🏨 숙소 추천</p>
              <p className="text-zinc-300 text-sm leading-relaxed">{item.result.accommodation_suggestion}</p>
            </div>
          )}

          {item.result.days.map(day => (
            <div key={day.day}>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-7 h-7 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 text-white text-xs font-black flex items-center justify-center shrink-0">
                  {day.day}
                </span>
                <div>
                  <p className="text-white font-semibold text-sm">{day.summary}</p>
                  {day.date && <p className="text-zinc-600 text-xs">{day.date}</p>}
                </div>
              </div>
              <div className="space-y-2 ml-9">
                {day.slots.map((slot, i) => (
                  <div
                    key={i}
                    className={`flex gap-3 rounded-2xl p-3 ${
                      slot.isRecommended
                        ? 'bg-cyan-500/5 border border-cyan-500/15'
                        : 'bg-white/4 border border-white/5'
                    }`}
                  >
                    <div className="shrink-0 w-16 text-right">
                      <span className="text-orange-400 text-xs font-semibold">{slot.time}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-cyan-300 text-sm font-semibold">{slot.spotName}</p>
                        {slot.isRecommended && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-400 font-bold border border-cyan-500/20">AI 추천</span>
                        )}
                      </div>
                      <p className="text-zinc-400 text-xs mt-0.5 leading-relaxed">{slot.activity}</p>
                      {slot.tip && <p className="text-amber-400/80 text-xs mt-1">💡 {slot.tip}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {item.result.transport_tips && (
            <div className="bg-white/4 border border-white/8 rounded-2xl px-4 py-3">
              <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider mb-1">🚗 이동 팁</p>
              <p className="text-zinc-300 text-sm leading-relaxed">{item.result.transport_tips}</p>
            </div>
          )}

          {item.result.overall_tip && (
            <div className="bg-orange-500/8 border border-orange-500/15 rounded-2xl px-4 py-3">
              <p className="text-orange-400 text-[10px] font-bold uppercase tracking-wider mb-1">✨ 전체 꿀팁</p>
              <p className="text-zinc-300 text-sm leading-relaxed">{item.result.overall_tip}</p>
            </div>
          )}
        </div>

        <div className="shrink-0 px-6 py-4 border-t border-white/5">
          <button
            onClick={onClose}
            className="px-6 h-10 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold transition-colors"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}

export default function SavedItineraries({ userId }: { userId: string }) {
  const [items, setItems] = useState<SavedItinerary[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<SavedItinerary | null>(null)

  useEffect(() => {
    if (!userId || userId.startsWith('user_')) { setLoading(false); return }
    getSavedItineraries(userId)
      .then(setItems)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [userId])

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (!confirm('이 일정을 삭제할까요?')) return
    try {
      await deleteItinerary(id)
      setItems(prev => prev.filter(x => x.id !== id))
    } catch {
      alert('삭제에 실패했습니다.')
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 rounded-full border-2 border-orange-500/30 border-t-orange-500 animate-spin" />
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-12 text-zinc-600">
        <p className="text-3xl mb-2">🗓️</p>
        <p className="text-sm">저장된 AI 여행 일정이 없습니다.</p>
        <p className="text-xs mt-1 text-zinc-700">여행 찜 탭에서 AI 일정을 생성하고 저장해보세요.</p>
      </div>
    )
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map(item => (
          <button
            key={item.id}
            onClick={() => setSelected(item)}
            className="group text-left bg-[#2a2826] border border-white/8 hover:border-orange-500/30 rounded-2xl p-4 transition-all hover:-translate-y-0.5 relative"
          >
            {/* 삭제 버튼 */}
            <button
              onClick={e => handleDelete(e, item.id)}
              className="absolute top-3 right-3 w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100 text-xs"
            >
              ✕
            </button>

            {/* 지역 + 기간 */}
            <div className="flex items-center gap-2 mb-2 pr-8">
              <span className="text-xl">{item.regionEmoji}</span>
              <div>
                <p className="text-white font-bold text-sm">{item.regionName}</p>
                <p className="text-zinc-500 text-xs">
                  {item.startDate} ~ {item.endDate}
                </p>
              </div>
            </div>

            {/* 배지 */}
            <div className="flex items-center gap-1.5 flex-wrap mb-3">
              <span className="text-[10px] px-2 py-0.5 rounded-lg bg-orange-500/15 text-orange-400 border border-orange-500/20 font-semibold">
                {item.nights}박 {item.days}일
              </span>
              {item.mode === 'with_recommendations' && (
                <span className="text-[10px] px-2 py-0.5 rounded-lg bg-cyan-500/15 text-cyan-400 border border-cyan-500/20 font-semibold">
                  AI 추천 포함
                </span>
              )}
            </div>

            {/* 첫째날 요약 미리보기 */}
            {item.result.days[0] && (
              <p className="text-zinc-400 text-xs leading-relaxed line-clamp-2">
                <span className="text-orange-400 font-semibold">Day 1</span> {item.result.days[0].summary}
              </p>
            )}

            {/* 총 스팟 수 */}
            <p className="text-zinc-600 text-[10px] mt-2">
              총 {item.result.days.reduce((acc, d) => acc + d.slots.length, 0)}개 슬롯
            </p>
          </button>
        ))}
      </div>

      {selected && (
        <DetailModal item={selected} onClose={() => setSelected(null)} />
      )}
    </>
  )
}
