'use client'

import { RecipeSummary as RecipeSummaryType } from '@/types/summary'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import TimestampBadge from './TimestampBadge'
import CopyButton from './CopyButton'

interface Props {
  data: RecipeSummaryType
  onSeek: (ts: string) => void
}

export default function RecipeSummary({ data, onSeek }: Props) {
  const copyText = `${data.dish_name}\n난이도: ${data.difficulty} | ${data.total_time} | ${data.servings}\n\n재료:\n${data.ingredients.map(i => `- ${i.name} ${i.amount}`).join('\n')}\n\n만드는 법:\n${data.steps.map(s => `${s.step}. [${s.timestamp}] ${s.desc}${s.tip ? ` (팁: ${s.tip})` : ''}`).join('\n')}\n\n핵심 팁:\n${data.key_tips.map(t => `• ${t}`).join('\n')}`

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
        <div>
          <h3 className="text-zinc-300 font-semibold mb-2">재료 ({data.servings})</h3>
          <div className="bg-zinc-800 rounded-lg p-3 flex flex-col gap-1">
            {data.ingredients.map((ing, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="text-zinc-200">{ing.name}</span>
                <span className="text-zinc-400">{ing.amount}</span>
              </div>
            ))}
          </div>
        </div>

        <Separator className="bg-zinc-800" />

        <div>
          <h3 className="text-zinc-300 font-semibold mb-3">만드는 법</h3>
          <div className="flex flex-col gap-4">
            {data.steps.map((step) => (
              <div key={step.step} className="flex gap-3">
                <span className="text-blue-400 font-bold text-sm w-5 shrink-0">{step.step}</span>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <TimestampBadge timestamp={step.timestamp} onSeek={onSeek} />
                    {step.tip && <span className="text-emerald-400 text-xs">★</span>}
                  </div>
                  <p className="text-zinc-200 text-sm">{step.desc}</p>
                  {step.tip && <p className="text-emerald-400 text-xs">{step.tip}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {data.key_tips.length > 0 && (
          <>
            <Separator className="bg-zinc-800" />
            <div>
              <h3 className="text-emerald-400 font-semibold mb-2">💡 핵심 팁</h3>
              <ul className="flex flex-col gap-1">
                {data.key_tips.map((tip, i) => (
                  <li key={i} className="text-zinc-300 text-sm">• {tip}</li>
                ))}
              </ul>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
