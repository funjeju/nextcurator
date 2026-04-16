import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

export const maxDuration = 30

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY!)
const model = genAI.getGenerativeModel({
  model: 'gemini-2.5-flash',
  systemInstruction: 'You are a JSON generator. Always respond with valid JSON only. No explanation, no markdown, no code blocks. Start with { and end with }.',
  generationConfig: {
    temperature: 0.3,
    maxOutputTokens: 2048,
    // @ts-expect-error thinkingConfig not yet in types
    thinkingConfig: { thinkingBudget: 0 },
  },
})

export async function POST(req: NextRequest) {
  try {
    const { transcript, title, category } = await req.json()
    if (!transcript && !title) {
      return NextResponse.json({ error: '데이터가 없습니다.' }, { status: 400 })
    }

    const contextText = transcript
      ? transcript.slice(0, 6000)
      : title

    const prompt = `아래 유튜브 영상 내용에서 언급된 상품과 장소를 추출해주세요.

영상 제목: ${title}
카테고리: ${category}
내용:
${contextText}

[추출 기준]
- products: 구체적으로 언급된 상품, 브랜드, 식재료, 도구, 앱, 책 등
  - 단순 일반명사(예: 냄비, 물) 제외, 구체적 브랜드/제품명 포함
  - 맛집/음식점도 상품으로 취급하지 말고 places에 넣기
- places: 식당, 카페, 여행지, 관광명소, 지역명 등 장소
- 각 항목 최대 10개씩
- context는 영상에서 언급된 맥락 1문장

JSON:
{
  "products": [
    { "name": "상품명", "context": "어떤 맥락에서 언급됐는지 1문장", "category": "식재료|도구|앱|책|의류|뷰티|기타" }
  ],
  "places": [
    { "name": "장소명", "context": "어떤 맥락에서 언급됐는지 1문장", "region": "지역(서울/제주 등, 모르면 null)" }
  ]
}`

    const result = await model.generateContent(prompt)
    const text = result.response.text().trim()
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return NextResponse.json({ products: [], places: [] })

    const parsed = JSON.parse(match[0])
    return NextResponse.json({
      products: parsed.products ?? [],
      places: parsed.places ?? [],
    })
  } catch (e: any) {
    console.error('[extract-items]', e)
    return NextResponse.json({ products: [], places: [] })
  }
}
