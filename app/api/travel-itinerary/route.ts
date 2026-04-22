import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { selectSpotsForItinerary } from '@/lib/jeju-spots'
import { initAdminApp } from '@/lib/firebase-admin'

export const maxDuration = 60

initAdminApp()

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
      spots,
      startDate, endDate, nights, days,
      mode,
      arrivalTime,
      accommodations,
      withKids = false,
      withPets = false,
      flightArrivalTime,
      flightDepartureTime,
    } = await req.json()

    if (!spots || spots.length === 0) {
      return NextResponse.json({ error: '스팟 데이터가 없습니다.' }, { status: 400 })
    }

    const numDays  = Math.min(Math.max(days || 2, 1), 14)
    const numNights = Math.max(nights || numDays - 1, 0)

    // ── 스마트 스팟 선발 ──────────────────────────────────────────
    const { spotsByDay, corridorRegions } = await selectSpotsForItinerary({
      wishlistSpots: spots,
      numDays,
      withKids,
      withPets,
    })

    // ── AI 프롬프트용 스팟 문자열 생성 ───────────────────────────
    const spotListByDay = spotsByDay.map((daySpots, di) => {
      const lines = daySpots.map(s => {
        const isWishlist = !s.isFromDB
        const tag = isWishlist ? '[찜]' : '[추천]'
        const cats = s.categories_kr?.length ? `(${s.categories_kr.slice(0, 2).join('/')})` : ''
        const desc = s.description ? ` — ${s.description.slice(0, 40)}` : ''
        return `  ${tag} ${s.place_name} ${cats}${desc}`
      }).join('\n')
      return `Day ${di + 1}:\n${lines}`
    }).join('\n\n')

    // 비행 시간 기반 실제 일정 가능 시간 계산
    function addMin(t: string, m: number) {
      const [h, min] = t.split(':').map(Number)
      const total = h * 60 + min + m
      return `${String(Math.floor(((total % 1440) + 1440) % 1440 / 60)).padStart(2,'0')}:${String(((total % 60)+60)%60).padStart(2,'0')}`
    }
    const arrivalNote = flightArrivalTime
      ? `착륙 ${flightArrivalTime} → 렌트카 픽업 약 40분 → 첫 활동 시작 최소 ${addMin(flightArrivalTime, 40)} 이후`
      : arrivalTime === 'morning'   ? '오전 도착 (12시 이전)'
      : arrivalTime === 'afternoon' ? '오후 도착 (12~18시)'
      : arrivalTime === 'evening'   ? '저녁 도착 (18시 이후)' : '미정'

    const departureNote = flightDepartureTime
      ? `이륙 ${flightDepartureTime} → 공항 도착 최소 ${addMin(flightDepartureTime, -90)} → 마지막 스팟 ${addMin(flightDepartureTime, -120)} 이전 완료`
      : '마지막날 체크아웃 후 공항 이동 시간 여유'

    const arrivalLabel = arrivalNote

    const accomLabel = !accommodations?.length
      ? '정보 없음'
      : accommodations.map((a: any) => {
          const status = a.status === 'booked'
            ? `예약완료${a.details ? ` (${a.details})` : ''}`
            : `미예약${a.preferredArea ? ` — 선호지역: ${a.preferredArea}` : ' — AI 추천 필요'}`
          return `  ${a.night}박째: ${status}`
        }).join('\n')

    const basePrompt = `당신은 제주도 여행 전문 플래너입니다.

여행 기간: ${startDate} ~ ${endDate} (${numNights}박 ${numDays}일)
첫날 도착: ${arrivalLabel}
마지막날 출발: ${departureNote}
숙소: ${accomLabel}
통과 지역: ${corridorRegions.join(' → ')}
${withKids ? '👶 아이 동반 여행\n' : ''}${withPets ? '🐾 반려동물 동반 여행\n' : ''}
[일수별 배정 스팟]
[찜] = 사용자가 저장한 필수 방문지 | [추천] = 동선상 큐레이션된 스팟
${spotListByDay}

[규칙]
- [찜] 스팟은 반드시 포함. [추천] 스팟은 동선과 시간에 맞게 적절히 선택
- 같은 날 스팟끼리 지리적으로 가까운 순서로 배치 (이동 최소화)
- 첫날: 위의 도착 시간 정확히 반영. 첫 slot 시간은 실제 활동 가능 시간 이후로 설정
- 마지막날: 위의 출발 시간 정확히 반영. 공항 이동 시간 역산해서 마지막 slot 완료 시간 준수
- 각 slot의 tip은 실용 정보 (주차, 혼잡 시간, 예약 필요 여부 등)
${mode === 'with_recommendations' ? '- 미예약 숙소가 있으면 accommodation_suggestion에 추천 지역/유형 작성' : ''}

JSON 형식:
{
  "days": [
    {
      "day": 1,
      "date": "${startDate}",
      "summary": "하루 테마 한 줄",
      "region": "주요 지역",
      "slots": [
        {
          "time": "오전 10:00",
          "spotName": "장소명",
          "activity": "활동 설명 1-2문장",
          "tip": "실용 팁",
          "isRecommended": false
        }
      ]
    }
  ],
  "overall_tip": "전체 여행 꿀팁 2-3문장",
  "transport_tips": "렌트카/버스 등 이동 수단 팁"${mode === 'with_recommendations' ? ',\n  "accommodation_suggestion": "숙소 추천 (미예약인 경우만, 예약 완료면 null)"' : ''}
}`

    const result = await model.generateContent(basePrompt)
    const text = result.response.text().trim()
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return NextResponse.json({ error: 'AI 응답 파싱 실패' }, { status: 500 })

    const itinerary = JSON.parse(jsonMatch[0])

    // 선발 메타 정보도 함께 반환 (디버그/UI 활용)
    return NextResponse.json({
      ...itinerary,
      _meta: {
        corridorRegions,
        totalSpotsSelected: spotsByDay.reduce((s, d) => s + d.length, 0),
        spotsByDayCount: spotsByDay.map(d => d.length),
      },
    })
  } catch (e: any) {
    console.error('[travel-itinerary]', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
