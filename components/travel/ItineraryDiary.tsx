'use client'

import { useRef, useState } from 'react'

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
  region?: string
  slots: ItinerarySlot[]
}
export interface ItineraryResult {
  days: ItineraryDay[]
  overall_tip: string
  accommodation_suggestion?: string | null
  transport_tips?: string
}

interface Props {
  result: ItineraryResult
  regionName: string
  regionEmoji: string
  startDate: string
  endDate: string
  nights: number
  days: number
  mode: string
}

function formatDate(dateStr: string) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}`
}

function formatDateShort(dateStr: string) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const days = ['일', '월', '화', '수', '목', '금', '토']
  return `${d.getMonth() + 1}/${d.getDate()} (${days[d.getDay()]})`
}

const DAY_COLORS = [
  { bg: 'bg-rose-500',    light: 'bg-rose-500/10',    border: 'border-rose-500/30',    text: 'text-rose-400'    },
  { bg: 'bg-orange-500',  light: 'bg-orange-500/10',  border: 'border-orange-500/30',  text: 'text-orange-400'  },
  { bg: 'bg-amber-500',   light: 'bg-amber-500/10',   border: 'border-amber-500/30',   text: 'text-amber-400'   },
  { bg: 'bg-emerald-500', light: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400' },
  { bg: 'bg-cyan-500',    light: 'bg-cyan-500/10',    border: 'border-cyan-500/30',    text: 'text-cyan-400'    },
  { bg: 'bg-violet-500',  light: 'bg-violet-500/10',  border: 'border-violet-500/30',  text: 'text-violet-400'  },
  { bg: 'bg-pink-500',    light: 'bg-pink-500/10',    border: 'border-pink-500/30',    text: 'text-pink-400'    },
]

export default function ItineraryDiary({ result, regionName, regionEmoji, startDate, endDate, nights, days, mode }: Props) {
  const diaryRef = useRef<HTMLDivElement>(null)
  const [downloading, setDownloading] = useState(false)

  const handleDownloadPdf = async () => {
    if (!diaryRef.current || downloading) return
    setDownloading(true)
    try {
      const html2canvas = (await import('html2canvas')).default
      const { jsPDF } = await import('jspdf')

      const el = diaryRef.current
      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#1a1614',
        logging: false,
        width: el.scrollWidth,
        height: el.scrollHeight,
        windowWidth: el.scrollWidth,
        windowHeight: el.scrollHeight,
      })

      const imgData = canvas.toDataURL('image/jpeg', 0.95)
      const pdfW = 210  // A4 mm
      const pdfH = (canvas.height * pdfW) / canvas.width

      const pdf = new jsPDF({ orientation: pdfH > pdfW ? 'p' : 'l', unit: 'mm', format: [pdfW, pdfH] })
      pdf.addImage(imgData, 'JPEG', 0, 0, pdfW, pdfH)
      pdf.save(`제주여행_${startDate}_${nights}박${days}일.pdf`)
    } catch (e) {
      console.error(e)
      alert('PDF 저장에 실패했습니다.')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* PDF 다운로드 버튼 */}
      <div className="flex justify-end">
        <button
          onClick={handleDownloadPdf}
          disabled={downloading}
          className="flex items-center gap-2 px-4 py-2 bg-white/8 hover:bg-white/15 border border-white/10 rounded-xl text-sm text-zinc-300 hover:text-white transition-all disabled:opacity-50"
        >
          {downloading ? (
            <><span className="w-3.5 h-3.5 rounded-full border border-zinc-400 border-t-transparent animate-spin" /> 저장 중...</>
          ) : (
            <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg> PDF 저장</>
          )}
        </button>
      </div>

      {/* ── 다이어리 본문 (PDF 캡처 대상) ── */}
      <div ref={diaryRef} className="bg-[#1a1614] rounded-3xl overflow-hidden" style={{ fontFamily: 'sans-serif' }}>

        {/* 커버 헤더 */}
        <div className="relative bg-gradient-to-br from-orange-600 via-pink-600 to-violet-700 px-6 py-8 text-white overflow-hidden">
          {/* 배경 패턴 */}
          <div className="absolute inset-0 opacity-10">
            {['✈️','🌴','🗺️','📍','🌊','🏔️','☀️'].map((e, i) => (
              <span key={i} className="absolute text-4xl select-none"
                style={{ left: `${10 + i * 13}%`, top: `${20 + (i % 3) * 25}%`, transform: `rotate(${i * 15 - 30}deg)` }}
              >{e}</span>
            ))}
          </div>
          <div className="relative">
            <p className="text-white/60 text-xs font-semibold tracking-[0.2em] uppercase mb-1">Travel Diary</p>
            <h1 className="text-2xl font-black mb-1">{regionEmoji} {regionName}</h1>
            <p className="text-white/80 text-sm">{formatDate(startDate)} — {formatDate(endDate)}</p>
            <div className="flex items-center gap-3 mt-4">
              <span className="px-3 py-1 bg-white/20 backdrop-blur rounded-full text-xs font-bold">
                {nights}박 {days}일
              </span>
              {mode === 'with_recommendations' && (
                <span className="px-3 py-1 bg-white/20 backdrop-blur rounded-full text-xs font-bold">
                  ✨ AI 큐레이션
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 숙소 추천 */}
        {result.accommodation_suggestion && (
          <div className="mx-5 mt-5 bg-amber-500/10 border border-amber-500/20 rounded-2xl px-4 py-3 flex gap-3">
            <span className="text-xl shrink-0">🏨</span>
            <div>
              <p className="text-amber-400 text-xs font-bold mb-0.5">숙소 추천</p>
              <p className="text-zinc-300 text-xs leading-relaxed">{result.accommodation_suggestion}</p>
            </div>
          </div>
        )}

        {/* 날짜별 일정 */}
        <div className="px-5 pt-5 pb-2 space-y-6">
          {result.days.map((day, di) => {
            const color = DAY_COLORS[di % DAY_COLORS.length]
            return (
              <div key={day.day}>
                {/* 날짜 헤더 */}
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-10 h-10 rounded-2xl ${color.bg} flex flex-col items-center justify-center shrink-0 shadow-lg`}>
                    <span className="text-white text-[9px] font-bold leading-none opacity-80">DAY</span>
                    <span className="text-white text-base font-black leading-none">{day.day}</span>
                  </div>
                  <div>
                    <p className="text-white font-bold text-sm leading-tight">{day.summary}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {day.date && <p className="text-zinc-500 text-xs">{formatDateShort(day.date)}</p>}
                      {day.region && <span className={`text-[10px] px-2 py-0.5 rounded-full ${color.light} ${color.text} ${color.border} border font-semibold`}>{day.region}</span>}
                    </div>
                  </div>
                </div>

                {/* 타임라인 */}
                <div className="relative pl-5">
                  {/* 세로선 */}
                  <div className={`absolute left-[7px] top-2 bottom-2 w-0.5 ${color.bg} opacity-20 rounded-full`} />

                  <div className="space-y-3">
                    {day.slots.map((slot, si) => (
                      <div key={si} className="relative flex gap-3">
                        {/* 타임라인 도트 */}
                        <div className={`absolute -left-5 top-3 w-3.5 h-3.5 rounded-full border-2 ${
                          slot.isRecommended ? 'bg-[#1a1614] border-cyan-500' : `bg-[#1a1614] ${color.border.replace('border-', 'border-')} border-2`
                        } shrink-0 z-10`}
                          style={{ borderColor: slot.isRecommended ? 'rgb(6 182 212)' : undefined }}
                        />

                        {/* 슬롯 카드 */}
                        <div className={`flex-1 rounded-2xl p-3.5 border ${
                          slot.isRecommended
                            ? 'bg-cyan-500/5 border-cyan-500/15'
                            : `${color.light} ${color.border}`
                        }`}>
                          <div className="flex items-start justify-between gap-2 mb-1.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-xs font-bold ${color.text}`}>{slot.time}</span>
                              <p className="text-white font-semibold text-sm">{slot.spotName}</p>
                              {slot.isRecommended && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-400 font-bold border border-cyan-500/20">AI추천</span>
                              )}
                            </div>
                          </div>
                          <p className="text-zinc-400 text-xs leading-relaxed">{slot.activity}</p>
                          {slot.tip && (
                            <div className="mt-2 flex gap-1.5">
                              <span className="text-amber-400 text-xs">💡</span>
                              <p className="text-amber-300/80 text-xs leading-relaxed">{slot.tip}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 날짜 구분선 */}
                {di < result.days.length - 1 && (
                  <div className="flex items-center gap-3 mt-5">
                    <div className="flex-1 h-px bg-white/5" />
                    <span className="text-zinc-700 text-xs">✦</span>
                    <div className="flex-1 h-px bg-white/5" />
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* 하단 팁 영역 */}
        <div className="px-5 pb-6 space-y-3">
          {result.transport_tips && (
            <div className="bg-white/4 border border-white/8 rounded-2xl p-4 flex gap-3">
              <span className="text-xl shrink-0">🚗</span>
              <div>
                <p className="text-zinc-400 text-[10px] font-bold uppercase tracking-wider mb-1">이동 & 렌트카</p>
                <p className="text-zinc-300 text-xs leading-relaxed">{result.transport_tips}</p>
              </div>
            </div>
          )}
          {result.overall_tip && (
            <div className="bg-gradient-to-r from-orange-500/10 to-pink-500/10 border border-orange-500/20 rounded-2xl p-4 flex gap-3">
              <span className="text-xl shrink-0">✨</span>
              <div>
                <p className="text-orange-400 text-[10px] font-bold uppercase tracking-wider mb-1">여행 꿀팁</p>
                <p className="text-zinc-300 text-xs leading-relaxed">{result.overall_tip}</p>
              </div>
            </div>
          )}
          {/* 푸터 */}
          <p className="text-center text-zinc-700 text-[10px] pt-2">Generated by SSOKTUBE · {new Date().getFullYear()}</p>
        </div>
      </div>
    </div>
  )
}
