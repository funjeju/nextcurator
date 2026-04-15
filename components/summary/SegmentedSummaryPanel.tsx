'use client'

import { useState } from 'react'

interface QuizQuestion {
  question: string
  options: string[]
  answer: number
}

interface Segment {
  index: number
  startTimestamp: string
  endTimestamp: string
  headline: string
  keyPoints: string[]
  quiz?: QuizQuestion[]
}

interface Props {
  segments: Segment[]
  onSeek: (ts: string) => void
  onRequestQuiz?: (segmentIndex: number) => Promise<QuizQuestion[]>
}

function QuizCard({ quiz, onSeek }: { quiz: QuizQuestion[]; onSeek?: (ts: string) => void }) {
  const [answers, setAnswers] = useState<Record<number, number>>({})

  return (
    <div className="mt-3 flex flex-col gap-3">
      {quiz.map((q, qi) => (
        <div key={qi} className="bg-[#23211f] rounded-2xl p-4 border border-white/5">
          <p className="text-white text-sm font-medium mb-3">Q{qi + 1}. {q.question}</p>
          <div className="flex flex-col gap-1.5">
            {q.options.map((opt, oi) => {
              const selected = answers[qi] === oi
              const revealed = answers[qi] !== undefined
              const correct = oi === q.answer
              return (
                <button
                  key={oi}
                  onClick={() => !revealed && setAnswers(prev => ({ ...prev, [qi]: oi }))}
                  className={`text-left px-3 py-2 rounded-xl text-sm transition-all border ${
                    !revealed
                      ? 'border-white/10 text-[#a4a09c] hover:border-orange-500/30 hover:text-white'
                      : correct
                      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                      : selected
                      ? 'border-red-500/40 bg-red-500/10 text-red-300'
                      : 'border-white/5 text-[#75716e] opacity-60'
                  }`}
                >
                  <span className="font-mono mr-2">{String.fromCharCode(65 + oi)}.</span>
                  {opt}
                  {revealed && correct && <span className="ml-2 text-xs">✅</span>}
                  {revealed && selected && !correct && <span className="ml-2 text-xs">❌</span>}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

export default function SegmentedSummaryPanel({ segments, onSeek, onRequestQuiz }: Props) {
  const [openIndex, setOpenIndex] = useState<number | null>(0)
  const [quizLoading, setQuizLoading] = useState<number | null>(null)
  const [quizData, setQuizData] = useState<Record<number, QuizQuestion[]>>({})

  const handleLoadQuiz = async (segIdx: number) => {
    if (quizData[segIdx] || !onRequestQuiz) return
    setQuizLoading(segIdx)
    try {
      const quiz = await onRequestQuiz(segIdx)
      setQuizData(prev => ({ ...prev, [segIdx]: quiz }))
    } catch {
      // fail silently
    } finally {
      setQuizLoading(null)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-white font-semibold text-base">🗂 구간별 분석</span>
        <span className="text-xs text-[#75716e] bg-[#32302e] px-2 py-0.5 rounded-full border border-white/10">{segments.length}개 구간</span>
      </div>

      {segments.map((seg, i) => {
        const isOpen = openIndex === i
        const hasQuiz = !!(seg.quiz?.length || quizData[i]?.length)
        const quiz = seg.quiz || quizData[i]

        return (
          <div
            key={i}
            className={`rounded-2xl border transition-all ${
              isOpen ? 'border-orange-500/20 bg-[#2a2826]' : 'border-white/5 bg-[#32302e]/60'
            }`}
          >
            {/* 헤더 */}
            <button
              className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
              onClick={() => setOpenIndex(isOpen ? null : i)}
            >
              <span className="shrink-0 w-7 h-7 rounded-full bg-orange-500/15 border border-orange-500/25 flex items-center justify-center text-orange-400 text-xs font-bold">
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">{seg.headline}</p>
                <p className="text-[#75716e] text-xs mt-0.5">
                  {seg.startTimestamp} ~ {seg.endTimestamp}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {hasQuiz && <span className="text-[10px] text-violet-400 bg-violet-500/10 border border-violet-500/20 px-1.5 py-0.5 rounded-full">퀴즈</span>}
                <svg
                  className={`w-4 h-4 text-[#75716e] transition-transform ${isOpen ? 'rotate-180' : ''}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </button>

            {/* 콘텐츠 */}
            {isOpen && (
              <div className="px-4 pb-4 flex flex-col gap-3">
                {/* 이 시간대로 이동 */}
                <button
                  onClick={() => onSeek(seg.startTimestamp)}
                  className="self-start flex items-center gap-1.5 px-2.5 py-1 bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs rounded-full hover:bg-orange-500/20 transition-all"
                >
                  ▶ {seg.startTimestamp}부터 재생
                </button>

                {/* 포인트 목록 */}
                <ul className="flex flex-col gap-2">
                  {seg.keyPoints.map((pt, pi) => (
                    <li key={pi} className="flex items-start gap-2">
                      <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-orange-400/60 mt-1.5" />
                      <p className="text-[#e2e2e2] text-sm leading-relaxed">{pt}</p>
                    </li>
                  ))}
                </ul>

                {/* 퀴즈 섹션 */}
                {onRequestQuiz && (
                  <div>
                    {quiz?.length ? (
                      <QuizCard quiz={quiz} onSeek={onSeek} />
                    ) : (
                      <button
                        onClick={() => handleLoadQuiz(i)}
                        disabled={quizLoading === i}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-violet-500/30 text-violet-400 text-xs hover:bg-violet-500/5 transition-all disabled:opacity-50"
                      >
                        {quizLoading === i ? (
                          <>
                            <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                            </svg>
                            퀴즈 생성 중...
                          </>
                        ) : (
                          <>🧠 이 구간 퀴즈 풀기</>
                        )}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
