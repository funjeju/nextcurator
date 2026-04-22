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

    // ── AI 프롬프트용 스팟 문자열 생성 (GPS 포함) ───────────────────────────
    const spotListByDay = spotsByDay.map((daySpots, di) => {
      const lines = daySpots.map(s => {
        const isWishlist = !s.isFromDB
        const tag = isWishlist ? '[찜]' : '[추천]'
        const cats = s.categories_kr?.length ? `(${s.categories_kr.slice(0, 2).join('/')})` : ''
        const desc = s.description ? ` — ${s.description.slice(0, 40)}` : ''
        const gps = s.lat && s.lng ? ` [GPS:${s.lat.toFixed(4)},${s.lng.toFixed(4)}]` : ''
        return `  ${tag} ${s.place_name} ${cats}${gps}${desc}`
      }).join('\n')
      return `Day ${di + 1}:\n${lines}`
    }).join('\n\n')

    // 숙소별 GPS 힌트 (지역명 기반 대략 좌표)
    const REGION_GPS: Record<string, string> = {
      '제주시': '33.499,126.531', '애월': '33.463,126.322', '한림': '33.416,126.266',
      '한경': '33.356,126.190', '대정': '33.241,126.143', '안덕': '33.283,126.330',
      '서귀포': '33.253,126.561', '남원': '33.267,126.715', '성산': '33.459,126.927',
      '구좌': '33.525,126.836', '조천': '33.536,126.641',
    }
    const accomGpsHint = accommodations?.map((a: any, i: number) => {
      const area = (a.details || a.preferredArea || '').trim()
      const matchedKey = Object.keys(REGION_GPS).find(k => area.includes(k))
      const gps = matchedKey ? ` (대략 GPS: ${REGION_GPS[matchedKey]})` : ''
      return `  ${i + 1}박째: ${area || 'AI 추천 필요'}${gps}`
    }).join('\n') || '정보 없음'

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


    const basePrompt = `당신은 제주도 여행 전문 플래너입니다. GPS 좌표를 활용해 지리적으로 최적화된 동선을 짜는 것이 핵심입니다.

여행 기간: ${startDate} ~ ${endDate} (${numNights}박 ${numDays}일)
제주공항 GPS: 33.5112,126.4930
첫날 도착: ${arrivalLabel}
마지막날 출발: ${departureNote}
숙소 위치:
${accomGpsHint}
통과 지역: ${corridorRegions.join(' → ')}
${withKids ? '👶 아이 동반 여행\n' : ''}${withPets ? '🐾 반려동물 동반 여행\n' : ''}
[일수별 배정 스팟] — GPS 좌표 포함
[찜] = 필수 방문지 (중간 목적지로 취급) | [추천] = 동선상 보완 스팟
${spotListByDay}

[핵심 동선 규칙]
1. 매일 출발지 → 숙소(또는 공항) 방향으로 이동. GPS 좌표로 방향 판단:
   - 숙소가 동쪽이면 공항(서쪽)에서 시작해 동쪽으로 이동하며 스팟을 채울 것
   - 스팟들을 GPS 경도/위도 기준으로 이동 방향에 맞는 순서로 배열
2. [찜] 스팟은 반드시 포함하고 그날의 중간 목적지로 설정. 그 방향으로 앞뒤 스팟을 배치
3. 마지막날 최종 목적지는 공항 (GPS: 33.5112,126.4930). 공항 방향으로 동선 구성

[식사 규칙 — 절대 준수, 예외 없음]
- 하루에 식사는 정확히 3끼: 아침 1회 + 점심 1회 + 저녁 1회. 4끼 이상 절대 불가
- "이른 점심", "늦은 점심", "브런치" 같은 변형 금지. 점심은 딱 1회
- 아침: 08:00~09:30 사이 시작, 식사 시간 40분
- 점심: 11:30~14:00 사이 도착, 식사 시간 40분
- 저녁: 18:30~20:00 사이 도착, 식사 시간 1시간
- 식당(음식점/맛집)은 반드시 위 3개 식사 슬롯에만 배치. 관광 시간대에 식당 배치 금지
- 카페·디저트는 식사로 간주하지 않음. 카페를 점심 대용으로 쓰지 말 것

[카페 규칙]
- 카페는 하루 최대 2개: 오전 1개(10:00~11:30), 오후 1개(14:30~17:30)
- 카페를 연속 배치 금지. 관광지 사이에 자연스럽게 배치

[시간 배분]
- 관광지/체험: 1~2시간, 간단한 뷰포인트: 30~40분, 카페: 40분~1시간
- 하루 총 이동+활동 시간이 현실적이도록 조절 (무리한 스케줄 금지)

- 첫날: 도착 시간 정확히 반영, 첫 활동은 위 계산된 시작 시간 이후
- 마지막날: 출발 시간 역산해 마지막 스팟 완료 시간 준수
- 각 slot의 tip은 실용 정보 (주차, 혼잡 시간, 예약 여부)
${mode === 'with_recommendations' ? '- 미예약 숙소가 있으면 accommodation_suggestion에 동선 기반 추천 지역/유형 작성' : ''}

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
