import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY!)
const model = genAI.getGenerativeModel({
  model: 'gemini-2.5-flash',
  systemInstruction: 'You are a JSON generator. Always respond with valid JSON only. No explanation, no markdown, no code blocks.',
  generationConfig: {
    temperature: 0.1,
    maxOutputTokens: 2000,
    // @ts-expect-error thinkingConfig not yet in types
    thinkingConfig: { thinkingBudget: 0 },
  },
})

export async function POST(req: NextRequest) {
  try {
    const { query, summaries } = await req.json()

    if (!query?.trim() || !Array.isArray(summaries) || summaries.length === 0) {
      return NextResponse.json({ results: [] })
    }

    const summaryList = summaries
      .map((s: any, i: number) =>
        `[${i}] id="${s.id}" title="${s.title}" category="${s.category}" tags=[${(s.tags ?? []).join(', ')}] topic="${s.topic_cluster ?? ''}" vibe="${s.vibe ?? ''}"`
      )
      .join('\n')

    const prompt = `사용자의 검색 쿼리에 맞는 영상 요약들을 골라 관련도 순서로 정렬해서 반환하세요.

검색 쿼리: "${query}"

영상 목록:
${summaryList}

관련이 있는 항목만 id를 포함하세요. 전혀 관련없으면 results를 빈 배열로 반환하세요.
응답 형식: {"results":["id1","id2",...]}`

    const result = await model.generateContent(prompt)
    const text = result.response.text().trim()

    // JSON 파싱
    const stripped = text.replace(/```(?:json)?\n?/g, '').replace(/```/g, '').trim()
    const match = stripped.match(/\{[\s\S]*\}/)
    if (!match) return NextResponse.json({ results: [] })

    const parsed = JSON.parse(match[0]) as { results: string[] }
    return NextResponse.json({ results: parsed.results ?? [] })
  } catch (e) {
    console.error('Search error:', e)
    return NextResponse.json({ results: [] }, { status: 500 })
  }
}
