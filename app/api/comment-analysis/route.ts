import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY!)
const model = genAI.getGenerativeModel({
  model: 'gemini-2.5-flash',
  systemInstruction: 'You are a JSON generator. Always respond with valid JSON only. No explanation, no markdown, no code blocks. Start with { and end with }.',
  generationConfig: {
    temperature: 0.3,
    maxOutputTokens: 1200,
    // @ts-expect-error thinkingConfig not yet in types
    thinkingConfig: { thinkingBudget: 0 },
  },
})

const YT_API_KEY = process.env.YOUTUBE_API_KEY

export const maxDuration = 30

async function fetchTopComments(videoId: string): Promise<string[]> {
  if (!YT_API_KEY) return []
  try {
    const url = `https://www.googleapis.com/youtube/v3/commentThreads?part=snippet&videoId=${videoId}&maxResults=30&order=relevance&key=${YT_API_KEY}`
    const res = await fetch(url)
    if (!res.ok) return []
    const data = await res.json()
    return (data.items || []).map((item: any) =>
      item.snippet?.topLevelComment?.snippet?.textDisplay ?? ''
    ).filter(Boolean)
  } catch {
    return []
  }
}

export async function POST(req: NextRequest) {
  try {
    const { videoId, title } = await req.json()
    if (!videoId) return NextResponse.json({ error: 'videoId required' }, { status: 400 })

    const comments = await fetchTopComments(videoId)
    if (comments.length === 0) {
      return NextResponse.json({ error: 'no_comments' }, { status: 404 })
    }

    const commentText = comments.slice(0, 30).join('\n---\n')
    const prompt = `다음은 YouTube 영상 "${title}"의 인기 댓글 최대 30개입니다.\n\n${commentText}\n\n이 댓글들을 분석하여 다음 JSON 형식으로 시청자 반응을 요약해 주세요:\n{\n  "overall_sentiment": "긍정적" | "부정적" | "중립적" | "혼재",\n  "sentiment_ratio": { "positive": 숫자(0-100), "negative": 숫자, "neutral": 숫자 },\n  "top_reactions": ["반응1", "반응2", "반응3"],\n  "key_opinions": [\n    { "opinion": "대표 의견 요약", "count_hint": "많은/일부/소수" }\n  ],\n  "notable_comment": "가장 인상적인 댓글 원문 (있다면)",\n  "summary": "전반적인 시청자 반응을 2-3문장으로 요약"\n}`

    const result = await model.generateContent(prompt)
    const text = result.response.text().trim()
      .replace(/^```json\s*/i, '').replace(/```$/, '').trim()

    const analysis = JSON.parse(text)
    return NextResponse.json({ analysis, commentCount: comments.length })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
