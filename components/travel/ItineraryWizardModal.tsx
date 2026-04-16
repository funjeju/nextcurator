'use client'

import { useState } from 'react'
import type { TravelRegion, TravelSpot } from '@/lib/travel'

type Step = 'dates' | 'mode' | 'details' | 'generating' | 'result'
type Mode = 'spots_only' | 'with_recommendations'
type ArrivalTime = 'morning' | 'afternoon' | 'evening'
type AccomStatus = 'booked' | 'not_booked'

interface ItinerarySlot {
  time: string
  spotName: string
  activity: string
  tip?: string
  isRecommended?: boolean
}
interface ItineraryDay {
  day: number
  date?: string
  summary: string
  slots: ItinerarySlot[]
}
interface ItineraryResult {
  days: ItineraryDay[]
  overall_tip: string
  accommodation_suggestion?: string | null
  transport_tips?: string
}

interface Props {
  region: TravelRegion
  spots: TravelSpot[]
  onClose: () => void
}

const STEP_LABELS: Record<Step, string> = {
  dates: '날짜',
  mode: '방식',
  details: '상세',
  generating: '생성',
  result: '결과',
}
const STEPS_WITH_DETAILS: Step[] = ['dates', 'mode', 'details', 'generating', 'result']
const STEPS_NO_DETAILS: Step[] = ['dates', 'mode', 'generating', 'result']

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
  const today = new Date().toISOString().split('T')[0]
  const [step, setStep] = useState<Step>('dates')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [mode, setMode] = useState<Mode | null>(null)
  const [arrivalTime, setArrivalTime] = useState<ArrivalTime | null>(null)
  const [accomStatus, setAccomStatus] = useState<AccomStatus | null>(null)
  const [accomDetails, setAccomDetails] = useState('')
  const [preferredArea, setPreferredArea] = useState('')
  const [result, setResult] = useState<ItineraryResult | null>(null)
  const [error, setError] = useState('')

  const { nights, days } = startDate && endDate ? calcNightsdays(startDate, endDate) : { nights: 0, days: 0 }
  const steps = mode === 'spots_only' ? STEPS_NO_DETAILS : STEPS_WITH_DETAILS
  const stepIdx = steps.indexOf(step)

  const generate = async (selectedMode: Mode) => {
    setStep('generating')
    setError('')
    try {
      const body: any = {
        spots: spots.map(s => ({ name: s.name, address: s.address, description: s.description })),
        regionName: region.name,
        startDate, endDate, nights, days,
        mode: selectedMode,
      }
      if (selectedMode === 'with_recommendations') {
        body.arrivalTime = arrivalTime
        body.accommodation = { status: accomStatus, details: accomDetails || undefined }
        body.preferredArea = preferredArea || undefined
      }
      const res = await fetch('/api/travel-itinerary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      setResult(await res.json())
      setStep('result')
    } catch (e: any) {
      setError(e.message || '일정 생성 실패')
      setStep('details')
    }
  }

  const handleModeSelect = (m: Mode) => {
    setMode(m)
    if (m === 'spots_only') {
      generate(m)
    } else {
      setStep('details')
    }
  }

  const handleDetailsSubmit = () => {
    if (!arrivalTime) return
    if (!accomStatus) return
    generate('with_recommendations')
  }

  const canNextDates = startDate && endDate && endDate >= startDate

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
          {step !== 'generating' && step !== 'result' && (
            <div className="flex items-center gap-1">
              {(['dates', 'mode', ...(mode !== 'spots_only' ? ['details'] : [])] as Step[]).map((s, i) => (
                <div key={s} className="flex items-center gap-1">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                    s === step ? 'bg-orange-500 text-white' :
                    steps.indexOf(s) < stepIdx ? 'bg-emerald-500/30 text-emerald-400' :
                    'bg-white/10 text-zinc-500'
                  }`}>
                    {steps.indexOf(s) < stepIdx ? '✓' : i + 1}
                  </div>
                  <span className={`text-[10px] ${s === step ? 'text-white' : 'text-zinc-600'}`}>
                    {STEP_LABELS[s]}
                  </span>
                  {i < (['dates', 'mode', ...(mode !== 'spots_only' ? ['details'] : [])] as Step[]).length - 1 && (
                    <div className="w-6 h-px bg-white/10 mx-0.5" />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 본문 */}
        <div className="flex-1 overflow-y-auto px-6 py-5">

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

              {/* 숙소 예약 여부 */}
              <div>
                <p className="text-zinc-400 text-sm font-semibold mb-3">숙소 예약 상태</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'booked' as AccomStatus, label: '예약 완료', icon: '🏨' },
                    { id: 'not_booked' as AccomStatus, label: '아직 미예약', icon: '🔍' },
                  ].map(a => (
                    <button
                      key={a.id}
                      onClick={() => setAccomStatus(a.id)}
                      className={`py-3 rounded-2xl border text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                        accomStatus === a.id
                          ? 'bg-orange-500/20 border-orange-500/50 text-orange-300'
                          : 'bg-[#23211f] border-white/8 text-zinc-400 hover:border-white/20 hover:text-white'
                      }`}
                    >
                      <span>{a.icon}</span>{a.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 숙소 예약 완료: 위치 입력 */}
              {accomStatus === 'booked' && (
                <div>
                  <label className="text-zinc-500 text-xs mb-1.5 block">숙소 이름 또는 위치 <span className="text-zinc-600">(선택)</span></label>
                  <input
                    value={accomDetails}
                    onChange={e => setAccomDetails(e.target.value)}
                    placeholder="예: 제주시 연동 호텔, 성산 게스트하우스..."
                    className="w-full bg-[#2a2826] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-orange-500/40"
                  />
                </div>
              )}

              {/* 숙소 미예약: 선호 지역 */}
              {accomStatus === 'not_booked' && (
                <div>
                  <label className="text-zinc-500 text-xs mb-1.5 block">선호 숙소 지역 <span className="text-zinc-600">(선택 — 비우면 AI가 동선 기반으로 추천)</span></label>
                  <input
                    value={preferredArea}
                    onChange={e => setPreferredArea(e.target.value)}
                    placeholder="예: 제주시내, 성산 근처, 서귀포..."
                    className="w-full bg-[#2a2826] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-orange-500/40"
                  />
                  <p className="text-zinc-600 text-xs mt-1.5">비워두면 AI가 스팟 동선을 분석해 최적 숙소 위치를 추천해드립니다.</p>
                </div>
              )}
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
            <div className="space-y-5">
              {/* 요약 배지 */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs px-2.5 py-1 rounded-lg bg-orange-500/15 text-orange-400 border border-orange-500/20 font-semibold">
                  {nights}박 {days}일
                </span>
                <span className="text-xs px-2.5 py-1 rounded-lg bg-zinc-700 text-zinc-300 font-semibold">
                  {formatDate(startDate)} → {formatDate(endDate)}
                </span>
                {mode === 'with_recommendations' && (
                  <span className="text-xs px-2.5 py-1 rounded-lg bg-cyan-500/15 text-cyan-400 border border-cyan-500/20 font-semibold">
                    AI 추천 포함
                  </span>
                )}
              </div>

              {/* 숙소 추천 (미예약 + AI 추천이 있을 때) */}
              {result.accommodation_suggestion && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl px-4 py-3">
                  <p className="text-amber-400 text-[10px] font-bold uppercase tracking-wider mb-1">🏨 숙소 추천</p>
                  <p className="text-zinc-300 text-sm leading-relaxed">{result.accommodation_suggestion}</p>
                </div>
              )}

              {/* 날짜별 일정 */}
              {result.days.map(day => (
                <div key={day.day}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-7 h-7 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 text-white text-xs font-black flex items-center justify-center shrink-0">
                      {day.day}
                    </span>
                    <div>
                      <p className="text-white font-semibold text-sm">{day.summary}</p>
                      {day.date && <p className="text-zinc-600 text-xs">{formatDate(day.date)}</p>}
                    </div>
                  </div>
                  <div className="space-y-2 ml-9">
                    {day.slots.map((slot, i) => (
                      <div key={i} className={`flex gap-3 rounded-2xl p-3 ${slot.isRecommended ? 'bg-cyan-500/5 border border-cyan-500/15' : 'bg-white/4 border border-white/5'}`}>
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

              {/* 이동수단 팁 */}
              {result.transport_tips && (
                <div className="bg-white/4 border border-white/8 rounded-2xl px-4 py-3">
                  <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider mb-1">🚗 이동 팁</p>
                  <p className="text-zinc-300 text-sm leading-relaxed">{result.transport_tips}</p>
                </div>
              )}

              {/* 전체 꿀팁 */}
              {result.overall_tip && (
                <div className="bg-orange-500/8 border border-orange-500/15 rounded-2xl px-4 py-3">
                  <p className="text-orange-400 text-[10px] font-bold uppercase tracking-wider mb-1">✨ 전체 꿀팁</p>
                  <p className="text-zinc-300 text-sm leading-relaxed">{result.overall_tip}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="shrink-0 px-6 py-4 border-t border-white/5 flex gap-2">
          {/* 뒤로 가기 */}
          {(step === 'mode' || step === 'details') && (
            <button
              onClick={() => setStep(step === 'details' ? 'mode' : 'dates')}
              className="px-4 h-10 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 text-xs transition-colors"
            >
              ← 이전
            </button>
          )}
          {step === 'result' && (
            <button
              onClick={() => { setStep('dates'); setMode(null); setResult(null); setError('') }}
              className="px-4 h-10 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 text-xs transition-colors"
            >
              🔄 다시 생성
            </button>
          )}

          <div className="flex-1" />

          {/* 다음 / 생성 */}
          {step === 'dates' && (
            <button
              onClick={() => setStep('mode')}
              disabled={!canNextDates}
              className="px-6 h-10 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:bg-zinc-700 disabled:text-zinc-500 text-white text-sm font-bold transition-colors"
            >
              다음 →
            </button>
          )}
          {step === 'details' && (
            <button
              onClick={handleDetailsSubmit}
              disabled={!arrivalTime || !accomStatus}
              className="px-6 h-10 rounded-xl bg-gradient-to-r from-orange-500 to-pink-500 hover:opacity-90 disabled:opacity-40 text-white text-sm font-bold transition-all"
            >
              ✨ 일정 생성하기
            </button>
          )}
          {step === 'result' && (
            <button
              onClick={onClose}
              className="px-6 h-10 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold transition-colors"
            >
              닫기
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
