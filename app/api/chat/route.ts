import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY!)

const chatModel = genAI.getGenerativeModel({
  model: 'gemini-2.5-flash',
  generationConfig: {
    temperature: 0.7,
    maxOutputTokens: 1024,
    // @ts-expect-error thinkingConfig not yet in types
    thinkingConfig: { thinkingBudget: 0 },
  },
})

interface SummaryCtx {
  id: string
  title: string
  category: string
  channel?: string
  summary?: unknown
  tags?: string[]
}

interface ChatMessage {
  role: 'user' | 'model'
  content: string
}

const CATEGORY_LABEL: Record<string, string> = {
  recipe: '요리', english: '영어', learning: '학습', news: '뉴스',
  selfdev: '자기계발', travel: '여행', story: '스토리', tips: '팁',
}

export async function POST(req: NextRequest) {
  try {
    const { messages, summaries, source }: {
      messages: ChatMessage[]
      summaries: SummaryCtx[]
      source: 'mypage' | 'square'
    } = await req.json()

    if (!messages?.length) {
      return NextResponse.json({ error: '메시지가 필요합니다.' }, { status: 400 })
    }

    const contextLabel = source === 'mypage' ? '사용자의 저장된 콘텐츠' : '스퀘어 공개 콘텐츠'

    const summaryList = summaries.slice(0, 100).map((s, i) => {
      const cat = CATEGORY_LABEL[s.category] ?? s.category
      const summarySnippet = s.summary
        ? (typeof s.summary === 'object'
            ? JSON.stringify(s.summary).slice(0, 150)
            : String(s.summary).slice(0, 150))
        : ''
      const tags = s.tags?.join(', ') ?? ''
      return [
        `[${i + 1}] ID:${s.id} | [${cat}] "${s.title}"${s.channel ? ` (${s.channel})` : ''}`,
        tags ? `태그: ${tags}` : '',
        summarySnippet ? `요약: ${summarySnippet}...` : '',
      ].filter(Boolean).join(' | ')
    }).join('\n')

    const systemInstruction = `당신은 NextCurator의 AI 어시스턴트입니다.
현재 컨텍스트: ${contextLabel} (총 ${summaries.length}개)

---콘텐츠 목록---
${summaryList}
---

답변 규칙:
- 한국어로 친근하게 2~4문장으로 답변하세요.
- 관련 콘텐츠를 찾아달라는 요청이면 응답 맨 끝에 "[RELATED:id1,id2]" 형식으로 ID를 붙이세요.
- 목록에 없는 내용은 "저장된 콘텐츠에서 찾지 못했어요"라고 솔직하게 말하세요.
- [RELATED:...] 태그는 사용자에게 보이지 않으므로 반드시 마지막에 단독으로 붙이세요.`

    const history = messages.slice(0, -1).map(m => ({
      role: m.role as 'user' | 'model',
      parts: [{ text: m.content }],
    }))

    const chat = chatModel.startChat({ systemInstruction, history })
    const lastMessage = messages[messages.length - 1]
    const result = await chat.sendMessage(lastMessage.content)
    const rawText = result.response.text()

    // Extract [RELATED:id1,id2] tags
    let relatedIds: string[] = []
    const relatedMatch = rawText.match(/\[RELATED:([^\]]+)\]/)
    if (relatedMatch) {
      relatedIds = relatedMatch[1].split(',').map(id => id.trim()).filter(Boolean)
    }
    const text = rawText.replace(/\[RELATED:[^\]]*\]/g, '').trim()

    return NextResponse.json({ text, relatedIds })
  } catch (e) {
    console.error('[Chat API] error:', e)
    return NextResponse.json({ error: '오류가 발생했습니다.' }, { status: 500 })
  }
}
