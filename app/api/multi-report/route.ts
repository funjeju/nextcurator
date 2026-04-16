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
    const { videos, reportTitle, reportPurpose } = await req.json()
    // videos: { title, channel, summary, transcript? }[]

    if (!videos || videos.length === 0) {
      return NextResponse.json({ error: '영상 데이터가 없습니다.' }, { status: 400 })
    }

    const videoList = videos.map((v: any, i: number) => `
[영상 ${i + 1}] ${v.title} — ${v.channel}
요약: ${JSON.stringify(v.summary).slice(0, 800)}
${v.transcript ? `자막(일부): ${v.transcript.slice(0, 600)}` : ''}
`.trim()).join('\n\n')

    const prompt = `당신은 전문 리서치 어시스턴트입니다. 아래 ${videos.length}개의 유튜브 영상을 분석해 종합 인사이트 보고서를 작성하세요.

보고서 제목: ${reportTitle || '종합 인사이트 보고서'}
작성 목적: ${reportPurpose || '영상들의 핵심 인사이트를 종합 정리'}

영상 목록:
${videoList}

[작성 기준]
- executive_summary: 전체를 관통하는 핵심 결론 3-4문장
- key_themes: 영상들을 관통하는 공통 주제/트렌드 (3~5개)
- insights: 각 주제에서 얻을 수 있는 핵심 인사이트 (영상별 출처 포함)
- comparison: 영상들 간의 공통점과 차이점 분석
- action_items: 시청자가 실제로 활용할 수 있는 실행 방안 (3~5개)
- conclusion: 마무리 결론 및 추천

JSON:
{
  "executive_summary": "전체 요약 3-4문장",
  "key_themes": [
    { "theme": "주제명", "description": "설명 1-2문장", "videos": [1, 2] }
  ],
  "insights": [
    { "insight": "인사이트 내용", "source_video": 1, "importance": "high|medium|low" }
  ],
  "comparison": {
    "common": ["공통점1", "공통점2"],
    "differences": ["차이점1", "차이점2"]
  },
  "action_items": [
    { "action": "실행 방안", "priority": "high|medium|low" }
  ],
  "conclusion": "결론 2-3문장"
}`

    const result = await model.generateContent(prompt)
    const text = result.response.text().trim()
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return NextResponse.json({ error: 'AI 응답 파싱 실패' }, { status: 500 })

    return NextResponse.json(JSON.parse(match[0]))
  } catch (e: any) {
    console.error('[multi-report]', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
