'use client'

import { useEffect, useState } from 'react'
import {
  getRegions, createRegion, renameRegion, deleteRegion,
  getSpots, addSpot, deleteSpot, toggleVisited,
  TravelRegion, TravelSpot,
} from '@/lib/travel'
import ItineraryWizardModal from './ItineraryWizardModal'

const EMOJI_OPTIONS = ['📍', '🏖️', '🏔️', '🏙️', '🌿', '🍜', '🎡', '🛕', '🗼', '🌊']

export default function TravelWishlist({ userId }: { userId: string }) {
  const [regions, setRegions] = useState<TravelRegion[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [spots, setSpots] = useState<TravelSpot[]>([])
  const [loadingRegions, setLoadingRegions] = useState(true)
  const [loadingSpots, setLoadingSpots] = useState(false)

  // 지역 생성
  const [creatingRegion, setCreatingRegion] = useState(false)
  const [newRegionName, setNewRegionName] = useState('')
  const [newRegionEmoji, setNewRegionEmoji] = useState('📍')

  // 지역 편집
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [renameEmoji, setRenameEmoji] = useState('📍')

  // 스팟 수동 추가
  const [addingSpot, setAddingSpot] = useState(false)
  const [spotName, setSpotName] = useState('')
  const [spotAddress, setSpotAddress] = useState('')
  const [spotDesc, setSpotDesc] = useState('')
  const [savingSpot, setSavingSpot] = useState(false)

  // 일정 생성 위자드
  const [showWizard, setShowWizard] = useState(false)

  useEffect(() => {
    if (!userId || userId.startsWith('user_')) { setLoadingRegions(false); return }
    getRegions(userId)
      .then(list => {
        setRegions(list)
        if (list.length > 0) setSelectedId(list[0].id)
      })
      .catch(() => {})
      .finally(() => setLoadingRegions(false))
  }, [userId])

  useEffect(() => {
    if (!selectedId || !userId || userId.startsWith('user_')) { setSpots([]); return }
    setLoadingSpots(true)
    getSpots(userId, selectedId)
      .then(setSpots)
      .catch(() => {})
      .finally(() => setLoadingSpots(false))
  }, [selectedId, userId])

  const handleCreateRegion = async () => {
    const name = newRegionName.trim()
    if (!name) return
    if (!userId || userId.startsWith('user_')) {
      alert('로그인이 필요합니다. 새로고침 후 다시 시도해주세요.')
      return
    }
    const id = await createRegion(userId, name, newRegionEmoji)
    const r: TravelRegion = { id, userId, name, emoji: newRegionEmoji, spotCount: 0, createdAt: null }
    setRegions(prev => [r, ...prev])
    setSelectedId(id)
    setCreatingRegion(false)
    setNewRegionName('')
  }

  const handleRenameConfirm = async (id: string) => {
    if (!renameValue.trim()) return
    await renameRegion(id, renameValue.trim(), renameEmoji)
    setRegions(prev => prev.map(r => r.id === id ? { ...r, name: renameValue.trim(), emoji: renameEmoji } : r))
    setRenamingId(null)
  }

  const handleDeleteRegion = async (r: TravelRegion) => {
    if (!confirm(`"${r.name}" 폴더와 포함된 스팟을 모두 삭제할까요?`)) return
    try {
      await deleteRegion(r.id, userId)
      setRegions(prev => prev.filter(x => x.id !== r.id))
      if (selectedId === r.id) {
        const remaining = regions.filter(x => x.id !== r.id)
        setSelectedId(remaining[0]?.id ?? null)
      }
    } catch (e: any) {
      alert('삭제 실패: ' + (e.message || '알 수 없는 오류'))
    }
  }

  const handleAddSpot = async () => {
    if (!selectedId || !spotName.trim()) return
    setSavingSpot(true)
    try {
      const id = await addSpot(userId, selectedId, {
        name: spotName.trim(),
        address: spotAddress.trim() || undefined,
        description: spotDesc.trim() || undefined,
        sourceType: 'manual',
      })
      const newSpot: TravelSpot = {
        id, userId, regionId: selectedId,
        name: spotName.trim(),
        address: spotAddress.trim() || undefined,
        description: spotDesc.trim() || undefined,
        sourceType: 'manual',
        visited: false,
        createdAt: null,
      }
      setSpots(prev => [...prev, newSpot])
      setRegions(prev => prev.map(r => r.id === selectedId ? { ...r, spotCount: r.spotCount + 1 } : r))
      setSpotName(''); setSpotAddress(''); setSpotDesc('')
      setAddingSpot(false)
    } finally {
      setSavingSpot(false)
    }
  }

  const handleDeleteSpot = async (s: TravelSpot) => {
    await deleteSpot(s.id, s.regionId)
    setSpots(prev => prev.filter(x => x.id !== s.id))
    setRegions(prev => prev.map(r => r.id === s.regionId ? { ...r, spotCount: Math.max(0, r.spotCount - 1) } : r))
  }

  const handleToggle = async (s: TravelSpot) => {
    await toggleVisited(s.id, !s.visited)
    setSpots(prev => prev.map(x => x.id === s.id ? { ...x, visited: !x.visited } : x))
  }

  const kakaoMapUrl = (name: string) =>
    `https://map.kakao.com/?q=${encodeURIComponent(name)}`

  const selectedRegion = regions.find(r => r.id === selectedId)

  if (loadingRegions) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-10 h-10 rounded-full border-2 border-cyan-500/30 border-t-cyan-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex flex-col md:flex-row gap-6">
      {/* 지역 사이드바 */}
      <aside className="w-full md:w-56 shrink-0">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white font-bold text-sm">지역 폴더</h3>
          <button
            onClick={() => { setCreatingRegion(true); setNewRegionName(''); setNewRegionEmoji('📍') }}
            className="text-xs px-2.5 py-1.5 rounded-lg bg-cyan-500/15 text-cyan-400 hover:bg-cyan-500/25 font-bold transition-colors"
          >
            + 추가
          </button>
        </div>

        {creatingRegion && (
          <div className="mb-3 bg-white/5 border border-cyan-500/30 rounded-2xl p-3 space-y-2">
            <div className="flex gap-1 flex-wrap">
              {EMOJI_OPTIONS.map(e => (
                <button key={e} onClick={() => setNewRegionEmoji(e)}
                  className={`w-8 h-8 rounded-lg text-base flex items-center justify-center transition-all ${
                    newRegionEmoji === e ? 'bg-cyan-500/30 border border-cyan-500/50' : 'bg-white/5 hover:bg-white/10'
                  }`}>{e}</button>
              ))}
            </div>
            <input
              autoFocus value={newRegionName}
              onChange={e => setNewRegionName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreateRegion(); if (e.key === 'Escape') setCreatingRegion(false) }}
              placeholder="지역 이름..."
              className="w-full bg-[#23211f] border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500/40"
            />
            <div className="flex gap-1">
              <button onClick={handleCreateRegion} disabled={!newRegionName.trim()}
                className="flex-1 py-1.5 bg-cyan-500 hover:bg-cyan-600 disabled:bg-zinc-700 disabled:text-zinc-500 text-white text-xs font-bold rounded-xl transition-colors">
                만들기
              </button>
              <button onClick={() => setCreatingRegion(false)}
                className="px-3 py-1.5 bg-white/5 text-zinc-400 text-xs rounded-xl hover:bg-white/10">
                취소
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-row md:flex-col gap-1.5 overflow-x-auto md:overflow-visible pb-2 md:pb-0 scrollbar-none">
          {regions.map(r => (
            <div key={r.id} className="group/reg relative shrink-0">
              {renamingId === r.id ? (
                <div className="space-y-1.5 p-2 bg-white/5 rounded-2xl border border-cyan-500/30">
                  <div className="flex gap-1 flex-wrap">
                    {EMOJI_OPTIONS.map(e => (
                      <button key={e} onClick={() => setRenameEmoji(e)}
                        className={`w-7 h-7 rounded-lg text-sm flex items-center justify-center transition-all ${
                          renameEmoji === e ? 'bg-cyan-500/30 border border-cyan-500/50' : 'bg-white/5 hover:bg-white/10'
                        }`}>{e}</button>
                    ))}
                  </div>
                  <input
                    autoFocus value={renameValue}
                    onChange={e => setRenameValue(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleRenameConfirm(r.id); if (e.key === 'Escape') setRenamingId(null) }}
                    className="w-full bg-[#23211f] border border-white/10 rounded-xl px-2 py-1.5 text-xs text-white focus:outline-none"
                  />
                  <div className="flex gap-1">
                    <button onClick={() => handleRenameConfirm(r.id)} className="flex-1 py-1 bg-cyan-500 text-white text-[10px] font-bold rounded-lg">저장</button>
                    <button onClick={() => setRenamingId(null)} className="px-2 py-1 bg-white/5 text-zinc-400 text-[10px] rounded-lg">취소</button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setSelectedId(r.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-2xl whitespace-nowrap transition-all flex items-center gap-2 pr-8 ${
                    selectedId === r.id
                      ? 'bg-cyan-500/20 border border-cyan-500/40 text-white'
                      : 'bg-[#32302e] text-zinc-400 hover:bg-[#3d3a38] border border-transparent'
                  }`}
                >
                  <span className="text-base">{r.emoji}</span>
                  <span className="text-sm font-medium truncate">{r.name}</span>
                  <span className="ml-auto text-[10px] text-zinc-500 shrink-0">{r.spotCount}</span>
                </button>
              )}
              {renamingId !== r.id && (
                <div className="absolute right-1.5 top-1/2 -translate-y-1/2 hidden group-hover/reg:flex items-center gap-0.5">
                  <button
                    onClick={e => { e.stopPropagation(); setRenamingId(r.id); setRenameValue(r.name); setRenameEmoji(r.emoji) }}
                    className="w-6 h-6 rounded-lg bg-black/60 flex items-center justify-center text-[10px] text-zinc-400 hover:text-white"
                    title="이름 변경"
                  >✏️</button>
                  <button
                    onClick={e => { e.stopPropagation(); handleDeleteRegion(r) }}
                    className="w-6 h-6 rounded-lg bg-black/60 flex items-center justify-center text-[10px] text-zinc-400 hover:text-red-400"
                    title="삭제"
                  >🗑️</button>
                </div>
              )}
            </div>
          ))}
          {regions.length === 0 && (
            <p className="text-zinc-600 text-xs text-center py-4">+ 버튼으로 지역 폴더를 만들어보세요</p>
          )}
        </div>
      </aside>

      {/* 스팟 목록 */}
      <main className="flex-1 min-w-0">
        {!selectedId ? (
          <div className="text-center py-16 text-zinc-600">
            <p className="text-4xl mb-3">🗺️</p>
            <p>왼쪽에서 지역을 선택하거나 새로 만들어보세요.</p>
          </div>
        ) : (
          <>
            {/* 헤더 */}
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 min-w-0">
                <h3 className="text-white font-bold flex items-center gap-2">
                  <span className="text-xl">{selectedRegion?.emoji}</span>
                  <span className="truncate">{selectedRegion?.name}</span>
                  <span className="text-zinc-500 font-normal text-sm">({spots.length}개)</span>
                </h3>
              </div>
              <button
                onClick={() => { setAddingSpot(v => !v); setSpotName(''); setSpotAddress(''); setSpotDesc('') }}
                className="text-xs px-3 py-2 rounded-xl bg-cyan-500/15 text-cyan-400 hover:bg-cyan-500/25 font-bold transition-colors shrink-0"
              >
                + 스팟 추가
              </button>
              {spots.length > 0 && (
                <button
                  onClick={() => setShowWizard(true)}
                  className="text-xs px-3 py-2 rounded-xl bg-orange-500/15 text-orange-400 hover:bg-orange-500/25 font-bold transition-colors shrink-0 flex items-center gap-1.5"
                >
                  ✨ AI 일정
                </button>
              )}
            </div>

            {/* 스팟 수동 추가 폼 */}
            {addingSpot && (
              <div className="mb-4 bg-[#23211f] border border-cyan-500/30 rounded-2xl p-4 space-y-3">
                <p className="text-cyan-400 text-xs font-semibold">새 스팟 추가</p>
                <input
                  autoFocus value={spotName}
                  onChange={e => setSpotName(e.target.value)}
                  placeholder="장소명 *"
                  className="w-full bg-[#1c1a18] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500/40"
                />
                <input
                  value={spotAddress}
                  onChange={e => setSpotAddress(e.target.value)}
                  placeholder="주소 (선택)"
                  className="w-full bg-[#1c1a18] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500/40"
                />
                <textarea
                  value={spotDesc}
                  onChange={e => setSpotDesc(e.target.value)}
                  placeholder="메모 (선택)"
                  rows={2}
                  className="w-full bg-[#1c1a18] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500/40 resize-none"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleAddSpot}
                    disabled={!spotName.trim() || savingSpot}
                    className="flex-1 py-2.5 bg-cyan-500 hover:bg-cyan-600 disabled:bg-zinc-700 disabled:text-zinc-500 text-white text-sm font-bold rounded-xl transition-colors"
                  >
                    {savingSpot ? '저장 중...' : '저장'}
                  </button>
                  <button
                    onClick={() => setAddingSpot(false)}
                    className="px-4 py-2.5 bg-white/5 text-zinc-400 text-sm rounded-xl hover:bg-white/10 transition-colors"
                  >
                    취소
                  </button>
                </div>
              </div>
            )}

            {/* 스팟 목록 */}
            {loadingSpots ? (
              <div className="flex justify-center py-12">
                <div className="w-8 h-8 rounded-full border-2 border-cyan-500/30 border-t-cyan-500 animate-spin" />
              </div>
            ) : spots.length === 0 ? (
              <div className="text-center py-12 text-zinc-600">
                <p className="text-3xl mb-2">📍</p>
                <p className="text-sm">여행 영상에서 스팟을 찜하거나<br />직접 추가해보세요.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {spots.map(s => (
                  <div
                    key={s.id}
                    className={`flex items-start gap-3 bg-[#2a2826] border rounded-2xl p-4 transition-all ${
                      s.visited ? 'border-white/5 opacity-60' : 'border-white/8 hover:border-white/15'
                    }`}
                  >
                    {/* 방문 체크 */}
                    <button
                      onClick={() => handleToggle(s)}
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all ${
                        s.visited
                          ? 'bg-cyan-500 border-cyan-500 text-white'
                          : 'border-zinc-600 hover:border-cyan-400'
                      }`}
                    >
                      {s.visited && <span className="text-[10px]">✓</span>}
                    </button>

                    {/* 썸네일 */}
                    {s.thumbnail && (
                      <img src={s.thumbnail} alt="" className="w-16 h-12 rounded-xl object-cover shrink-0" />
                    )}

                    {/* 정보 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`font-semibold text-sm ${s.visited ? 'line-through text-zinc-500' : 'text-white'}`}>
                          {s.name}
                        </p>
                        <div className="flex items-center gap-1 shrink-0">
                          {/* 카카오맵 */}
                          <a
                            href={kakaoMapUrl(s.address || s.name)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-7 h-7 rounded-lg bg-yellow-500/20 flex items-center justify-center text-yellow-400 hover:bg-yellow-500/30 transition-colors text-xs"
                            title="카카오맵에서 보기"
                          >
                            지도
                          </a>
                          {/* 영상 출처 */}
                          {s.sourceSessionId && (
                            <a
                              href={`/result/${s.sourceSessionId}`}
                              className="w-7 h-7 rounded-lg bg-red-500/15 flex items-center justify-center text-red-400 hover:bg-red-500/25 transition-colors text-xs"
                              title="원본 영상"
                            >
                              ▶
                            </a>
                          )}
                          {/* 삭제 */}
                          <button
                            onClick={() => handleDeleteSpot(s)}
                            className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors text-xs"
                            title="삭제"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                      {s.address && <p className="text-zinc-500 text-xs mt-0.5">{s.address}</p>}
                      {s.description && <p className="text-zinc-400 text-xs mt-1 leading-relaxed">{s.description}</p>}
                      {s.videoTimestamp && s.sourceSessionId && (
                        <a
                          href={`/result/${s.sourceSessionId}?t=${s.videoTimestamp}`}
                          className="text-cyan-500/70 text-xs mt-1 inline-block hover:text-cyan-400"
                        >
                          ▶ 영상 {s.videoTimestamp}
                        </a>
                      )}
                      {s.sourceType === 'youtube' && (
                        <span className="inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400/70">유튜브</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 방문 완료 통계 */}
            {spots.length > 0 && (
              <div className="mt-4 flex items-center gap-3">
                <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-cyan-500 rounded-full transition-all"
                    style={{ width: `${(spots.filter(s => s.visited).length / spots.length) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-zinc-500 shrink-0">
                  {spots.filter(s => s.visited).length}/{spots.length} 방문 완료
                </span>
              </div>
            )}
          </>
        )}
      </main>

      {/* AI 일정 위자드 모달 */}
      {showWizard && selectedRegion && (
        <ItineraryWizardModal
          region={selectedRegion}
          spots={spots}
          onClose={() => setShowWizard(false)}
        />
      )}
    </div>
  )
}
