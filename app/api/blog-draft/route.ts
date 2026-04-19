import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

export const maxDuration = 60

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY!)
const model = genAI.getGenerativeModel({
  model: 'gemini-2.5-flash',
  systemInstruction: 'You are a JSON generator. Always respond with valid JSON only. No explanation, no markdown, no code blocks. Start with { and end with }. All string values must be properly JSON-escaped.',
  generationConfig: {
    temperature: 0.5,
    maxOutputTokens: 12000,
    // @ts-expect-error thinkingConfig not yet in types but supported
    thinkingConfig: { thinkingBudget: 0 },
    responseMimeType: 'application/json',
  },
})

function tsToSeconds(ts: string): number {
  if (!ts) return 0
  const parts = ts.split(':').map(Number)
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  return 0
}

export async function POST(req: NextRequest) {
  try {
    const { title, channel, category, summary, videoId, sessionId, thumbnail } = await req.json()
    if (!summary) return NextResponse.json({ error: '요약 데이터가 없습니다.' }, { status: 400 })

    const today = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })

    const prompt = `다음 유튜브 영상 요약 데이터를 구글 SEO에 최적화된 블로그 글로 변환하세요.
작성 기준일: ${today}

영상 제목: ${title}
채널: ${channel}
카테고리: ${category}

요약 데이터:
${JSON.stringify(summary, null, 2)}

[SEO 최적화 규칙]
- seo_title: 핵심 키워드를 앞에 배치, 50-60자, 연도(${new Date().getFullYear()}) 포함 권장, 클릭 유도 (숫자/How-to/질문형)
- meta_description: 핵심 내용 + 클릭 유도 문구, 150-160자, 핵심 키워드 포함
- slug: 영문 소문자+하이픈 (예: "how-to-make-kimchi-stew-easy-recipe")
- lsi_keywords: 본문에 자연스럽게 녹여야 할 LSI(연관 검색어) 8-12개. 검색자가 실제로 치는 표현으로

[섹션 작성 원칙 — 반드시 준수]
- 요약 데이터를 단순히 나열하지 말고, 각 섹션마다 에디터의 분석·평가·실용적 조언을 반드시 추가
- "영상에서는 ~라고 했다" 형태 지양, 독자가 실제로 활용할 수 있는 방식으로 서술
- 각 section의 text는 300-450자, 분석·비교·맥락 설명 포함
- timestamp가 있는 섹션은 timestamp 필드에 "MM:SS" 형태로 기입, 없으면 null
- intro: 검색자의 핵심 궁금증을 바로 해결하는 도입부, LSI 키워드 자연 포함
- conclusion: 핵심 요약 + 독자 행동 유도(CTA) + "원본 영상에서 더 자세히"

[FAQ — 5개 필수]
- 이 주제로 구글에서 실제로 검색할 법한 질문과 답변
- 질문: 검색 쿼리 형태 ("~하는 방법", "~이란", "~차이")
- 답변: 2-4문장, 영상 내용 기반이지만 독자적 설명 추가

[체크리스트 — 3-5개]
- 이 영상 시청 후 독자가 바로 실천할 수 있는 구체적 행동 항목

[reading_time]
모든 section text + FAQ 답변 합산 글자수 / 500 (정수, 최소 2)

[tags]
검색량 높을 법한 키워드 6-10개 (한국어)

JSON 형식:
{
  "seo_title": "",
  "meta_description": "",
  "slug": "",
  "tags": ["태그1","태그2"],
  "lsi_keywords": ["연관검색어1","연관검색어2"],
  "reading_time": 3,
  "sections": [
    {"id": "intro", "heading": null, "level": 0, "text": "도입부", "timestamp": null},
    {"id": "s1", "heading": "H2 소제목", "level": 2, "text": "본문 300-450자 분석 포함", "timestamp": "MM:SS 또는 null"},
    {"id": "conclusion", "heading": "마무리 및 핵심 정리", "level": 2, "text": "결론+CTA", "timestamp": null}
  ],
  "faq": [
    {"question": "검색 쿼리형 질문?", "answer": "2-4문장 답변"},
    {"question": "질문2?", "answer": "답변2"},
    {"question": "질문3?", "answer": "답변3"},
    {"question": "질문4?", "answer": "답변4"},
    {"question": "질문5?", "answer": "답변5"}
  ],
  "checklist": ["실천 항목 1", "실천 항목 2", "실천 항목 3"]
}`

    const result = await model.generateContent(prompt)
    const text = result.response.text().trim()

    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return NextResponse.json({ error: 'AI 응답 파싱 실패' }, { status: 500 })

    const draft = JSON.parse(jsonMatch[0])

    draft.sections = (draft.sections ?? []).map((s: any) => ({
      ...s,
      seconds: s.timestamp ? tsToSeconds(s.timestamp) : null,
    }))

    return NextResponse.json({
      ...draft,
      videoId,
      sessionId,
      thumbnail,
      title,
      channel,
    })
  } catch (e: any) {
    console.error('[blog-draft]', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
