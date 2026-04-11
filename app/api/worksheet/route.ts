import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY!)

const model = genAI.getGenerativeModel({
  model: 'gemini-2.5-flash',
  systemInstruction: 'You are a JSON generator. Always respond with valid JSON only. No explanation, no markdown, no code blocks. Start with { and end with }.',
  generationConfig: {
    temperature: 0.4,
    maxOutputTokens: 4000,
    // @ts-expect-error thinkingConfig not yet in types
    thinkingConfig: { thinkingBudget: 0 },
  },
})

const LEVEL_CONFIG = {
  elementary: { label: '초등', desc: 'CEFR A1-A2 수준, 일상 기초 단어, 짧고 단순한 문장', wordCount: 10, sentenceLength: 'short and simple' },
  middle:     { label: '중등', desc: 'CEFR B1 수준, 일반 어휘, 중간 복잡도 문장',           wordCount: 12, sentenceLength: 'moderate' },
  advanced:   { label: '고급', desc: 'CEFR B2+ 수준, 학술·고급 어휘, 복잡한 문장',           wordCount: 15, sentenceLength: 'complex' },
}

export async function POST(req: NextRequest) {
  try {
    const { transcript, summary, title, level = 'elementary' } = await req.json() as {
      transcript: string
      summary: unknown
      title: string
      level: 'elementary' | 'middle' | 'advanced'
    }

    const cfg = LEVEL_CONFIG[level] ?? LEVEL_CONFIG.elementary
    const context = [
      transcript ? `[자막]\n${transcript.slice(0, 6000)}` : '',
      summary ? `[요약]\n${JSON.stringify(summary).slice(0, 2000)}` : '',
    ].filter(Boolean).join('\n\n')

    const prompt = `다음 영어 학습 영상의 내용을 바탕으로 ${cfg.label}용 워크시트를 JSON으로 생성하세요.
수준: ${cfg.desc}
대상 콘텐츠: "${title}"

${context}

다음 JSON 구조를 정확히 따르세요:
{
  "title": "${title}",
  "level": "${level}",
  "levelLabel": "${cfg.label}",
  "vocabulary": [
    {
      "word": "영어 단어",
      "meaning": "한국어 뜻",
      "pronunciation": "/발음 기호/",
      "example": "영상에서 나온 또는 관련 영어 예문",
      "exampleKo": "예문 한국어 번역"
    }
    // ... 총 ${cfg.wordCount}개 단어, 영상 핵심 어휘 위주
  ],
  "exercises": [
    {
      "type": "matching",
      "title": "A. 단어 매칭",
      "instructions": "왼쪽 영어 단어와 알맞은 한국어 뜻을 연결하세요.",
      "questions": [
        { "id": 1, "question": "영어 단어", "answer": "한국어 뜻", "options": ["보기1", "보기2", "보기3", "보기4"] }
        // 단어장에서 8개 선택, options에 정답 포함 4개 보기
      ]
    },
    {
      "type": "fill_blank",
      "title": "B. 빈칸 채우기",
      "instructions": "알맞은 단어를 골라 문장을 완성하세요.",
      "questions": [
        { "id": 1, "question": "She ___ to school every day. (go/goes/going/gone)", "answer": "goes", "hint": "3인칭 단수", "options": ["go", "goes", "going", "gone"] }
        // 영상 내용 기반 6개 문제, options에 정답 포함 4개 선택지
      ]
    },
    {
      "type": "translate",
      "title": "C. 문장 해석",
      "instructions": "다음 영어 문장을 한국어로 해석하세요.",
      "questions": [
        { "id": 1, "question": "영어 문장 (${cfg.sentenceLength} sentences)", "answer": "한국어 해석" }
        // 영상에서 중요한 문장 5개
      ]
    }
  ]
}`

    const result = await model.generateContent(prompt)
    const text = result.response.text().trim()
    const jsonStart = text.indexOf('{')
    const jsonEnd = text.lastIndexOf('}')
    if (jsonStart === -1 || jsonEnd === -1) throw new Error('Invalid JSON response')

    const data = JSON.parse(text.slice(jsonStart, jsonEnd + 1))
    return NextResponse.json(data)
  } catch (e) {
    console.error('[Worksheet API] error:', e)
    return NextResponse.json({ error: '워크시트 생성에 실패했습니다.' }, { status: 500 })
  }
}
