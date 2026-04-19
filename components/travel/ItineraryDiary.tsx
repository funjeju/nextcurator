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

// hex colors — html2canvas doesn't support oklch/lab (Tailwind v4)
const DAY_HEX = [
  { hex: '#f43f5e', light: 'rgba(244,63,94,0.10)', border: 'rgba(244,63,94,0.30)', text: '#fb7185' },
  { hex: '#f97316', light: 'rgba(249,115,22,0.10)', border: 'rgba(249,115,22,0.30)', text: '#fb923c' },
  { hex: '#f59e0b', light: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.30)', text: '#fbbf24' },
  { hex: '#10b981', light: 'rgba(16,185,129,0.10)', border: 'rgba(16,185,129,0.30)', text: '#34d399' },
  { hex: '#06b6d4', light: 'rgba(6,182,212,0.10)',  border: 'rgba(6,182,212,0.30)',  text: '#22d3ee' },
  { hex: '#8b5cf6', light: 'rgba(139,92,246,0.10)', border: 'rgba(139,92,246,0.30)', text: '#a78bfa' },
  { hex: '#ec4899', light: 'rgba(236,72,153,0.10)', border: 'rgba(236,72,153,0.30)', text: '#f472b6' },
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

      {/* ── 다이어리 본문 (PDF 캡처 대상) — 인라인 hex 스타일로 작성 (html2canvas oklch 미지원) ── */}
      <div ref={diaryRef} style={{ background: '#1a1614', borderRadius: 24, overflow: 'hidden', fontFamily: 'sans-serif' }}>

        {/* 커버 헤더 */}
        <div style={{ position: 'relative', background: 'linear-gradient(135deg, #c2410c, #db2777, #6d28d9)', padding: '32px 24px', color: '#fff', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', inset: 0, opacity: 0.10 }}>
            {['✈️','🌴','🗺️','📍','🌊','🏔️','☀️'].map((e, i) => (
              <span key={i} style={{ position: 'absolute', fontSize: 36, userSelect: 'none', left: `${10 + i * 13}%`, top: `${20 + (i % 3) * 25}%`, transform: `rotate(${i * 15 - 30}deg)` }}>{e}</span>
            ))}
          </div>
          <div style={{ position: 'relative' }}>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 10, fontWeight: 600, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 4 }}>Travel Diary</p>
            <h1 style={{ fontSize: 22, fontWeight: 900, marginBottom: 4 }}>{regionEmoji} {regionName}</h1>
            <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13 }}>{formatDate(startDate)} — {formatDate(endDate)}</p>
            <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
              <span style={{ padding: '4px 12px', background: 'rgba(255,255,255,0.2)', borderRadius: 999, fontSize: 11, fontWeight: 700 }}>{nights}박 {days}일</span>
              {mode === 'with_recommendations' && (
                <span style={{ padding: '4px 12px', background: 'rgba(255,255,255,0.2)', borderRadius: 999, fontSize: 11, fontWeight: 700 }}>✨ AI 큐레이션</span>
              )}
            </div>
          </div>
        </div>

        {/* 숙소 추천 */}
        {result.accommodation_suggestion && (
          <div style={{ margin: '20px 20px 0', background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.20)', borderRadius: 16, padding: '12px 16px', display: 'flex', gap: 12 }}>
            <span style={{ fontSize: 20, flexShrink: 0 }}>🏨</span>
            <div>
              <p style={{ color: '#fbbf24', fontSize: 11, fontWeight: 700, marginBottom: 2 }}>숙소 추천</p>
              <p style={{ color: '#d4d4d8', fontSize: 11, lineHeight: 1.6 }}>{result.accommodation_suggestion}</p>
            </div>
          </div>
        )}

        {/* 날짜별 일정 */}
        <div style={{ padding: '20px 20px 8px', display: 'flex', flexDirection: 'column', gap: 24 }}>
          {result.days.map((day, di) => {
            const c = DAY_HEX[di % DAY_HEX.length]
            return (
              <div key={day.day}>
                {/* 날짜 헤더 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: c.hex, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ color: '#fff', fontSize: 9, fontWeight: 700, opacity: 0.8, lineHeight: 1 }}>DAY</span>
                    <span style={{ color: '#fff', fontSize: 16, fontWeight: 900, lineHeight: 1 }}>{day.day}</span>
                  </div>
                  <div>
                    <p style={{ color: '#fff', fontWeight: 700, fontSize: 13, lineHeight: 1.3 }}>{day.summary}</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                      {day.date && <p style={{ color: '#71717a', fontSize: 11 }}>{formatDateShort(day.date)}</p>}
                      {day.region && (
                        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 999, background: c.light, color: c.text, border: `1px solid ${c.border}`, fontWeight: 600 }}>
                          {day.region}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* 타임라인 */}
                <div style={{ position: 'relative', paddingLeft: 20 }}>
                  <div style={{ position: 'absolute', left: 7, top: 8, bottom: 8, width: 2, background: c.hex, opacity: 0.2, borderRadius: 2 }} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {day.slots.map((slot, si) => (
                      <div key={si} style={{ position: 'relative', display: 'flex', gap: 12 }}>
                        <div style={{
                          position: 'absolute', left: -20, top: 12,
                          width: 14, height: 14, borderRadius: '50%',
                          background: '#1a1614',
                          border: `2px solid ${slot.isRecommended ? '#06b6d4' : c.hex}`,
                          flexShrink: 0, zIndex: 1,
                        }} />
                        <div style={{
                          flex: 1, borderRadius: 16, padding: '12px 14px',
                          background: slot.isRecommended ? 'rgba(6,182,212,0.05)' : c.light,
                          border: `1px solid ${slot.isRecommended ? 'rgba(6,182,212,0.15)' : c.border}`,
                        }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: c.text }}>{slot.time}</span>
                            <p style={{ color: '#fff', fontWeight: 600, fontSize: 13 }}>{slot.spotName}</p>
                            {slot.isRecommended && (
                              <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: 'rgba(6,182,212,0.15)', color: '#22d3ee', fontWeight: 700, border: '1px solid rgba(6,182,212,0.20)' }}>AI추천</span>
                            )}
                          </div>
                          <p style={{ color: '#a1a1aa', fontSize: 11, lineHeight: 1.6 }}>{slot.activity}</p>
                          {slot.tip && (
                            <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
                              <span style={{ fontSize: 11 }}>💡</span>
                              <p style={{ color: 'rgba(253,230,138,0.80)', fontSize: 11, lineHeight: 1.6 }}>{slot.tip}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {di < result.days.length - 1 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 20 }}>
                    <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.05)' }} />
                    <span style={{ color: '#3f3f46', fontSize: 11 }}>✦</span>
                    <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.05)' }} />
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* 하단 팁 영역 */}
        <div style={{ padding: '0 20px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {result.transport_tips && (
            <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 16, display: 'flex', gap: 12 }}>
              <span style={{ fontSize: 20, flexShrink: 0 }}>🚗</span>
              <div>
                <p style={{ color: '#a1a1aa', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>이동 & 렌트카</p>
                <p style={{ color: '#d4d4d8', fontSize: 11, lineHeight: 1.6 }}>{result.transport_tips}</p>
              </div>
            </div>
          )}
          {result.overall_tip && (
            <div style={{ background: 'linear-gradient(90deg, rgba(249,115,22,0.10), rgba(236,72,153,0.10))', border: '1px solid rgba(249,115,22,0.20)', borderRadius: 16, padding: 16, display: 'flex', gap: 12 }}>
              <span style={{ fontSize: 20, flexShrink: 0 }}>✨</span>
              <div>
                <p style={{ color: '#fb923c', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>여행 꿀팁</p>
                <p style={{ color: '#d4d4d8', fontSize: 11, lineHeight: 1.6 }}>{result.overall_tip}</p>
              </div>
            </div>
          )}
          <p style={{ textAlign: 'center', color: '#3f3f46', fontSize: 10, paddingTop: 8 }}>Generated by SSOKTUBE · {new Date().getFullYear()}</p>
        </div>
      </div>
    </div>
  )
}
