'use client'

import { useState } from 'react'
import type { TravelRegion, TravelSpot } from '@/lib/travel'
import ItineraryDiary, { type ItineraryResult } from '@/components/travel/ItineraryDiary'
import { saveItinerary } from '@/lib/travelItinerary'
import { useAuth } from '@/providers/AuthProvider'

type Step = 'dates' | 'mode' | 'details' | 'generating' | 'result'
type Mode = 'spots_only' | 'with_recommendations'
type ArrivalTime = 'morning' | 'afternoon' | 'evening'
type AccomStatus = 'booked' | 'not_booked'

interface AccomEntry {
  status: AccomStatus | null
  details: string       // 예약완료 시 숙소명/위치
  preferredArea: string // 미예약 시 선호 지역
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
  const { user } = useAuth()
  const today = new Date().toISOString().split('T')[0]
  const [step, setStep] = useState<Step>('dates')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [mode, setMode] = useState<Mode | null>(null)
  const [arrivalTime, setArrivalTime] = useState<ArrivalTime | null>(null)
  const [accommodations, setAccommodations] = useState<AccomEntry[]>([])
  const [result, setResult] = useState<ItineraryResult | null>(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

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
      // 박수만큼 숙소 슬롯 초기화
      setAccommodations(
        Array.from({ length: nights }, () => ({ status: null, details: '', preferredArea: '' }))
      )
      setStep('details')
    }
  }

  const handleDetailsSubmit = () => {
    if (!arrivalTime) return
    if (accommodations.some(a => !a.status)) return
    generate('with_recommendations')
  }

  const updateAccom = (i: number, patch: Partial<AccomEntry>) => {
    setAccommodations(prev => prev.map((a, idx) => idx === i ? { ...a, ...patch } : a))
  }

  const handleSave = async () => {
    if (!result || !user || saving || saved) return
    setSaving(true)
    try {
      await saveItinerary(user.uid, {
        regionName: region.name,
        regionEmoji: region.emoji,
        startDate,
        endDate,
        nights,
        days,
        mode: mode!,
        result,
      })
      setSaved(true)
    } catch {
      alert('저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
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

              {/* 박수별 숙소 */}
              <div>
                <p className="text-zinc-400 text-sm font-semibold mb-1">숙소 정보 <span className="text-zinc-600 font-normal text-xs">({nights}박 각각 입력)</span></p>
                <p className="text-zinc-600 text-xs mb-3">숙소 위치에 따라 날짜별 동선이 달라집니다</p>
                <div className="space-y-3">
                  {accommodations.map((accom, i) => (
                    <div key={i} className="bg-[#23211f] border border-white/8 rounded-2xl p-3 space-y-2.5">
                      {/* 박 레이블 + 상태 토글 */}
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-orange-500/20 text-orange-400 text-[10px] font-black flex items-center justify-center shrink-0">
                          {i + 1}
                        </span>
                        <span className="text-zinc-300 text-xs font-semibold flex-1">
                          {i + 1}박째 숙소
                          <span className="text-zinc-600 font-normal ml-1">
                            (Day {i + 1} → Day {i + 2})
                          </span>
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
              mode={mode!}
            />
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
              onClick={() => { setStep('dates'); setMode(null); setResult(null); setError(''); setSaved(false) }}
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
              disabled={!arrivalTime || accommodations.some(a => !a.status)}
              className="px-6 h-10 rounded-xl bg-gradient-to-r from-orange-500 to-pink-500 hover:opacity-90 disabled:opacity-40 text-white text-sm font-bold transition-all"
            >
              ✨ 일정 생성하기
            </button>
          )}
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
