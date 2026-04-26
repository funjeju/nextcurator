'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getAllVideoQuizzes, deleteVideoQuiz, VideoQuiz } from '@/lib/videoQuiz'

const QUIZ_TYPE_LABEL: Record<string, string> = {
  ox: '⭕ OX',
  multiple_choice: '📋 객관식',
  short_answer: '✏️ 주관식',
}

function groupBySession(quizzes: VideoQuiz[]): Record<string, VideoQuiz[]> {
  const groups: Record<string, VideoQuiz[]> = {}
  for (const q of quizzes) {
    if (!groups[q.sessionId]) groups[q.sessionId] = []
    groups[q.sessionId].push(q)
  }
  // 각 그룹 내부는 타임스탬프 순
  for (const sid in groups) {
    groups[sid].sort((a, b) => a.timestampSec - b.timestampSec)
  }
  return groups
}

export default function SavedVideoQuizzes({ userId }: { userId: string }) {
  const [quizzes, setQuizzes] = useState<VideoQuiz[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) return
    setLoading(true)
    getAllVideoQuizzes(userId)
      .then(setQuizzes)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [userId])

  const handleDelete = async (id: string) => {
    if (!confirm('이 퀴즈를 삭제할까요?')) return
    setDeletingId(id)
    try {
      await deleteVideoQuiz(id)
      setQuizzes(prev => prev.filter(q => q.id !== id))
    } catch {
      alert('삭제에 실패했습니다.')
    } finally {
      setDeletingId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-[#75716e] text-sm">
        불러오는 중...
      </div>
    )
  }

  if (quizzes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
        <span className="text-4xl">🧩</span>
        <p className="text-white font-semibold">저장된 퀴즈가 없습니다</p>
        <p className="text-[#75716e] text-sm max-w-xs">
          영상 시청 중 원하는 시점에 퀴즈를 추가해보세요.<br/>
          영상이 그 지점에 도달하면 퀴즈가 자동으로 나타납니다.
        </p>
      </div>
    )
  }

  const grouped = groupBySession(quizzes)

  return (
    <div className="flex flex-col gap-5">
      {Object.entries(grouped).map(([sessionId, sessionQuizzes]) => {
        const first = sessionQuizzes[0]
        return (
          <div key={sessionId} className="bg-[#1e1c1a] border border-white/8 rounded-2xl overflow-hidden">
            {/* 영상 헤더 */}
            <Link
              href={`/result/${sessionId}`}
              className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors border-b border-white/5"
            >
              {first.thumbnail && (
                <img src={first.thumbnail} alt="" className="w-16 h-9 rounded-lg object-cover shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-semibold truncate">{first.videoTitle}</p>
                <p className="text-[#75716e] text-xs truncate">{first.channel}</p>
              </div>
              <span className="text-[#75716e] text-xs shrink-0 bg-[#32302e] px-2 py-0.5 rounded-full">
                {sessionQuizzes.length}개
              </span>
            </Link>

            {/* 퀴즈 목록 */}
            <div className="divide-y divide-white/5">
              {sessionQuizzes.map(quiz => (
                <div key={quiz.id} className="flex items-start gap-3 px-4 py-3">
                  <div className="flex flex-col items-center gap-1 shrink-0 pt-0.5">
                    <span className="text-orange-400 text-xs font-mono font-bold">
                      {quiz.timestampLabel}
                    </span>
                    <span className="text-[10px] text-[#75716e] bg-[#32302e] px-1.5 py-0.5 rounded-full">
                      {QUIZ_TYPE_LABEL[quiz.quizType]}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[#e2e2e2] text-sm leading-relaxed line-clamp-2">{quiz.question}</p>
                    {quiz.quizType === 'ox' && quiz.oxAnswer && (
                      <p className="text-[#75716e] text-xs mt-1">정답: <span className="text-orange-400 font-bold">{quiz.oxAnswer}</span></p>
                    )}
                    {quiz.quizType === 'multiple_choice' && quiz.options && quiz.correctOptionIndex !== undefined && (
                      <p className="text-[#75716e] text-xs mt-1">
                        정답: <span className="text-orange-400">{['①', '②', '③', '④'][quiz.correctOptionIndex]} {quiz.options[quiz.correctOptionIndex]}</span>
                      </p>
                    )}
                    {quiz.imageUrl && (
                      <span className="inline-block text-[10px] text-[#75716e] mt-1">📷 이미지 첨부됨</span>
                    )}
                  </div>
                  <button
                    onClick={() => handleDelete(quiz.id)}
                    disabled={deletingId === quiz.id}
                    className="shrink-0 text-[#75716e] hover:text-red-400 transition-colors text-sm disabled:opacity-40 pt-0.5"
                    title="삭제"
                  >
                    {deletingId === quiz.id ? '...' : '🗑'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
