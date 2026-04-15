'use client'

import { useState } from 'react'
import { QuizData, QuizQuestion } from '@/types/summary'

export interface QuizAnswerLog {
  questionIdx: number
  selected: string
  correct: boolean
}

interface Props {
  quiz: QuizData
  onClose: () => void
  onAnswer?: (log: QuizAnswerLog) => void   // 문제별 정답 여부 콜백
}

export default function QuizPanel({ quiz, onClose, onAnswer }: Props) {
  const [idx, setIdx] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [score, setScore] = useState(0)
  const [done, setDone] = useState(false)
  const [answers, setAnswers] = useState<boolean[]>([])

  const q = quiz.questions[idx]
  const total = quiz.questions.length

  const next = (correct: boolean, chosenOption?: string) => {
    onAnswer?.({ questionIdx: idx, selected: chosenOption ?? (correct ? '알았어' : '몰랐어'), correct })
    const newAnswers = [...answers, correct]
    setAnswers(newAnswers)
    if (correct) setScore(s => s + 1)
    if (idx + 1 >= total) {
      setDone(true)
    } else {
      setIdx(i => i + 1)
      setFlipped(false)
      setSelected(null)
    }
  }

  const restart = () => {
    setIdx(0); setFlipped(false); setSelected(null)
    setScore(0); setDone(false); setAnswers([])
  }

  if (done) {
    const pct = Math.round((score / total) * 100)
    return (
      <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-[#23211f] border border-white/10 rounded-3xl w-full max-w-sm p-8 flex flex-col items-center gap-5 shadow-2xl">
          <span className="text-5xl">{pct >= 80 ? '🎉' : pct >= 50 ? '👍' : '💪'}</span>
          <h2 className="text-xl font-bold text-white">퀴즈 완료!</h2>
          <div className="text-center">
            <p className="text-4xl font-black text-orange-400">{score}/{total}</p>
            <p className="text-[#75716e] text-sm mt-1">{pct}% 정답</p>
          </div>
          <div className="flex gap-2 w-full mt-2">
            <button onClick={restart} className="flex-1 py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-2xl text-sm transition-colors">
              다시 풀기
            </button>
            <button onClick={onClose} className="flex-1 py-3 bg-[#32302e] text-[#a4a09c] hover:text-white font-bold rounded-2xl text-sm border border-white/10 transition-colors">
              닫기
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#23211f] border border-white/10 rounded-3xl w-full max-w-sm flex flex-col shadow-2xl overflow-hidden">

        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-white">{quiz.title}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-[#75716e]">{idx + 1} / {total}</span>
            <button onClick={onClose} className="text-[#75716e] hover:text-white transition-colors text-lg leading-none">✕</button>
          </div>
        </div>

        {/* 진행 바 */}
        <div className="h-1 bg-[#32302e]">
          <div
            className="h-full bg-orange-500 transition-all duration-300"
            style={{ width: `${((idx) / total) * 100}%` }}
          />
        </div>

        {/* 문제 */}
        <div className="p-5 flex flex-col gap-4 min-h-[360px]">
          {q.type === 'flashcard' ? (
            <FlashCard q={q} flipped={flipped} onFlip={() => setFlipped(true)} onNext={(correct) => next(correct)} />
          ) : (
            <MultipleChoice q={q} selected={selected} onSelect={setSelected} onNext={(correct) => next(correct, selected ?? '')} />
          )}
        </div>
      </div>
    </div>
  )
}

function FlashCard({ q, flipped, onFlip, onNext }: {
  q: QuizQuestion; flipped: boolean
  onFlip: () => void; onNext: (correct: boolean) => void
}) {
  return (
    <div className="flex flex-col gap-4 flex-1">
      <div
        onClick={!flipped ? onFlip : undefined}
        className={`flex-1 min-h-[200px] rounded-2xl border flex flex-col items-center justify-center p-6 cursor-pointer transition-all duration-300 text-center ${
          flipped
            ? 'bg-orange-500/10 border-orange-500/40'
            : 'bg-[#32302e] border-white/10 hover:border-orange-500/30'
        }`}
      >
        {!flipped ? (
          <>
            <p className="text-[10px] text-[#75716e] mb-3 uppercase tracking-wider">앞면 — 탭해서 뒤집기</p>
            <p className="text-white text-xl font-bold leading-relaxed">{q.question}</p>
            {q.hint && <p className="text-[#75716e] text-xs mt-3">💡 {q.hint}</p>}
          </>
        ) : (
          <>
            <p className="text-[10px] text-orange-400/70 mb-3 uppercase tracking-wider">뒷면</p>
            <p className="text-orange-100 text-base font-semibold leading-relaxed whitespace-pre-line">{q.answer}</p>
          </>
        )}
      </div>

      {flipped && (
        <div className="flex gap-2">
          <button
            onClick={() => onNext(false)}
            className="flex-1 py-3 bg-[#32302e] border border-red-500/30 text-red-400 hover:bg-red-500/10 font-bold rounded-2xl text-sm transition-colors"
          >
            😅 몰랐어
          </button>
          <button
            onClick={() => onNext(true)}
            className="flex-1 py-3 bg-[#32302e] border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 font-bold rounded-2xl text-sm transition-colors"
          >
            ✅ 알았어
          </button>
        </div>
      )}
      {!flipped && (
        <p className="text-center text-xs text-[#75716e]">카드를 탭해서 정답 확인</p>
      )}
    </div>
  )
}

function MultipleChoice({ q, selected, onSelect, onNext }: {
  q: QuizQuestion; selected: string | null
  onSelect: (v: string) => void; onNext: (correct: boolean) => void
}) {
  const options = q.options ?? []
  const confirmed = selected !== null

  return (
    <div className="flex flex-col gap-3 flex-1">
      <p className="text-white font-semibold text-base leading-relaxed">{q.question}</p>
      <div className="flex flex-col gap-2 flex-1">
        {options.map((opt, i) => {
          const isSelected = selected === opt
          const isCorrect = opt === q.answer
          let style = 'bg-[#32302e] border-white/10 text-[#e2e2e2] hover:border-orange-500/30 hover:text-white'
          if (confirmed) {
            if (isCorrect) style = 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300'
            else if (isSelected) style = 'bg-red-500/15 border-red-500/50 text-red-300'
            else style = 'bg-[#32302e] border-white/5 text-[#75716e] opacity-60'
          } else if (isSelected) {
            style = 'bg-orange-500/15 border-orange-500/50 text-orange-200'
          }
          return (
            <button
              key={i}
              onClick={() => !confirmed && onSelect(opt)}
              disabled={confirmed}
              className={`w-full text-left px-4 py-3 rounded-xl border text-sm font-medium transition-all ${style}`}
            >
              <span className="text-[10px] opacity-60 mr-2">{['A', 'B', 'C', 'D'][i]}.</span>
              {opt}
            </button>
          )
        })}
      </div>
      {confirmed && (
        <button
          onClick={() => onNext(selected === q.answer)}
          className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-2xl text-sm transition-colors mt-1"
        >
          다음 →
        </button>
      )}
    </div>
  )
}
