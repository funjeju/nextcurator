import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

export const maxDuration = 60

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY!)
const model = genAI.getGenerativeModel({
  model: 'gemini-2.5-flash',
  systemInstruction: 'You are a JSON generator. Always respond with valid JSON only. No explanation, no markdown, no code blocks. Start with { and end with }.',
  generationConfig: {
    temperature: 0.5,
    maxOutputTokens: 6144,
    // @ts-expect-error thinkingConfig not yet in types
    thinkingConfig: { thinkingBudget: 0 },
  },
})

export async function POST(req: NextRequest) {
  try {
    const {
      spots, regionName,
      startDate, endDate, nights, days,
      mode,               // 'spots_only' | 'with_recommendations'
      arrivalTime,        // 'morning' | 'afternoon' | 'evening'
      accommodation,      // { status: 'booked' | 'not_booked', details?: string }
      preferredArea,      // string (숙소 미예약 시 선호 지역)
    } = await req.json()

    if (!spots || spots.length === 0) {
      return NextResponse.json({ error: '스팟 데이터가 없습니다.' }, { status: 400 })
    }

    const numDays = Math.min(Math.max(days || 2, 1), 14)
    const numNights = Math.max(nights || numDays - 1, 0)

    const spotList = spots
      .map((s: any, i: number) =>
        `${i + 1}. ${s.name}${s.address ? ` (${s.address})` : ''}${s.description ? ` — ${s.description}` : ''}`
      ).join('\n')

    const arrivalLabel =
      arrivalTime === 'morning' ? '오전 (12시 이전)' :
      arrivalTime === 'afternoon' ? '오후 (12~18시)' :
      arrivalTime === 'evening' ? '저녁 (18시 이후)' : '미정'

    const accomLabel =
      !accommodation ? '정보 없음' :
      accommodation.status === 'booked'
        ? `예약 완료${accommodation.details ? ` — ${accommodation.details}` : ''}`
        : `미예약${preferredArea ? ` — 선호지역: ${preferredArea}` : ' — AI 추천 필요'}`

    const spotsOnlyPrompt = `당신은 여행 동선 전문가입니다. 아래 조건으로 ${numDays}일 여행 일정을 만들어주세요.

여행지: ${regionName || '미정'}
여행 기간: ${startDate} ~ ${endDate} (${numNights}박 ${numDays}일)

마이스팟 목록 (저장된 장소만 사용):
${spotList}

[작성 기준]
- 위 스팟만 사용, 추가 명소 제안 없음
- 지리적으로 가까운 스팟끼리 같은 날로 묶어 이동 최소화
- 첫날: 이동·도착·체크인 여유 고려
- 마지막날: 귀국·체크아웃 여유 고려
- 오전/점심/오후/저녁 시간대로 배분
- 현실적인 러프 일정으로 작성

JSON:
{
  "days": [
    {
      "day": 1,
      "date": "${startDate}",
      "summary": "첫날 테마 한 줄",
      "slots": [
        { "time": "오전 10:00", "spotName": "장소명", "activity": "활동 설명 1-2문장", "tip": "실용 팁", "isRecommended": false }
      ]
    }
  ],
  "overall_tip": "전체 여행 꿀팁",
  "transport_tips": "이 지역 이동 수단 팁"
}`

    const withRecommendationsPrompt = `당신은 전문 여행 플래너입니다. 아래 조건으로 세밀한 ${numDays}일 여행 일정을 작성해주세요.

여행지: ${regionName || '미정'}
여행 기간: ${startDate} ~ ${endDate} (${numNights}박 ${numDays}일)
첫날 도착 시간대: ${arrivalLabel}
숙소 상황: ${accomLabel}

마이스팟 목록:
${spotList}

[작성 기준]
- 마이스팟을 우선 배치하고, 빈 시간대에는 해당 지역의 추천 명소(isRecommended: true)를 자연스럽게 추가
- 도착 시간대에 맞게 첫날 일정 구성 (오전 도착이면 풀일정, 저녁 도착이면 가볍게)
- 숙소 미예약인 경우: 전체 동선을 고려해 최적 숙소 위치와 추천 숙소 유형을 accommodation_suggestion에 작성
- 숙소 예약된 경우: 숙소 위치를 기준으로 동선 최적화
- 지리적으로 효율적인 동선 (같은 권역 묶기)
- 마지막날: 체크아웃 후 귀국 전 시간 활용
- 각 slot의 tip은 실제 유용한 정보 (주차, 예약, 혼잡도 등)

JSON:
{
  "days": [
    {
      "day": 1,
      "date": "${startDate}",
      "summary": "첫날 테마",
      "slots": [
        { "time": "오후 2:00", "spotName": "장소명", "activity": "활동 설명", "tip": "실용 팁", "isRecommended": false }
      ]
    }
  ],
  "overall_tip": "전체 여행 꿀팁 2-3문장",
  "accommodation_suggestion": "숙소 추천 (미예약인 경우만 작성, 예약된 경우 null)",
  "transport_tips": "이 지역 이동 수단·렌트카 등 팁"
}`

    const prompt = mode === 'spots_only' ? spotsOnlyPrompt : withRecommendationsPrompt

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
