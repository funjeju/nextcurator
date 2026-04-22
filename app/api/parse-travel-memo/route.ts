import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

export const maxDuration = 30

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json() as { text: string }
    if (!text?.trim()) return NextResponse.json({ error: 'text required' }, { status: 400 })

    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY!)
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1,
        // @ts-expect-error thinkingConfig not yet in types
        thinkingConfig: { thinkingBudget: 0 },
      },
    })

    const year = new Date().getFullYear()
    const prompt = `여행 관련 메모에서 정보를 추출해줘. 날짜, 장소, 숙소, 비행기 시간을 찾아내는 게 목적이야.

메모:
"""
${text.slice(0, 3000)}
"""

아래 JSON 형식으로만 응답해. 코드블록 없이 순수 JSON만.

{
  "dates": { "startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD" },
  "spots": [{ "name": "장소명", "note": "메모에서 언급된 맥락 (선택)" }],
  "accommodations": [{ "night": 1, "name": "숙소명 또는 지역", "area": "지역명 (선택)" }],
  "flightTimes": { "arrival": "HH:MM", "departure": "HH:MM" },
  "summary": "메모에서 파악된 내용 1~2줄 요약"
}

규칙:
- dates: 날짜가 전혀 없으면 null
- spots: 가고 싶거나 언급된 장소·스팟·명소 모두. 없으면 빈 배열 []
- accommodations: 숙소 언급 없으면 null. night 번호는 1박째부터 순서대로
- flightTimes: 비행기/항공편 시간이 없으면 null
  - arrival: 목적지 착륙 시간 (예: "11:00"). 출발 시간이 언급되고 비행시간이 약 1시간이면 +1시간으로 추산
  - departure: 목적지 출발 비행기 이륙 시간 (예: "19:00")
  - 시간 형식은 반드시 24시간제 HH:MM
- 현재 연도: ${year}
- 날짜가 "5월 3일~5일" 같으면 startDate: "${year}-05-03", endDate: "${year}-05-05"`

    const result = await model.generateContent(prompt)
    const raw = result.response.text().trim()
    const parsed = JSON.parse(raw)

    return NextResponse.json({
      dates: parsed.dates ?? null,
      spots: Array.isArray(parsed.spots) ? parsed.spots : [],
      accommodations: parsed.accommodations ?? null,
      flightTimes: parsed.flightTimes ?? null,
      summary: parsed.summary ?? '',
    })
  } catch (e) {
    console.error('[parse-travel-memo]', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
