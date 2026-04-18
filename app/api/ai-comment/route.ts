import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY!)

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!
const API_KEY    = process.env.NEXT_PUBLIC_FIREBASE_API_KEY!
const BASE       = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`

interface ThreadMsg {
  role: 'user' | 'ai'
  text: string
  userName?: string
}

// Firestore REST API로 AI 댓글 저장
async function saveAIComment(data: {
  sessionId: string
  parentId: string
  text: string
}): Promise<{ id: string; createdAt: Date }> {
  const fields: Record<string, unknown> = {
    sessionId:       { stringValue: data.sessionId },
    parentId:        { stringValue: data.parentId },
    segmentId:       { nullValue: null },
    segmentLabel:    { nullValue: null },
    userId:          { stringValue: 'ai-bot' },
    userDisplayName: { stringValue: 'AI 토론봇' },
    userPhotoURL:    { stringValue: '' },
    text:            { stringValue: data.text },
    isAI:            { booleanValue: true },
    createdAt:       { timestampValue: new Date().toISOString() },
  }

  const res = await fetch(`${BASE}/comments?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Firestore write failed (${res.status}): ${body}`)
  }

  const doc = await res.json()
  // name 형식: "projects/.../documents/comments/{id}"
  const id = doc.name?.split('/').pop() ?? crypto.randomUUID()
  return { id, createdAt: new Date() }
}

export async function POST(req: NextRequest) {
  try {
    const { commentText, threadContext, summaryContext, title, category, sessionId, parentId }: {
      commentText: string
      threadContext?: ThreadMsg[]
      summaryContext?: string
      title: string
      category: string
      sessionId: string
      parentId: string
    } = await req.json()

    const categoryNames: Record<string, string> = {
      recipe: '요리/레시피', english: '영어 학습', learning: '학습/강의',
      news: '뉴스/시사', selfdev: '자기계발', travel: '여행',
      story: '스토리', tips: '꿀팁', report: '보고서/분석',
    }

    const systemInstruction = `당신은 NextCurator의 AI 토론 파트너입니다.
유저가 YouTube 영상 "${title}" (카테고리: ${categoryNames[category] ?? category})에 댓글을 달면, 그 댓글에 대해 반응하세요.

[핵심 원칙 — 반드시 따를 것]

1. 반박/보완하되 정답을 강요하지 않는다
   - 유저 의견을 "틀렸다"고 단정하지 마세요
   - "이런 관점도 있습니다", "이런 반론도 가능합니다" 식의 열린 대화체를 쓰세요
   - 유저의 핵심 주장을 먼저 인정하거나 공감한 뒤, 다른 시각을 덧붙이세요

2. 영상 맥락 + 외부 지식 + 팩트 기반
   - 영상 내용만 반복하면 안 됩니다. 영상 밖의 관련 통계, 역사적 사례, 반례, 최신 동향까지 끌어와 가치를 더하세요
   - 구체적인 수치나 사례를 들 수 있다면 반드시 포함하세요

3. 대화의 촉매 역할 — 종결자가 되지 않는다
   - AI가 최종 결론을 내리지 마세요
   - "어떻게 생각하시나요?", "이 부분은 어떻게 보세요?" 같은 질문으로 마무리하세요
   - 다른 독자도 대화에 참여할 수 있도록 열린 여지를 남기세요

[형식]
- 3~5문장, 친근한 존댓말
- 단순 칭찬("맞아요!", "좋은 의견이에요!") 금지

${summaryContext ? `---영상 요약 (참고용)---\n${summaryContext.slice(0, 1000)}\n---` : ''}`

    // 뉴스/시사/학습 카테고리는 Google Search grounding으로 최신 팩트 보강
    const needsSearch = ['news', 'learning', 'selfdev', 'report'].includes(category)
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction,
      generationConfig: { temperature: 0.8, maxOutputTokens: 512 },
      ...(needsSearch ? { tools: [{ googleSearch: {} }] } : {}),
    } as Parameters<typeof genAI.getGenerativeModel>[0])

    // 스레드 히스토리 구성
    const history = (threadContext ?? []).slice(0, -1).map(m => ({
      role: m.role === 'ai' ? 'model' as const : 'user' as const,
      parts: [{ text: m.role === 'ai' ? m.text : `${m.userName ?? '유저'}: ${m.text}` }],
    }))

    const chat = model.startChat({ history })
    const result = await chat.sendMessage(commentText)
    const text = result.response.text()

    // Firestore에 AI 댓글 저장 (서버에서 직접)
    const saved = await saveAIComment({ sessionId, parentId, text })

    const comment = {
      id: saved.id,
      sessionId,
      segmentId: null,
      segmentLabel: null,
      parentId,
      userId: 'ai-bot',
      userDisplayName: 'AI 토론봇',
      userPhotoURL: '',
      text,
      isAI: true,
      createdAt: saved.createdAt,
    }

    return NextResponse.json({ text, comment })
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e)
    console.error('[AI Comment API]', errMsg)
    return NextResponse.json({ error: errMsg }, { status: 500 })
  }
}
