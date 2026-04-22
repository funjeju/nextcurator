'use client'

import { useState } from 'react'
import type { TravelRegion, TravelSpot } from '@/lib/travel'
import ItineraryDiary, { type ItineraryResult } from '@/components/travel/ItineraryDiary'
import { saveItinerary } from '@/lib/travelItinerary'
import { useAuth } from '@/providers/AuthProvider'

type Step = 'memo' | 'preview' | 'dates' | 'mode' | 'details' | 'generating' | 'result'
type Mode = 'spots_only' | 'with_recommendations' | 'memo_based'
type ArrivalTime = 'morning' | 'afternoon' | 'evening'
type AccomStatus = 'booked' | 'not_booked'

interface AccomEntry {
  status: AccomStatus | null
  details: string
  preferredArea: string
}

interface ParsedSpot {
  name: string
  note?: string
}

interface ParsedMemo {
  dates: { startDate: string; endDate: string } | null
  spots: ParsedSpot[]
  accommodations: Array<{ night: number; name: string; area?: string }> | null
  summary: string
}

interface Props {
  region: TravelRegion
  spots: TravelSpot[]
  onClose: () => void
}

const STEP_LABELS: Partial<Record<Step, string>> = {
  dates: '날짜',
  mode: '방식',
  details: '상세',
}

function calcNightsdays(start: string, end: string) {
  const s = new Date(start), e = new Date(end)
  const diff = Math.round((e.getTime() - s.getTime()) / 86400000)
  return { nights: Math.max(0, diff), days: Math.max(1, diff + 1) }
}

function formatDate(dateStr: string) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return `${d.getMonth() + 1}월 ${d.getDate()}일`
}

