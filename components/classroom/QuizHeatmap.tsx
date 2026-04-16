'use client'

import Link from 'next/link'
import { VideoHeatmap } from '@/lib/classroom'

interface Props {
  heatmaps: VideoHeatmap[]
}

function wrongColor(rate: number): string {
  if (rate === 0) return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/20'
  if (rate < 0.3)  return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/20'
  if (rate < 0.6)  return 'bg-orange-500/20 text-orange-300 border-orange-500/20'
  return 'bg-red-500/20 text-red-400 border-red-500/20'
}

function wrongLabel(rate: number): string {
  if (rate === 0) return '모두 정답'
  if (rate < 0.3)  return '양호'
  if (rate < 0.6)  return '주의'
  return '집중 복습 필요'
}

export default function QuizHeatmap({ heatmaps }: Props) {
  if (!heatmaps.length) {
    return (
      <div className="text-center py-10 text-gray-500 text-sm">
        아직 퀴즈 응시 데이터가 없습니다.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {heatmaps.map(video => (
        <div key={video.videoId} className="bg-[#1a1918] rounded-2xl border border-white/5 overflow-hidden">
          {/* 영상 헤더 */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
            <p className="text-sm font-bold text-white truncate flex-1">{video.videoTitle || '(제목 없음)'}</p>
            {video.sessionId && (
              <Link href={`/result/${video.sessionId}`} className="shrink-0 text-[10px] text-orange-400 hover:text-orange-300 ml-3">
                영상 보기 →
              </Link>
            )}
          </div>

          {/* 문제별 히트맵 바 */}
          <div className="px-4 py-3 space-y-2">
            {video.questions.map(q => (
              <div key={q.questionIdx} className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-500 w-12 shrink-0">Q{q.questionIdx + 1}</span>
                  {/* 히트맵 바 */}
                  <div className="flex-1 h-5 bg-white/5 rounded-full overflow-hidden relative">
                    <div
                      className={`h-full rounded-full transition-all ${
                        q.wrongRate === 0 ? 'bg-emerald-500/40' :
                        q.wrongRate < 0.3  ? 'bg-yellow-500/40' :
                        q.wrongRate < 0.6  ? 'bg-orange-500/50' : 'bg-red-500/50'
                      }`}
                      style={{ width: `${Math.max(q.wrongRate * 100, 4)}%` }}
                    />
                    <span className="absolute right-2 top-0 text-[9px] text-gray-400 leading-5">
                      {q.attempts}명 응시
                    </span>
                  </div>
                  {/* 오답률 배지 */}
                  <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border ${wrongColor(q.wrongRate)}`}>
                    오답 {Math.round(q.wrongRate * 100)}%
                  </span>
                </div>

                {/* 문제 텍스트 + 집중 복습 라벨 */}
                {(q.question || q.wrongRate >= 0.6) && (
                  <div className="pl-14 flex items-start gap-2">
                    {q.question && (
                      <p className="text-[10px] text-gray-500 truncate flex-1">{q.question}</p>
                    )}
                    {q.wrongRate >= 0.3 && (
                      <span className={`shrink-0 text-[9px] font-semibold ${q.wrongRate >= 0.6 ? 'text-red-400' : 'text-orange-400'}`}>
                        {wrongLabel(q.wrongRate)}
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* 영상 요약 통계 */}
          <div className="px-4 py-2 border-t border-white/5 flex gap-4">
            {(() => {
              const highWrong = video.questions.filter(q => q.wrongRate >= 0.6)
              const total = video.questions.reduce((s, q) => s + q.attempts, 0)
              return (
                <>
                  <span className="text-[10px] text-gray-500">총 {video.questions.length}문제 · {total}회 응시</span>
                  {highWrong.length > 0 && (
                    <span className="text-[10px] text-red-400 font-bold">
                      ⚠ 집중 복습 필요 {highWrong.length}문제 (Q{highWrong.map(q => q.questionIdx + 1).join(', Q')})
                    </span>
                  )}
                </>
              )
            })()}
          </div>
        </div>
      ))}
    </div>
  )
}
