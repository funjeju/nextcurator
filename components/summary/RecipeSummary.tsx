'use client'

import { RecipeSummary as RecipeSummaryType } from '@/types/summary'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import TimestampBadge from './TimestampBadge'
import CopyButton from './CopyButton'
import CommentBubble from '@/components/comments/CommentBubble'

interface Props {
  data: RecipeSummaryType
  onSeek: (ts: string) => void
  onComment?: (segmentId: string, segmentLabel: string) => void
  commentCounts?: Record<string, number>
}

const GROUP_COLORS: Record<string, string> = {
  '메인 재료': 'text-orange-400',
  '양념':      'text-red-400',
  '소스':      'text-red-400',
  '육수':      'text-blue-400',
  '반죽':      'text-yellow-400',
  '채소':      'text-green-400',
  '고명':      'text-pink-400',
}
function groupColor(group: string) {
  return GROUP_COLORS[group] ?? 'text-zinc-400'
}

export default function RecipeSummary({ data, onSeek, onComment, commentCounts = {} }: Props) {
  const groups = data.ingredient_groups ??
    (data.ingredients ? [{ group: '재료', items: data.ingredients }] : [])

  const allItems = groups.flatMap(g => g.items)
  const copyText = `${data.dish_name}\n난이도: ${data.difficulty} | ${data.total_time} | ${data.servings}\n\n재료:\n${allItems.map(i => `- ${i.name} ${i.amount}`).join('\n')}\n\n만드는 법:\n${data.steps.map(s => `${s.step}. [${s.timestamp}] ${s.desc}${s.tip ? ` (팁: ${s.tip})` : ''}`).join('\n')}\n\n핵심 팁:\n${data.key_tips.map(t => `• ${t}`).join('\n')}`

  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-orange-400 text-sm mb-1">🍳 레시피 카드</CardTitle>
          <h2 className="text-xl font-bold text-zinc-100">{data.dish_name}</h2>
          <p className="text-zinc-400 text-sm mt-1">{data.difficulty} 가능 · {data.total_time}</p>
        </div>
        <CopyButton text={copyText} />
      </CardHeader>
      <CardContent className="flex flex-col gap-6">

        {/* 재료 (그룹별) */}
        <div>
          <h3 className="text-zinc-300 font-semibold mb-3">재료 ({data.servings})</h3>
          <div className="flex flex-col gap-3">
            {groups.map((grp, gi) => (
              <div key={gi} className="bg-zinc-800 rounded-xl overflow-hidden">
                {groups.length > 1 && (
                  <div className={`px-3 py-1.5 text-xs font-semibold bg-zinc-700/60 ${groupColor(grp.group)}`}>
                    {grp.group}
                  </div>
                )}
                <div className="p-3 flex flex-col gap-1">
                  {grp.items.map((ing, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-zinc-200">{ing.name}</span>
                      <span className="text-zinc-400">{ing.amount}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <Separator className="bg-zinc-800" />

        {/* 만드는 법 */}
        <div>
          <h3 className="text-zinc-300 font-semibold mb-3">만드는 법</h3>
          <div className="flex flex-col gap-4">
            {data.steps.map((step) => {
              const segId = `step-${step.step}`
              const segLabel = `${step.step}단계`
              return (
                <div key={step.step} id={`seg-${segId}`} className="flex gap-3 transition-all rounded-lg p-1 -m-1">
                  <span className="text-blue-400 font-bold text-sm w-5 shrink-0 mt-0.5">{step.step}</span>
                  <div className="flex flex-col gap-1 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <TimestampBadge timestamp={step.timestamp} onSeek={onSeek} />
                      {step.tip && <span className="text-emerald-400 text-xs">★</span>}
                      {onComment && (
                        <CommentBubble
                          segmentId={segId}
                          segmentLabel={segLabel}
                          count={commentCounts[segId] ?? 0}
                          onComment={onComment}
                        />
                      )}
                    </div>
                    <p className="text-zinc-200 text-sm">{step.desc}</p>
                    {step.tip && <p className="text-emerald-400 text-xs">{step.tip}</p>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* 핵심 팁 */}
        {data.key_tips.length > 0 && (
          <>
            <Separator className="bg-zinc-800" />
            <div>
              <h3 className="text-emerald-400 font-semibold mb-2">💡 핵심 팁</h3>
              <ul className="flex flex-col gap-2">
                {data.key_tips.map((tip, i) => {
                  const segId = `tip-${i}`
                  const segLabel = `팁 ${i + 1}`
                  return (
                    <li key={i} id={`seg-${segId}`} className="flex items-start justify-between gap-2 transition-all rounded-lg p-1 -m-1">
                      <span className="text-zinc-300 text-sm">• {tip}</span>
                      {onComment && (
                        <CommentBubble
                          segmentId={segId}
                          segmentLabel={segLabel}
                          count={commentCounts[segId] ?? 0}
                          onComment={onComment}
                        />
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
