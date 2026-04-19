import { NextRequest, NextResponse } from 'next/server'
import { fetchVideoComments } from '@/lib/youtube-comments'
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY!)
const model = genAI.getGenerativeModel({
  model: 'gemini-2.5-flash',
  generationConfig: {
    temperature: 0.3,
    maxOutputTokens: 600,
    // @ts-expect-error thinkingConfig not yet in types but supported
    thinkingConfig: { thinkingBudget: 0 },
  },
})

export async function POST(req: NextRequest) {
  const { videoId } = await req.json().catch(() => ({}))
  if (!videoId) return NextResponse.json({ error: 'videoId required' }, { status: 400 })

  const { popular } = await fetchVideoComments(videoId)
  if (popular.length === 0) return NextResponse.json({ summary: null })

  const commentLines = popular.slice(0, 30)
    .map(c => `- [👍${c.likes}] ${c.text.slice(0, 150)}`)
    .join('\n')

  const prompt = `다음은 유튜브 영상의 인기 댓글 목록입니다.

${commentLines}

시청자들의 전반적인 반응과 댓글의 방향성을 한국어로 280자 이내로 요약해주세요.
- 긍정/부정/혼재 여부
- 시청자들이 주로 언급하는 포인트
- 전체적인 분위기

단순히 요약하는 문장으로만 작성하세요. JSON이나 마크다운 없이.`

  try {
    const result = await model.generateContent(prompt)
    const text = result.response.text().trim().slice(0, 300)
    return NextResponse.json({ summary: text })
  } catch {
    return NextResponse.json({ summary: null })
  }
}
