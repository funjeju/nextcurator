'use client'

import { useEffect, useState } from 'react'
import { getRegions, createRegion, addSpot, TravelRegion } from '@/lib/travel'

interface SpotInput {
  name: string
  address?: string
  description?: string
  thumbnail?: string
  sourceType: 'youtube' | 'manual'
  sourceVideoId?: string
  sourceSessionId?: string
  videoTimestamp?: string
}

interface Props {
  userId: string
  spot: SpotInput
  onClose: () => void
  onAdded?: () => void
}

export default function WishSpotModal({ userId, spot, onClose, onAdded }: Props) {
  const [regions, setRegions] = useState<TravelRegion[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string>('')
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newEmoji, setNewEmoji] = useState('📍')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getRegions(userId)
      .then(list => { setRegions(list); if (list.length > 0) setSelectedId(list[0].id) })
      .finally(() => setLoading(false))
  }, [userId])

  const handleCreateRegion = async () => {
    const name = newName.trim()
    if (!name) return
    const id = await createRegion(userId, name, newEmoji)
    const newRegion: TravelRegion = { id, userId, name, emoji: newEmoji, spotCount: 0, createdAt: null }
    setRegions(prev => [newRegion, ...prev])
    setSelectedId(id)
    setCreating(false)
    setNewName('')
  }

  const handleSave = async () => {
    if (!selectedId) return
    setSaving(true)
    try {
      await addSpot(userId, selectedId, spot)
      onAdded?.()
      onClose()
    } catch (e: any) {
      alert('저장 실패: ' + e.message)
    } finally {
      setSaving(false)
    }
  }

  const EMOJI_OPTIONS = ['📍', '🏖️', '🏔️', '🏙️', '🌿', '🍜', '🎡', '🛕', '🗼', '🌊']

  return (
    <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-[#1c1a18] border border-white/10 rounded-3xl w-full max-w-sm shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 pt-6 pb-4 border-b border-white/5 flex items-start justify-between">
          <div>
            <h2 className="text-white font-bold text-base">🗺️ 여행 찜하기</h2>
            <p className="text-zinc-500 text-xs mt-0.5 truncate max-w-[200px]">{spot.name}</p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white text-xl leading-none ml-4">✕</button>
        </div>

        <div className="px-6 py-4 space-y-3">
          {loading ? (
            <div className="flex justify-center py-6">
              <div className="w-7 h-7 rounded-full border-2 border-cyan-500/30 border-t-cyan-500 animate-spin" />
            </div>
          ) : (
            <>
              <p className="text-zinc-400 text-xs font-semibold uppercase tracking-wider">저장할 지역 폴더</p>

              {/* 지역 목록 */}
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {regions.map(r => (
                  <button
                    key={r.id}
                    onClick={() => setSelectedId(r.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-left transition-all ${
                      selectedId === r.id
                        ? 'bg-cyan-500/20 border border-cyan-500/40 text-white'
                        : 'bg-white/5 border border-white/5 text-zinc-300 hover:bg-white/8'
                    }`}
                  >
                    <span className="text-xl">{r.emoji}</span>
                    <span className="flex-1 text-sm font-medium">{r.name}</span>
                    <span className="text-xs text-zinc-500">{r.spotCount}개</span>
                    {selectedId === r.id && <span className="text-cyan-400 text-xs">✓</span>}
                  </button>
                ))}
                {regions.length === 0 && !creating && (
                  <p className="text-zinc-500 text-sm text-center py-4">지역 폴더가 없습니다.<br />아래에서 새 폴더를 만들어보세요.</p>
                )}
              </div>

              {/* 새 지역 만들기 */}
              {creating ? (
                <div className="bg-white/5 border border-cyan-500/30 rounded-2xl p-4 space-y-3">
                  <p className="text-xs text-cyan-400 font-semibold">새 지역 만들기</p>
                  {/* 이모지 선택 */}
                  <div className="flex gap-1.5 flex-wrap">
                    {EMOJI_OPTIONS.map(e => (
                      <button
                        key={e}
                        onClick={() => setNewEmoji(e)}
                        className={`w-9 h-9 rounded-xl text-lg flex items-center justify-center transition-all ${
                          newEmoji === e ? 'bg-cyan-500/30 border border-cyan-500/50 scale-110' : 'bg-white/5 hover:bg-white/10'
                        }`}
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                  <input
                    autoFocus
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleCreateRegion(); if (e.key === 'Escape') setCreating(false) }}
                    placeholder="지역 이름 (예: 제주도, 도쿄)"
                    className="w-full bg-[#2a2826] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500/40"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleCreateRegion}
                      disabled={!newName.trim()}
                      className="flex-1 py-2 bg-cyan-500 hover:bg-cyan-600 disabled:bg-zinc-700 disabled:text-zinc-500 text-white text-xs font-bold rounded-xl transition-colors"
                    >
                      만들기
                    </button>
                    <button
                      onClick={() => { setCreating(false); setNewName('') }}
                      className="px-4 py-2 bg-white/5 hover:bg-white/10 text-zinc-400 text-xs rounded-xl transition-colors"
                    >
                      취소
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setCreating(true)}
                  className="w-full py-2.5 border border-dashed border-white/15 hover:border-cyan-500/40 text-zinc-500 hover:text-cyan-400 text-xs rounded-2xl transition-all"
                >
                  + 새 지역 폴더 만들기
                </button>
              )}
            </>
          )}
        </div>

        <div className="px-6 py-4 border-t border-white/5 flex gap-2">
          <button onClick={onClose} className="flex-1 h-11 rounded-2xl bg-white/5 text-zinc-400 text-sm hover:bg-white/10 transition-colors">
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={!selectedId || saving}
            className="flex-1 h-11 rounded-2xl bg-cyan-500 hover:bg-cyan-600 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-bold text-sm transition-colors flex items-center justify-center gap-2"
          >
            {saving ? (
              <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
            ) : '찜 저장'}
          </button>
        </div>
      </div>
    </div>
  )
}
