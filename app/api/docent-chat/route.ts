import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY!)

interface ChatMessage {
  role: 'user' | 'model'
  content: string
}

export async function POST(req: NextRequest) {
  try {
    const { messages, summaryContext, fullTranscript, title, category, positionHint, nearbyTranscript }: {
      messages: ChatMessage[]
      summaryContext: string
      fullTranscript?: string
      title: string
      category: string
      positionHint?: string
      nearbyTranscript?: string
    } = await req.json()

    if (!messages?.length) {
      return NextResponse.json({ error: '메시지가 필요합니다.' }, { status: 400 })
    }

    // 전체 자막: Gemini 2.5 Flash는 1M 토큰 컨텍스트 — 5시간 영상도 80K자면 충분
    const fullTranscriptSection = fullTranscript
      ? `\n---전체 자막 전문---\n${fullTranscript.slice(0, 80000)}\n---`
      : ''

    // 현재 구간 자막: 위치 기반 질문용 보조 참고
    const nearbySection = nearbyTranscript
      ? `\n---현재 재생 구간 자막 (${positionHint ?? ''})---\n${nearbyTranscript}\n---`
      : ''

    // 요약: 메타 정보 및 전반적 구조 파악용
    const summarySection = summaryContext
      ? `\n---콘텐츠 요약 (참고용)---\n${summaryContext.slice(0, 1500)}\n---`
      : ''

    const systemInstructionText = `당신은 NextCurator의 AI 도슨트입니다.
도슨트(Docent)는 영상 내용을 시청자에게 깊이 있게 해설해주는 전문 가이드입니다.

---콘텐츠 정보---
제목: ${title}
카테고리: ${category}
${fullTranscriptSection}${nearbySection}${summarySection}

역할 및 규칙:
- 답변의 근거는 반드시 "전체 자막 전문"에서 먼저 찾으세요. 자막이 가장 정확한 1차 정보원입니다.
- 사용자가 "방금", "지금", "여기서" 같은 표현을 쓰면 "현재 재생 구간 자막"을 추가로 참고하세요.
- 요약은 전체 구조 파악 시에만 보조적으로 참고하고, 구체적 내용은 자막 기반으로 답변하세요.
- 자막에 없는 내용을 일반 지식으로 보완할 때는 "영상에는 없지만~"으로 명확히 구분하세요.
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
