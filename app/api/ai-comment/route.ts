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

    const systemInstruction = `당신은 유시민 스타일의 AI 논객입니다.
유저가 YouTube 영상 "${title}" (카테고리: ${categoryNames[category] ?? category})에 단 댓글에 반응하세요.

[페르소나 — 유시민 스타일]
- 논리적이고 핵심을 찌르는 문장. 군더더기 없이 명료하게.
- 감정보다 근거. 주장에는 반드시 이유가 따라온다.
- 동의할 땐 쿨하게, 반론할 땐 정중하지만 날카롭게.
- 가끔 약간의 아이러니나 위트를 섞는다. 하지만 비아냥은 금지.
- 결론을 강요하지 않는다. "저는 이렇게 봅니다만, 어떻게 생각하세요?" 식으로 열어둔다.
- 반말 절대 금지. 존댓말을 쓰되 딱딱하지 않게.

[핵심 원칙]
- 유저 의견에 먼저 공감하거나 핵심을 짚은 뒤, 다른 각도의 시각을 덧붙인다.
- 영상 내용 + 외부 지식(통계, 역사적 사례, 반례)을 근거로 삼는다.
- 최종 결론은 내리지 않는다. 질문으로 마무리해 대화를 이어간다.

[형식 — 엄수]
- 반드시 **300자 이내** (한글 기준). 초과 금지.
- 2~3문장으로 압축. 장황한 설명 금지.
- "맞아요!", "좋은 의견이에요!" 같은 공허한 칭찬 금지.

${summaryContext ? `---영상 요약 (참고용)---\n${summaryContext.slice(0, 1000)}\n---` : ''}`

    // 뉴스/시사/학습 카테고리는 Google Search grounding으로 최신 팩트 보강
    const needsSearch = ['news', 'learning', 'selfdev', 'report'].includes(category)
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction,
      generationConfig: { temperature: 0.85, maxOutputTokens: 8192 },
      ...(needsSearch ? { tools: [{ googleSearch: {} }] } : {}),
    } as Parameters<typeof genAI.getGenerativeModel>[0])

    // 스레드 히스토리 구성
    const history = (threadContext ?? []).slice(0, -1).map(m => ({
      role: m.role === 'ai' ? 'model' as const : 'user' as const,
      parts: [{ text: m.role === 'ai' ? m.text : `${m.userName ?? '유저'}: ${m.text}` }],
    }))

    const chat = model.startChat({ history })
    const result = await chat.sendMessage(commentText)

    let text = result.response.text().trim()
    const finishReason = result.response.candidates?.[0]?.finishReason
    const wasTruncated = finishReason === 'MAX_TOKENS'

    // 내부 검증 루프: 350자 초과 시 AI에게 직접 줄이도록 요청 (최대 2회)
    const LIMIT = 350
    for (let attempt = 0; attempt < 2 && text.length > LIMIT; attempt++) {
      const shortenResult = await chat.sendMessage(
        `방금 답변이 ${text.length}자입니다. ${LIMIT}자 이내로 핵심만 남기고 줄여주세요. 줄인 답변만 출력하세요.`
      )
      const shorter = shortenResult.response.text().trim()
      if (shorter.length > 0) text = shorter
    }

    // 그래도 초과면 강제 문장 단위 절삭 (마지막 안전망)
    if (text.length > LIMIT) {
      const sentences = text.match(/[^.!?～]+[.!?～]?/g) ?? []
      let trimmed = ''
      for (const s of sentences) {
        if ((trimmed + s).length > LIMIT) break
        trimmed += s
      }
      text = trimmed.trim() || text.slice(0, LIMIT)
    }

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

    return NextResponse.json({ text, comment, truncated: wasTruncated })
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e)
    console.error('[AI Comment API]', errMsg)
    return NextResponse.json({ error: errMsg }, { status: 500 })
  }
}
