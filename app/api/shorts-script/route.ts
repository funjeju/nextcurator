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
    // @ts-expect-error thinkingConfig not yet in types
    thinkingConfig: { thinkingBudget: 0 },
  },
})

function tsToSeconds(ts: string): number {
  const parts = ts.split(':').map(Number)
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  return 0
}

export async function POST(req: NextRequest) {
  try {
    const { transcript, title, channel, videoId, sessionId } = await req.json()

    if (!transcript || transcript.trim().length < 100) {
      return NextResponse.json({ error: '자막 데이터가 부족합니다.' }, { status: 400 })
    }

    // 자막이 너무 길면 앞부분만 (토큰 절약)
    const trimmedTranscript = transcript.slice(0, 20000)

    const prompt = `다음은 유튜브 영상의 타임스탬프 포함 자막입니다.
이 자막에서 숏폼(Shorts/Reels/TikTok)으로 재편집할 때 가장 효과적인 구간 3~5개를 선별해주세요.

영상 제목: ${title}
채널: ${channel}

자막:
${trimmedTranscript}

[선별 기준]
- 각 구간은 15~60초가 적당 (너무 짧거나 길면 안 됨)
- 핵심 정보, 반전, 감정적 임팩트, 실용 팁 등 독립적으로 봐도 가치 있는 구간
- 앞뒤 문맥 없이도 이해 가능한 구간 우선
- 자막에 실제로 존재하는 타임스탬프만 사용 (없는 타임스탬프 만들지 말 것)

[출력 형식]
- start_time / end_time: 자막에서 실제 확인된 "[MM:SS]" 형태 그대로
- script: 해당 구간의 자막 원문 전체 (편집 없이, 줄바꿈은 \\n으로)
- title: 이 클립의 제목 (한국어, 25자 이내)
- hook: 이 구간이 숏폼으로 효과적인 이유 한 문장
- type: "hook"(첫인상·반전) | "tip"(실용정보) | "highlight"(핵심장면) | "emotion"(감동·웃음)

JSON:
{
  "segments": [
    {
      "id": 1,
      "title": "클립 제목",
      "start_time": "MM:SS",
      "end_time": "MM:SS",
      "script": "자막 원문...",
      "hook": "왜 이 구간이 효과적인지",
      "type": "tip"
    }
  ],
  "edit_tips": "이 영상 전체의 숏폼 편집 총평 1-2문장"
}`

    const result = await model.generateContent(prompt)
    const text = result.response.text().trim()
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return NextResponse.json({ error: 'AI 응답 파싱 실패' }, { status: 500 })

    const parsed = JSON.parse(jsonMatch[0])

    // 초 단위 계산
    parsed.segments = (parsed.segments ?? []).map((s: any) => ({
      ...s,
      start_seconds: tsToSeconds(s.start_time),
      end_seconds: tsToSeconds(s.end_time),
      duration_seconds: tsToSeconds(s.end_time) - tsToSeconds(s.start_time),
    }))

    return NextResponse.json({ ...parsed, videoId, sessionId })
  } catch (e: any) {
    console.error('[shorts-script]', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
