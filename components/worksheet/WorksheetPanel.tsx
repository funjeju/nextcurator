'use client'

import { useState, useRef } from 'react'
import { WorksheetData, VocabItem, WorksheetQuestion } from '@/types/summary'

interface Props {
  worksheet: WorksheetData
  onClose: () => void
}

const LEVEL_COLOR: Record<string, string> = {
  elementary: 'bg-green-500/20 text-green-400 border-green-500/30',
  middle:     'bg-blue-500/20  text-blue-400  border-blue-500/30',
  advanced:   'bg-purple-500/20 text-purple-400 border-purple-500/30',
}

// ── 단어장 탭 ─────────────────────────────────
function VocabTab({ words }: { words: VocabItem[] }) {
  const [flipped, setFlipped] = useState<Set<number>>(new Set())
  const toggle = (i: number) => setFlipped(prev => {
    const next = new Set(prev)
    next.has(i) ? next.delete(i) : next.add(i)
    return next
  })

  return (
    <div className="space-y-3">
      <p className="text-[#75716e] text-xs">카드를 탭하면 예문을 볼 수 있어요</p>
      {words.map((w, i) => (
        <div
          key={i}
          onClick={() => toggle(i)}
          className="cursor-pointer rounded-2xl border border-white/10 bg-[#2a2826] hover:border-white/20 transition-all overflow-hidden"
        >
          <div className="flex items-start gap-4 p-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-white font-bold text-base">{w.word}</span>
                {w.pronunciation && (
                  <span className="text-[#75716e] text-xs font-mono">{w.pronunciation}</span>
                )}
              </div>
              <p className="text-orange-300 text-sm mt-0.5">{w.meaning}</p>
            </div>
            <span className="text-[#75716e] text-xs mt-1 shrink-0">{flipped.has(i) ? '▲' : '▼'}</span>
          </div>
          {flipped.has(i) && (
            <div className="px-4 pb-4 border-t border-white/5 pt-3 space-y-1">
              <p className="text-[#e8e4e0] text-sm italic">"{w.example}"</p>
              <p className="text-[#75716e] text-xs">→ {w.exampleKo}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── 문제풀기 탭 ───────────────────────────────
function ExerciseTab({ worksheet }: { worksheet: WorksheetData }) {
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [checked, setChecked] = useState(false)
  const [showAnswers, setShowAnswers] = useState(false)

  const setAnswer = (key: string, val: string) => {
    if (checked) return
    setAnswers(prev => ({ ...prev, [key]: val }))
  }

  const totalQ = worksheet.exercises.reduce((s, ex) => s + ex.questions.length, 0)
  const correctCount = checked ? worksheet.exercises.reduce((s, ex) => {
    return s + ex.questions.filter(q => {
      const key = `${ex.type}_${q.id}`
      return answers[key]?.trim().toLowerCase() === q.answer.toLowerCase()
    }).length
  }, 0) : 0

  const isCorrect = (exType: string, q: WorksheetQuestion) => {
    if (!checked) return null
    const key = `${exType}_${q.id}`
    return answers[key]?.trim().toLowerCase() === q.answer.toLowerCase()
  }

  return (
    <div className="space-y-8">
      {worksheet.exercises.map((ex) => (
        <div key={ex.type} className="space-y-4">
          <div>
            <h3 className="text-white font-bold text-sm">{ex.title}</h3>
            <p className="text-[#75716e] text-xs mt-0.5">{ex.instructions}</p>
          </div>

          {/* Matching */}
          {ex.type === 'matching' && ex.questions.map(q => {
            const key = `${ex.type}_${q.id}`
            const result = isCorrect(ex.type, q)
            return (
              <div key={q.id} className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-[#75716e] text-xs w-4 shrink-0">{q.id}.</span>
                  <span className="text-white text-sm font-medium w-28 shrink-0">{q.question}</span>
                  <select
                    value={answers[key] ?? ''}
                    onChange={e => setAnswer(key, e.target.value)}
                    disabled={checked}
                    className={`flex-1 h-8 px-2 rounded-lg text-sm bg-[#32302e] border text-white focus:outline-none ${
                      result === true  ? 'border-green-500 text-green-400' :
                      result === false ? 'border-red-500 text-red-400' :
                      'border-white/10 focus:border-orange-500/50'
                    }`}
                  >
                    <option value="">선택하세요</option>
                    {q.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                  {result === true  && <span className="text-green-400 text-sm shrink-0">✓</span>}
                  {result === false && <span className="text-red-400 text-xs shrink-0">✗ {q.answer}</span>}
                </div>
              </div>
            )
          })}

          {/* Fill in blank */}
          {ex.type === 'fill_blank' && (
            <>
              <div className="flex flex-wrap gap-2 p-3 bg-[#2a2826] rounded-xl border border-white/5">
                <span className="text-[#75716e] text-xs w-full mb-1">단어 박스</span>
                {ex.questions.flatMap(q => q.options ?? []).filter((v, i, a) => a.indexOf(v) === i).map(opt => (
                  <span key={opt} className="px-2.5 py-1 bg-[#3d3a38] rounded-lg text-xs text-white font-mono">{opt}</span>
                ))}
              </div>
              {ex.questions.map(q => {
                const key = `${ex.type}_${q.id}`
                const result = isCorrect(ex.type, q)
                return (
                  <div key={q.id} className="flex items-start gap-2">
                    <span className="text-[#75716e] text-xs w-4 shrink-0 mt-2">{q.id}.</span>
                    <div className="flex-1 space-y-1">
                      <p className="text-[#e8e4e0] text-sm">{q.question}</p>
                      <input
                        type="text"
                        value={answers[key] ?? ''}
                        onChange={e => setAnswer(key, e.target.value)}
                        disabled={checked}
                        placeholder="답 입력..."
                        className={`w-full h-8 px-3 rounded-lg text-sm bg-[#32302e] border text-white focus:outline-none placeholder:text-[#75716e] ${
                          result === true  ? 'border-green-500' :
                          result === false ? 'border-red-500' :
                          'border-white/10 focus:border-orange-500/50'
                        }`}
                      />
                      {result === false && <p className="text-red-400 text-xs">정답: {q.answer}</p>}
                      {q.hint && !checked && <p className="text-[#75716e] text-[10px]">힌트: {q.hint}</p>}
                    </div>
                  </div>
                )
              })}
            </>
          )}

          {/* Translate */}
          {ex.type === 'translate' && ex.questions.map(q => {
            const key = `${ex.type}_${q.id}`
            const result = isCorrect(ex.type, q)
            return (
              <div key={q.id} className="space-y-2">
                <div className="flex items-start gap-2">
                  <span className="text-[#75716e] text-xs w-4 shrink-0 mt-1">{q.id}.</span>
                  <p className="text-[#e8e4e0] text-sm flex-1 italic">"{q.question}"</p>
                </div>
                <textarea
                  value={answers[key] ?? ''}
                  onChange={e => setAnswer(key, e.target.value)}
                  disabled={checked}
                  placeholder="한국어로 해석하세요..."
                  rows={2}
                  className={`w-full px-3 py-2 rounded-xl text-sm bg-[#32302e] border text-white focus:outline-none placeholder:text-[#75716e] resize-none ${
                    result === true  ? 'border-green-500' :
                    result === false ? 'border-red-400/60' :
                    'border-white/10 focus:border-orange-500/50'
                  }`}
                />
                {(result === false || showAnswers) && (
                  <p className="text-orange-300 text-xs ml-6">모범 답안: {q.answer}</p>
                )}
              </div>
            )
          })}
        </div>
      ))}

      {/* 채점 버튼 */}
      <div className="flex gap-2 pt-2">
        {!checked ? (
          <button
            onClick={() => setChecked(true)}
            className="flex-1 h-11 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm transition-colors"
          >
            채점하기
          </button>
        ) : (
          <>
            <div className="flex-1 h-11 rounded-xl bg-[#32302e] border border-white/10 flex items-center justify-center gap-2">
              <span className="text-white font-bold text-base">{correctCount}</span>
              <span className="text-[#75716e] text-sm">/ {totalQ} 정답</span>
              <span className="text-lg ml-1">
                {correctCount === totalQ ? '🎉' : correctCount >= totalQ * 0.7 ? '👍' : '💪'}
              </span>
            </div>
            <button
              onClick={() => { setChecked(false); setAnswers({}); setShowAnswers(false) }}
              className="h-11 px-4 rounded-xl bg-[#32302e] border border-white/10 text-[#a4a09c] hover:text-white text-sm transition-colors"
            >
              다시 풀기
            </button>
            <button
              onClick={() => setShowAnswers(v => !v)}
              className="h-11 px-4 rounded-xl bg-[#32302e] border border-white/10 text-[#a4a09c] hover:text-white text-sm transition-colors"
            >
              {showAnswers ? '답 숨기기' : '전체 답 보기'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ── 메인 패널 ─────────────────────────────────
export default function WorksheetPanel({ worksheet, onClose }: Props) {
  const [tab, setTab] = useState<'vocab' | 'exercise' | 'print'>('vocab')
  const printRef = useRef<HTMLDivElement>(null)
  const [printing, setPrinting] = useState(false)

  const handlePrint = async () => {
    if (!printRef.current) return
    setPrinting(true)
    try {
      const { downloadPdf } = await import('@/lib/downloadPdf')
      await downloadPdf(printRef.current, `워크시트_${worksheet.title.slice(0, 30)}.pdf`)
    } finally {
      setPrinting(false)
    }
  }

  const tabs = [
    { id: 'vocab',    label: '📖 단어장' },
    { id: 'exercise', label: '✏️ 문제풀기' },
    { id: 'print',    label: '🖨️ 인쇄' },
  ] as const

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-6">
      <div className="w-full md:max-w-2xl h-[92dvh] md:h-[85vh] bg-[#1c1a18] md:rounded-2xl flex flex-col border border-white/10 shadow-2xl overflow-hidden">

        {/* 헤더 */}
        <div className="flex items-start gap-3 px-5 py-4 border-b border-white/10 bg-[#23211f] shrink-0">
          <span className="text-2xl mt-0.5">📝</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-white font-bold text-sm truncate max-w-[240px]">{worksheet.title}</h2>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${LEVEL_COLOR[worksheet.level]}`}>
                {worksheet.levelLabel}
              </span>
            </div>
            <p className="text-[#75716e] text-xs mt-0.5">단어 {worksheet.vocabulary.length}개 · 문제 {worksheet.exercises.reduce((s, e) => s + e.questions.length, 0)}개</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-[#32302e] text-[#75716e] hover:text-white flex items-center justify-center text-sm transition-colors shrink-0">
            ✕
          </button>
        </div>

        {/* 탭 바 */}
        <div className="flex border-b border-white/10 shrink-0">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 py-3 text-xs font-semibold transition-colors ${
                tab === t.id
                  ? 'text-orange-400 border-b-2 border-orange-400'
                  : 'text-[#75716e] hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* 탭 내용 */}
        <div className="flex-1 overflow-y-auto p-5">
          {tab === 'vocab'    && <VocabTab words={worksheet.vocabulary} />}
          {tab === 'exercise' && <ExerciseTab worksheet={worksheet} />}
          {tab === 'print'    && (
            <div className="space-y-4">
              <button
                onClick={handlePrint}
                disabled={printing}
                className="w-full h-12 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {printing ? (
                  <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>PDF 생성 중...</>
                ) : (
                  <><span>🖨️</span> PDF 다운로드</>
                )}
              </button>
              <p className="text-[#75716e] text-xs text-center">A4 사이즈로 출력하면 깔끔하게 인쇄돼요</p>

              {/* PDF 미리보기 & 캡처 대상 */}
              <div ref={printRef} style={{ background: '#fff', padding: 32, fontFamily: 'sans-serif', color: '#111', width: 680 }}>
                {/* 헤더 */}
                <div style={{ borderBottom: '2px solid #111', paddingBottom: 12, marginBottom: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                    <div>
                      <p style={{ fontSize: 11, color: '#666', marginBottom: 4 }}>Next Curator 영어 워크시트</p>
                      <h1 style={{ fontSize: 18, fontWeight: 900, margin: 0 }}>{worksheet.title}</h1>
                    </div>
                    <div style={{ textAlign: 'right', fontSize: 11, color: '#666' }}>
                      <p>난이도: <strong>{worksheet.levelLabel}</strong></p>
                      <p>이름: ________________________</p>
                      <p>날짜: ________________________</p>
                    </div>
                  </div>
                </div>

                {/* 단어장 */}
                <div style={{ marginBottom: 28 }}>
                  <h2 style={{ fontSize: 14, fontWeight: 700, borderLeft: '4px solid #f97316', paddingLeft: 8, marginBottom: 12 }}>📖 단어장</h2>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                    <thead>
                      <tr style={{ background: '#f3f4f6' }}>
                        <th style={{ border: '1px solid #d1d5db', padding: '6px 10px', textAlign: 'left', width: '18%' }}>단어</th>
                        <th style={{ border: '1px solid #d1d5db', padding: '6px 10px', textAlign: 'left', width: '14%' }}>발음</th>
                        <th style={{ border: '1px solid #d1d5db', padding: '6px 10px', textAlign: 'left', width: '14%' }}>뜻</th>
                        <th style={{ border: '1px solid #d1d5db', padding: '6px 10px', textAlign: 'left' }}>예문</th>
                      </tr>
                    </thead>
                    <tbody>
                      {worksheet.vocabulary.map((w, i) => (
                        <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                          <td style={{ border: '1px solid #d1d5db', padding: '6px 10px', fontWeight: 700 }}>{w.word}</td>
                          <td style={{ border: '1px solid #d1d5db', padding: '6px 10px', color: '#666', fontSize: 10 }}>{w.pronunciation}</td>
                          <td style={{ border: '1px solid #d1d5db', padding: '6px 10px', color: '#ea580c' }}>{w.meaning}</td>
                          <td style={{ border: '1px solid #d1d5db', padding: '6px 10px', fontStyle: 'italic', color: '#374151' }}>{w.example}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* 연습 문제 */}
                {worksheet.exercises.map((ex, ei) => (
                  <div key={ei} style={{ marginBottom: 28 }}>
                    <h2 style={{ fontSize: 14, fontWeight: 700, borderLeft: '4px solid #f97316', paddingLeft: 8, marginBottom: 6 }}>{ex.title}</h2>
                    <p style={{ fontSize: 11, color: '#666', marginBottom: 12 }}>{ex.instructions}</p>

                    {ex.type === 'matching' && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                        {ex.questions.map((q, qi) => (
                          <div key={qi} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                            <span style={{ color: '#666', minWidth: 16 }}>{q.id}.</span>
                            <strong style={{ minWidth: 80 }}>{q.question}</strong>
                            <span style={{ flex: 1, borderBottom: '1px solid #d1d5db' }}></span>
                          </div>
                        ))}
                      </div>
                    )}

                    {ex.type === 'fill_blank' && (
                      <div style={{ marginBottom: 8 }}>
                        <div style={{ background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: 6, padding: '8px 12px', marginBottom: 12, fontSize: 11 }}>
                          <strong>단어 박스: </strong>
                          {ex.questions.flatMap(q => q.options ?? []).filter((v, i, a) => a.indexOf(v) === i).join('  /  ')}
                        </div>
                        {ex.questions.map((q, qi) => (
                          <p key={qi} style={{ fontSize: 12, marginBottom: 8, lineHeight: 1.8 }}>
                            {q.id}. {q.question}
                          </p>
                        ))}
                      </div>
                    )}

                    {ex.type === 'translate' && (
                      <div>
                        {ex.questions.map((q, qi) => (
                          <div key={qi} style={{ marginBottom: 16 }}>
                            <p style={{ fontSize: 12, fontStyle: 'italic', marginBottom: 4 }}>{q.id}. "{q.question}"</p>
                            <div style={{ borderBottom: '1px solid #d1d5db', marginBottom: 4, height: 22 }}></div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 8, textAlign: 'center', fontSize: 10, color: '#9ca3af' }}>
                  Generated by Next Curator · nextcurator.vercel.app
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
