import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

export const maxDuration = 60

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY!)
const model = genAI.getGenerativeModel({
  model: 'gemini-2.5-flash',
  systemInstruction: 'You are a JSON generator. Always respond with valid JSON only. No explanation, no markdown, no code blocks. Start with { and end with }.',
  generationConfig: {
    temperature: 0.4,
    maxOutputTokens: 8192,
    // @ts-expect-error thinkingConfig not yet in types but supported
    thinkingConfig: { thinkingBudget: 0 },
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

    const prompt = `다음 유튜브 영상 요약 데이터를 구글 SEO에 최적화된 블로그 글로 변환하세요.

영상 제목: ${title}
채널: ${channel}
카테고리: ${category}

요약 데이터:
${JSON.stringify(summary, null, 2)}

[SEO 최적화 규칙]
- seo_title: 핵심 키워드를 앞에 배치, 50-60자, 클릭 유도 (숫자/How-to/질문형 활용)
- meta_description: 핵심 내용 + 읽고 싶게 만드는 문구, 150-160자, 핵심 키워드 포함
- slug: 영문 소문자+하이픈 (예: "how-to-make-kimchi-stew-easy-recipe")
- intro: 검색자의 궁금증을 바로 해결하는 도입부 2-3문장, 핵심 키워드 자연스럽게 포함
- sections의 heading: 검색 쿼리형 또는 "핵심 키워드 + 설명" 형태로 (H2 수준)
- sections의 text: 250-400자, 요약 데이터의 실제 내용을 기반으로 풍부하게 서술
- timestamp가 있는 섹션은 timestamp 필드에 "MM:SS" 형태로 기입, 없으면 null
- conclusion: 핵심 내용 1-2문장 재강조 + "원본 영상에서 더 자세히 확인하세요" 형태의 CTA
- reading_time: 모든 text 합산 글자수 / 500 (정수, 최소 1)
- tags: 검색량 높을 법한 키워드 5-8개 (한국어)

JSON 형식:
{
  "seo_title": "",
  "meta_description": "",
  "slug": "",
  "tags": ["태그1","태그2","태그3","태그4","태그5"],
  "reading_time": 3,
  "sections": [
    {"id": "intro", "heading": null, "level": 0, "text": "도입부 2-3문장", "timestamp": null},
    {"id": "s1", "heading": "H2 소제목", "level": 2, "text": "본문 250-400자", "timestamp": "MM:SS 또는 null"},
    {"id": "conclusion", "heading": "마무리", "level": 2, "text": "결론 + CTA", "timestamp": null}
  ]
}`

    const result = await model.generateContent(prompt)
    const text = result.response.text().trim()

    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return NextResponse.json({ error: 'AI 응답 파싱 실패' }, { status: 500 })

    const draft = JSON.parse(jsonMatch[0])

    // 각 섹션의 timestamp → seconds 변환 (유튜브 링크용)
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