export default function ItineraryWizardModal({ region, spots, onClose }: Props) {
  const { user } = useAuth()
  const today = new Date().toISOString().split('T')[0]

  const [step, setStep] = useState<Step>('memo')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [mode, setMode] = useState<Mode | null>(null)
  const [arrivalTime, setArrivalTime] = useState<ArrivalTime | null>(null)
  const [accommodations, setAccommodations] = useState<AccomEntry[]>([])
  const [result, setResult] = useState<ItineraryResult | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // 메모 관련 상태
  const [memoText, setMemoText] = useState('')
  const [isParsing, setIsParsing] = useState(false)
  const [memoError, setMemoError] = useState('')
  const [parsedMemo, setParsedMemo] = useState<ParsedMemo | null>(null)

  const { nights, days } = startDate && endDate ? calcNightsdays(startDate, endDate) : { nights: 0, days: 0 }
  const canNextDates = startDate && endDate && endDate >= startDate

  // 메모 파싱
  const handleParseMemo = async () => {
    if (!memoText.trim()) return
    setIsParsing(true)
    setMemoError('')
    try {
      const res = await fetch('/api/parse-travel-memo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: memoText }),
      })
      if (!res.ok) throw new Error('파싱 실패')
      const data: ParsedMemo = await res.json()
      setParsedMemo(data)
      setStep('preview')
    } catch {
      setMemoError('메모 분석에 실패했습니다. 다시 시도해주세요.')
    } finally {
      setIsParsing(false)
    }
  }

  // 미리보기에서 "이 정보로 시작" 클릭
  const handlePreviewConfirm = () => {
    if (parsedMemo?.dates) {
      setStartDate(parsedMemo.dates.startDate)
      setEndDate(parsedMemo.dates.endDate)
    }
    setStep('mode')
  }

  // 모드 선택
  const handleModeSelect = (m: Mode) => {
    setMode(m)

    const effectiveNights = startDate && endDate ? calcNightsdays(startDate, endDate).nights : nights

    if (m === 'spots_only') {
      generate(m, spots)
      return
    }

    if (m === 'memo_based') {
      const memoSpots = parsedMemo?.spots ?? []
      const effectiveDays = startDate && endDate ? calcNightsdays(startDate, endDate).days : days
      const autoMode = memoSpots.length >= effectiveDays * 2 ? 'spots_only' : 'with_recommendations'

      // 숙소 슬롯 초기화 (파싱된 숙소 있으면 자동 채움)
      const accomSlots: AccomEntry[] = Array.from({ length: effectiveNights }, (_, i) => {
        const parsed = parsedMemo?.accommodations?.find(a => a.night === i + 1)
        if (parsed) {
          return { status: 'booked', details: parsed.name + (parsed.area ? ` (${parsed.area})` : ''), preferredArea: '' }
        }
        return { status: null, details: '', preferredArea: '' }
      })
      setAccommodations(accomSlots)

      if (autoMode === 'spots_only') {
        generate('spots_only', memoSpots.map(s => ({ name: s.name, address: '', description: s.note ?? '' })))
      } else {
        setStep('details')
      }
      return
    }

    // with_recommendations
    setAccommodations(Array.from({ length: effectiveNights }, (_, i) => {
      const parsed = parsedMemo?.accommodations?.find(a => a.night === i + 1)
      if (parsed) {
        return { status: 'booked', details: parsed.name + (parsed.area ? ` (${parsed.area})` : ''), preferredArea: '' }
      }
      return { status: null, details: '', preferredArea: '' }
    }))
    setStep('details')
  }

  const generate = async (selectedMode: 'spots_only' | 'with_recommendations', spotList?: Array<{ name: string; address: string; description: string }>) => {
    setStep('generating')
    setError('')
    try {
      const effectiveSpots = spotList ?? spots.map(s => ({ name: s.name, address: s.address, description: s.description ?? '' }))
      const { nights: n, days: d } = startDate && endDate ? calcNightsdays(startDate, endDate) : { nights, days }

      const body: Record<string, unknown> = {
        spots: effectiveSpots,
        regionName: region.name,
        startDate, endDate,
        nights: n, days: d,
        mode: selectedMode,
      }
      if (selectedMode === 'with_recommendations') {
        body.arrivalTime = arrivalTime
        body.accommodations = accommodations.map((a, i) => ({
          night: i + 1,
          status: a.status,
          details: a.details || undefined,
          preferredArea: a.preferredArea || undefined,
        }))
      }
      const res = await fetch('/api/travel-itinerary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      setResult(await res.json())
      setStep('result')
    } catch (e: unknown) {
      setError((e as Error).message || '일정 생성 실패')
      setStep('details')
    }
  }

  const handleDetailsSubmit = () => {
    if (!arrivalTime) return
    if (accommodations.some(a => !a.status)) return
    const memoSpotList = mode === 'memo_based'
      ? (parsedMemo?.spots ?? []).map(s => ({ name: s.name, address: '', description: s.note ?? '' }))
      : undefined
    generate('with_recommendations', memoSpotList)
  }

  const updateAccom = (i: number, patch: Partial<AccomEntry>) => {
    setAccommodations(prev => prev.map((a, idx) => idx === i ? { ...a, ...patch } : a))
  }

  const handleSave = async () => {
    if (!result || !user || saving || saved) return
    setSaving(true)
    try {
      const { nights: n, days: d } = calcNightsdays(startDate, endDate)
      await saveItinerary(user.uid, {
        regionName: region.name,
        regionEmoji: region.emoji,
        startDate, endDate,
        nights: n, days: d,
        mode: mode === 'memo_based' ? 'with_recommendations' : mode!,
        result,
      })
      setSaved(true)
    } catch {
      alert('저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const resetAll = () => {
    setStep('memo')
    setMode(null)
    setResult(null)
    setError('')
    setSaved(false)
    setParsedMemo(null)
    setMemoText('')
    setStartDate('')
    setEndDate('')
  }

  // 현재 표시할 스텝 인디케이터 목록
  const indicatorSteps: Step[] = ['dates', 'mode', ...(mode !== 'spots_only' && mode !== null ? ['details' as Step] : [])]
  const stepIdx = indicatorSteps.indexOf(step)

  return (
    <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-[#1c1a18] border border-white/10 rounded-3xl w-full max-w-lg max-h-[92vh] flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="shrink-0 px-6 pt-6 pb-4 border-b border-white/5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-white font-bold text-base">✨ AI 여행 일정 생성</h2>
              <p className="text-zinc-500 text-xs mt-0.5">{region.emoji} {region.name} · {spots.length}개 스팟</p>
            </div>
            <button onClick={onClose} className="text-zinc-500 hover:text-white text-xl leading-none">✕</button>
          </div>
          {/* 스텝 인디케이터 */}
          {step !== 'memo' && step !== 'preview' && step !== 'generating' && step !== 'result' && (
            <div className="flex items-center gap-1">
              {indicatorSteps.map((s, i) => (
                <div key={s} className="flex items-center gap-1">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                    s === step ? 'bg-orange-500 text-white' :
                    stepIdx > i ? 'bg-emerald-500/30 text-emerald-400' :
                    'bg-white/10 text-zinc-500'
                  }`}>
                    {stepIdx > i ? '✓' : i + 1}
                  </div>
                  <span className={`text-[10px] ${s === step ? 'text-white' : 'text-zinc-600'}`}>
                    {STEP_LABELS[s]}
                  </span>
                  {i < indicatorSteps.length - 1 && (
                    <div className="w-6 h-px bg-white/10 mx-0.5" />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 본문 */}
        <div className="flex-1 overflow-y-auto px-6 py-5">

          {/* ── STEP: MEMO ── */}
          {step === 'memo' && (
            <div className="space-y-4">
              <div>
                <p className="text-zinc-300 text-sm font-semibold mb-1">여행 메모를 붙여넣으세요</p>
                <p className="text-zinc-500 text-xs mb-3 leading-relaxed">
                  가고 싶은 곳, 날짜, 숙소 등 중구난방으로 적어둔 메모를 그대로 붙여넣으면 AI가 일정·스팟·숙소를 알아서 분류합니다.
                </p>
                <textarea
                  value={memoText}
                  onChange={e => setMemoText(e.target.value)}
                  placeholder={`예시:\n5월 3일~5일 제주도 여행\n- 성산일출봉 꼭 가기\n- 우도도 가고 싶음\n- 협재 해수욕장\n1박은 제주시 게스트하우스 예약함\n2박은 서귀포 쪽 숙소 알아봐야함\n카멜리아힐, 천지연폭포도 리스트에`}
                  rows={9}
                  className="w-full bg-[#2a2826] border border-white/10 rounded-2xl px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-orange-500/40 resize-none leading-relaxed"
                />
              </div>
              {memoError && (
                <p className="text-red-400 text-xs">{memoError}</p>
              )}
            </div>
          )}

          {/* ── STEP: PREVIEW ── */}
          {step === 'preview' && parsedMemo && (
            <div className="space-y-4">
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl px-4 py-3">
                <p className="text-emerald-300 text-xs font-semibold mb-0.5">AI 분석 완료</p>
                <p className="text-zinc-400 text-xs leading-relaxed">{parsedMemo.summary || '메모에서 정보를 추출했습니다.'}</p>
              </div>

              {/* 날짜 */}
              {parsedMemo.dates ? (
                <div className="bg-[#23211f] border border-white/8 rounded-2xl px-4 py-3">
                  <p className="text-zinc-500 text-[10px] font-semibold mb-1.5">📅 감지된 날짜</p>
                  <p className="text-white text-sm font-bold">
                    {formatDate(parsedMemo.dates.startDate)} → {formatDate(parsedMemo.dates.endDate)}
                    <span className="text-zinc-400 text-xs font-normal ml-2">
                      ({calcNightsdays(parsedMemo.dates.startDate, parsedMemo.dates.endDate).nights}박
                      {calcNightsdays(parsedMemo.dates.startDate, parsedMemo.dates.endDate).days}일)
                    </span>
                  </p>
                </div>
              ) : (
                <div className="bg-[#23211f] border border-white/8 rounded-2xl px-4 py-3">
                  <p className="text-zinc-500 text-[10px] font-semibold mb-1">📅 날짜</p>
                  <p className="text-zinc-500 text-xs">날짜 정보 없음 — 다음 단계에서 직접 입력</p>
                </div>
              )}

              {/* 스팟 */}
              <div className="bg-[#23211f] border border-white/8 rounded-2xl px-4 py-3">
                <p className="text-zinc-500 text-[10px] font-semibold mb-2">
                  📍 추출된 스팟 <span className="text-zinc-600 font-normal">({parsedMemo.spots.length}개)</span>
                </p>
                {parsedMemo.spots.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {parsedMemo.spots.map((s, i) => (
                      <span key={i} className="bg-orange-500/15 text-orange-300 text-xs px-2.5 py-1 rounded-full border border-orange-500/20">
                        {s.name}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-zinc-500 text-xs">스팟 없음 — 마이스팟 또는 AI 추천 사용</p>
                )}
              </div>

              {/* 숙소 */}
              {parsedMemo.accommodations && parsedMemo.accommodations.length > 0 && (
                <div className="bg-[#23211f] border border-white/8 rounded-2xl px-4 py-3">
                  <p className="text-zinc-500 text-[10px] font-semibold mb-2">🏨 감지된 숙소</p>
                  <div className="space-y-1">
                    {parsedMemo.accommodations.map((a, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-orange-500/20 text-orange-400 text-[9px] font-black flex items-center justify-center shrink-0">{a.night}</span>
                        <span className="text-zinc-300 text-xs">{a.name}{a.area && a.area !== a.name ? ` · ${a.area}` : ''}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── STEP: DATES ── */}
          {step === 'dates' && (
            <div className="space-y-5">
              <div>
                <p className="text-zinc-400 text-sm font-semibold mb-3">여행 날짜를 선택해주세요</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-zinc-500 text-xs mb-1.5 block">출발일</label>
                    <input
                      type="date"
                      value={startDate}
                      min={today}
                      onChange={e => {
                        setStartDate(e.target.value)
                        if (endDate && e.target.value > endDate) setEndDate('')
                      }}
                      className="w-full bg-[#2a2826] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500/40 [color-scheme:dark]"
                    />
                  </div>
                  <div>
                    <label className="text-zinc-500 text-xs mb-1.5 block">귀국일</label>
                    <input
                      type="date"
                      value={endDate}
                      min={startDate || today}
                      onChange={e => setEndDate(e.target.value)}
                      className="w-full bg-[#2a2826] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500/40 [color-scheme:dark]"
                    />
                  </div>
                </div>
              </div>
              {canNextDates && (
                <div className="bg-orange-500/10 border border-orange-500/20 rounded-2xl px-4 py-3 text-center">
                  <p className="text-orange-300 font-bold text-base">{nights}박 {days}일</p>
                  <p className="text-zinc-400 text-xs mt-0.5">{formatDate(startDate)} → {formatDate(endDate)}</p>
                </div>
              )}
            </div>
          )}

          {/* ── STEP: MODE ── */}
          {step === 'mode' && (
            <div className="space-y-3">
              <p className="text-zinc-400 text-sm font-semibold mb-4">일정 구성 방식을 선택해주세요</p>

              {/* 텍스트 기반 (파싱된 스팟이 있을 때만) */}
              {parsedMemo && parsedMemo.spots.length > 0 && (
                <button
                  onClick={() => handleModeSelect('memo_based')}
                  className="w-full text-left bg-[#23211f] border border-white/8 hover:border-emerald-500/40 hover:bg-emerald-500/5 rounded-2xl p-5 transition-all group"
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl mt-0.5">📝</span>
                    <div>
                      <p className="text-white font-bold text-sm group-hover:text-emerald-300 transition-colors">메모 스팟으로 일정 짜기</p>
                      <p className="text-zinc-500 text-xs mt-1 leading-relaxed">
                        메모에서 추출된 {parsedMemo.spots.length}개 스팟 중심으로 일정을 구성합니다.
                        {parsedMemo.spots.length < (days || 1) * 2 && ' 스팟이 적으면 AI가 동선에 맞는 스팟을 보완합니다.'}
                      </p>
                    </div>
                  </div>
                </button>
              )}

              <button
                onClick={() => handleModeSelect('spots_only')}
                className="w-full text-left bg-[#23211f] border border-white/8 hover:border-cyan-500/40 hover:bg-cyan-500/5 rounded-2xl p-5 transition-all group"
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl mt-0.5">📍</span>
                  <div>
                    <p className="text-white font-bold text-sm group-hover:text-cyan-300 transition-colors">마이스팟만으로 일정 짜기</p>
                    <p className="text-zinc-500 text-xs mt-1 leading-relaxed">저장된 {spots.length}개 스팟만 활용해 최적 동선으로 러프하게 구성합니다.</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => handleModeSelect('with_recommendations')}
                className="w-full text-left bg-[#23211f] border border-white/8 hover:border-orange-500/40 hover:bg-orange-500/5 rounded-2xl p-5 transition-all group"
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl mt-0.5">✨</span>
                  <div>
                    <p className="text-white font-bold text-sm group-hover:text-orange-300 transition-colors">AI 추천 스팟도 함께 포함</p>
                    <p className="text-zinc-500 text-xs mt-1 leading-relaxed">마이스팟을 기반으로 빈 시간대에 주변 추천 명소를 채워 더 풍성한 일정을 만듭니다.</p>
                  </div>
                </div>
              </button>
            </div>
          )}

          {/* ── STEP: DETAILS ── */}
          {step === 'details' && (
            <div className="space-y-6">
              {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2.5 text-red-400 text-xs">{error}</div>
              )}

              {/* 도착 시간대 */}
              <div>
                <p className="text-zinc-400 text-sm font-semibold mb-3">첫날 도착 예정 시간대</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'morning' as ArrivalTime, label: '오전', sub: '12시 이전', icon: '🌅' },
                    { id: 'afternoon' as ArrivalTime, label: '오후', sub: '12~18시', icon: '☀️' },
                    { id: 'evening' as ArrivalTime, label: '저녁', sub: '18시 이후', icon: '🌙' },
                  ].map(a => (
                    <button
                      key={a.id}
                      onClick={() => setArrivalTime(a.id)}
                      className={`py-3 rounded-2xl border text-xs font-semibold transition-all flex flex-col items-center gap-1 ${
                        arrivalTime === a.id
                          ? 'bg-orange-500/20 border-orange-500/50 text-orange-300'
                          : 'bg-[#23211f] border-white/8 text-zinc-400 hover:border-white/20 hover:text-white'
                      }`}
                    >
                      <span className="text-xl">{a.icon}</span>
                      <span>{a.label}</span>
                      <span className="text-[10px] opacity-60">{a.sub}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 박수별 숙소 */}
              <div>
                <p className="text-zinc-400 text-sm font-semibold mb-1">
                  숙소 정보 <span className="text-zinc-600 font-normal text-xs">({nights}박 각각 입력)</span>
                </p>
                <p className="text-zinc-600 text-xs mb-3">숙소 위치에 따라 날짜별 동선이 달라집니다</p>
                <div className="space-y-3">
                  {accommodations.map((accom, i) => (
                    <div key={i} className="bg-[#23211f] border border-white/8 rounded-2xl p-3 space-y-2.5">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-orange-500/20 text-orange-400 text-[10px] font-black flex items-center justify-center shrink-0">
                          {i + 1}
                        </span>
                        <span className="text-zinc-300 text-xs font-semibold flex-1">
                          {i + 1}박째 숙소
                          <span className="text-zinc-600 font-normal ml-1">(Day {i + 1} → Day {i + 2})</span>
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        {[
                          { id: 'booked' as AccomStatus, label: '예약 완료', icon: '🏨' },
                          { id: 'not_booked' as AccomStatus, label: '미예약', icon: '🔍' },
                        ].map(opt => (
                          <button
                            key={opt.id}
                            onClick={() => updateAccom(i, { status: opt.id })}
                            className={`py-2 rounded-xl border text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                              accom.status === opt.id
                                ? 'bg-orange-500/20 border-orange-500/50 text-orange-300'
                                : 'bg-[#2a2826] border-white/8 text-zinc-500 hover:border-white/20 hover:text-white'
                            }`}
                          >
                            <span>{opt.icon}</span>{opt.label}
                          </button>
                        ))}
                      </div>
                      {accom.status === 'booked' && (
                        <input
                          value={accom.details}
                          onChange={e => updateAccom(i, { details: e.target.value })}
                          placeholder="숙소명 또는 위치 (선택)"
                          className="w-full bg-[#2a2826] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-orange-500/40"
                        />
                      )}
                      {accom.status === 'not_booked' && (
                        <input
                          value={accom.preferredArea}
                          onChange={e => updateAccom(i, { preferredArea: e.target.value })}
                          placeholder="선호 지역 (비우면 AI가 동선 기반 추천)"
                          className="w-full bg-[#2a2826] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-orange-500/40"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── STEP: GENERATING ── */}
          {step === 'generating' && (
            <div className="flex flex-col items-center gap-5 py-12 text-center">
              <div className="relative w-16 h-16">
                <div className="absolute inset-0 rounded-full border-2 border-orange-500/20 border-t-orange-500 animate-spin" />
                <div className="absolute inset-2 rounded-full border-2 border-cyan-500/20 border-b-cyan-500 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
                <span className="absolute inset-0 flex items-center justify-center text-xl">✈️</span>
              </div>
              <div>
                <p className="text-white font-bold mb-1">최적 여행 일정 생성 중...</p>
                <p className="text-zinc-500 text-sm">스팟 동선을 분석하고 일정을 구성하고 있습니다</p>
              </div>
            </div>
          )}

          {/* ── STEP: RESULT ── */}
          {step === 'result' && result && (
            <ItineraryDiary
              result={result}
              regionName={region.name}
              regionEmoji={region.emoji}
              startDate={startDate}
              endDate={endDate}
              nights={nights}
              days={days}
              mode={mode === 'memo_based' ? 'with_recommendations' : mode!}
            />
          )}
        </div>

        {/* 푸터 */}
        <div className="shrink-0 px-6 py-4 border-t border-white/5 flex gap-2">

          {/* 뒤로 가기 */}
          {step === 'preview' && (
            <button onClick={() => setStep('memo')} className="px-4 h-10 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 text-xs transition-colors">
              ← 다시 입력
            </button>
          )}
          {step === 'dates' && (
            <button onClick={() => setStep(parsedMemo ? 'preview' : 'memo')} className="px-4 h-10 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 text-xs transition-colors">
              ← 이전
            </button>
          )}
          {step === 'mode' && (
            <button onClick={() => setStep('dates')} className="px-4 h-10 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 text-xs transition-colors">
              ← 이전
            </button>
          )}
          {step === 'details' && (
            <button onClick={() => setStep('mode')} className="px-4 h-10 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 text-xs transition-colors">
              ← 이전
            </button>
          )}
          {step === 'result' && (
            <button onClick={resetAll} className="px-4 h-10 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 text-xs transition-colors">
              🔄 다시 생성
            </button>
          )}

          <div className="flex-1" />

          {/* 메모 단계 */}
          {step === 'memo' && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setStep('dates')}
                className="px-4 h-10 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 text-xs transition-colors"
              >
                건너뛰기
              </button>
              <button
                onClick={handleParseMemo}
                disabled={!memoText.trim() || isParsing}
                className="px-5 h-10 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:bg-zinc-700 disabled:text-zinc-500 text-white text-sm font-bold transition-colors flex items-center gap-2"
              >
                {isParsing ? (
                  <>
                    <span className="w-3.5 h-3.5 rounded-full border border-white/40 border-t-white animate-spin" />
                    분석 중...
                  </>
                ) : '🔍 분석하기'}
              </button>
            </div>
          )}

          {/* 미리보기 단계 */}
          {step === 'preview' && (
            <button
              onClick={handlePreviewConfirm}
              className="px-6 h-10 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold transition-colors"
            >
              이 정보로 시작 →
            </button>
          )}

          {/* 날짜 단계 */}
          {step === 'dates' && (
            <button
              onClick={() => setStep('mode')}
              disabled={!canNextDates}
              className="px-6 h-10 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:bg-zinc-700 disabled:text-zinc-500 text-white text-sm font-bold transition-colors"
            >
              다음 →
            </button>
          )}

          {/* 상세 단계 */}
          {step === 'details' && (
            <button
              onClick={handleDetailsSubmit}
              disabled={!arrivalTime || accommodations.some(a => !a.status)}
              className="px-6 h-10 rounded-xl bg-gradient-to-r from-orange-500 to-pink-500 hover:opacity-90 disabled:opacity-40 text-white text-sm font-bold transition-all"
            >
              ✨ 일정 생성하기
            </button>
          )}

          {/* 결과 단계 */}
          {step === 'result' && (
            <div className="flex items-center gap-2">
              {user && (
                <button
                  onClick={handleSave}
                  disabled={saving || saved}
                  className={`px-4 h-10 rounded-xl text-sm font-bold transition-all flex items-center gap-1.5 ${
                    saved
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 cursor-default'
                      : 'bg-white/8 hover:bg-white/15 text-zinc-300 border border-white/10 disabled:opacity-50'
                  }`}
                >
                  {saving ? (
                    <span className="w-3.5 h-3.5 rounded-full border border-zinc-400 border-t-transparent animate-spin" />
                  ) : saved ? '✓ 저장됨' : '💾 저장'}
                </button>
              )}
              <button
                onClick={onClose}
                className="px-6 h-10 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold transition-colors"
              >
                닫기
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
