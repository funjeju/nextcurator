import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

export const maxDuration = 60

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY!)
const model = genAI.getGenerativeModel({
  model: 'gemini-2.5-flash',
  systemInstruction: 'You are a JSON generator. Always respond with valid JSON only. No explanation, no markdown, no code blocks. Start with { and end with }.',
  generationConfig: {
    temperature: 0.5,
    maxOutputTokens: 4096,
    // @ts-expect-error thinkingConfig not yet in types
    thinkingConfig: { thinkingBudget: 0 },
  },
})

export async function POST(req: NextRequest) {
  try {
    const { spots, regionName, days } = await req.json()
    if (!spots || spots.length === 0) {
      return NextResponse.json({ error: '스팟 데이터가 없습니다.' }, { status: 400 })
    }

    const numDays = Math.min(Math.max(days || Math.ceil(spots.length / 3), 1), 7)

    const prompt = `다음 여행 스팟 목록을 바탕으로 ${numDays}일 여행 일정을 만들어주세요.

지역: ${regionName || '미정'}
스팟 목록:
${spots.map((s: any, i: number) => `${i + 1}. ${s.name}${s.address ? ` (${s.address})` : ''}${s.description ? ` - ${s.description}` : ''}`).join('\n')}

[작성 규칙]
- 스팟들을 동선이 효율적이도록 날짜별로 배분하세요
- 각 날마다 오전/오후/저녁 시간대로 나눠서 구성
- 이동 거리, 피로도, 영업 시간 등을 고려해 현실적인 일정 작성
- tip에는 해당 장소의 실용적인 조언 1-2문장
- 각 날의 summary는 그날의 테마나 특징 1문장

JSON 형식:
{
  "days": [
    {
      "day": 1,
      "summary": "첫날 테마",
      "slots": [
        {
          "time": "오전 10:00",
          "spotName": "스팟명",
          "activity": "무엇을 할지 1-2문장",
          "tip": "실용 팁"
        }
      ]
    }
  ],
  "overall_tip": "전체 여행 꿀팁 1-2문장"
}`

    const result = await model.generateContent(prompt)
    const text = result.response.text().trim()
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return NextResponse.json({ error: 'AI 응답 파싱 실패' }, { status: 500 })

    return NextResponse.json(JSON.parse(jsonMatch[0]))
  } catch (e: any) {
    console.error('[travel-itinerary]', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
