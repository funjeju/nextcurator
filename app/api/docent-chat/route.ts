import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY!)

interface ChatMessage {
  role: 'user' | 'model'
  content: string
}

export async function POST(req: NextRequest) {
  try {
    const { messages, summaryContext, title, category }: {
      messages: ChatMessage[]
      summaryContext: string
      title: string
      category: string
    } = await req.json()

    if (!messages?.length) {
      return NextResponse.json({ error: '메시지가 필요합니다.' }, { status: 400 })
    }

    const trimmedContext = summaryContext.length > 3000
      ? summaryContext.slice(0, 3000) + '...(생략)'
      : summaryContext

    const systemInstructionText = `당신은 NextCurator의 AI 도슨트입니다.
도슨트(Docent)는 전시·강연 내용을 관람객에게 깊이 있게 해설해주는 전문 가이드입니다.
당신은 아래 콘텐츠 요약 내용을 완전히 이해하고 있으며, 사용자가 내용을 더 잘 이해할 수 있도록 돕습니다.

---콘텐츠 정보---
제목: ${title}
카테고리: ${category}
요약 내용:
${trimmedContext}
---

역할 및 규칙:
- 위 요약 내용을 기반으로 사용자의 질문에 친절하고 명확하게 답변하세요.
- 요약에 없는 내용은 일반 지식으로 보완할 수 있지만, "요약에는 없지만~" 으로 명확히 구분하세요.
- 사용자가 특정 구절을 인용해서 질문하면 해당 부분에 집중해서 답변하세요.
- 어려운 개념은 쉬운 비유나 예시를 들어 설명하세요.
- 답변은 3~5문장으로 간결하게, 필요시 불릿 포인트 사용.
- 한국어로 친근하게 답변하세요.`

    // systemInstruction을 모델 생성 시점에 설정 (SDK가 Content 객체로 올바르게 포매팅)
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: systemInstructionText,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1500,
      },
    })

    const history = messages.slice(0, -1).map(m => ({
      role: m.role as 'user' | 'model',
      parts: [{ text: m.content }],
    }))

    const chat = model.startChat({ history })
    const lastMessage = messages[messages.length - 1]
    const result = await chat.sendMessage(lastMessage.content)
    const text = result.response.text()

    return NextResponse.json({ text })
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e)
    console.error('[Docent Chat API] error:', errMsg)
    return NextResponse.json({ error: '오류가 발생했습니다.', detail: errMsg }, { status: 500 })
  }
}
