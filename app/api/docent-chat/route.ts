import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { GoogleAICacheManager } from '@google/generative-ai/server'

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY!)
const cacheManager = new GoogleAICacheManager(process.env.GOOGLE_GENERATIVE_AI_API_KEY!)

// Gemini 2.5 Flash context caching 최소 토큰: 32,768
// 한국어 기준 약 15,000자 이상이면 캐싱 효과 있음
const CACHE_MIN_CHARS = 15000

interface ChatMessage {
  role: 'user' | 'model'
  content: string
}

export async function POST(req: NextRequest) {
  try {
    const { messages, summaryContext, fullTranscript, title, category, positionHint, nearbyTranscript, cacheId }: {
      messages: ChatMessage[]
      summaryContext: string
      fullTranscript?: string
      title: string
      category: string
      positionHint?: string
      nearbyTranscript?: string
      cacheId?: string
    } = await req.json()

    if (!messages?.length) {
      return NextResponse.json({ error: '메시지가 필요합니다.' }, { status: 400 })
    }

    const nearbySection = nearbyTranscript
      ? `\n---현재 재생 구간 자막 (${positionHint ?? ''})---\n${nearbyTranscript}\n---`
      : ''

    const summarySection = summaryContext
      ? `\n---콘텐츠 요약 (참고용)---\n${summaryContext.slice(0, 1500)}\n---`
      : ''

    const baseSystemInstruction = `당신은 NextCurator의 AI 도슨트입니다.
도슨트(Docent)는 영상 내용을 시청자에게 깊이 있게 해설해주는 전문 가이드입니다.

---콘텐츠 정보---
제목: ${title}
카테고리: ${category}

역할 및 규칙:
- 답변의 근거는 반드시 "전체 자막 전문"에서 먼저 찾으세요. 자막이 가장 정확한 1차 정보원입니다.
- 사용자가 "방금", "지금", "여기서" 같은 표현을 쓰면 "현재 재생 구간 자막"을 추가로 참고하세요.
- 요약은 전체 구조 파악 시에만 보조적으로 참고하고, 구체적 내용은 자막 기반으로 답변하세요.
- 자막에 없는 내용을 일반 지식으로 보완할 때는 "영상에는 없지만~"으로 명확히 구분하세요.
- 어려운 개념은 쉬운 비유나 예시를 들어 설명하세요.
- 답변은 3~5문장으로 간결하게, 필요시 불릿 포인트 사용.
- 한국어로 친근하게 답변하세요.`

    const transcript = fullTranscript?.slice(0, 80000) ?? ''
    const useCache = transcript.length >= CACHE_MIN_CHARS

    let model
    let newCacheId: string | undefined

    if (useCache) {
      if (cacheId) {
        // 기존 캐시 재사용 — 80K 자막 재전송 없음
        try {
          const cachedContent = await cacheManager.get(cacheId)
          model = genAI.getGenerativeModelFromCachedContent(cachedContent, {
            generationConfig: { temperature: 0.7, maxOutputTokens: 4096 },
          })
        } catch {
          // 캐시 만료된 경우 새로 생성
          model = null
        }
      }

      if (!model) {
        // 새 캐시 생성 (세션 2시간 유지)
        const cachedContent = await cacheManager.create({
          model: 'models/gemini-2.5-flash',
          displayName: `docent-${title.slice(0, 40)}`,
          systemInstruction: baseSystemInstruction,
          contents: [{
            role: 'user',
            parts: [{ text: `---전체 자막 전문---\n${transcript}\n---` }],
          }, {
            role: 'model',
            parts: [{ text: '자막을 모두 읽었습니다. 질문해 주세요.' }],
          }],
          ttlSeconds: 7200,
        })
        newCacheId = cachedContent.name
        model = genAI.getGenerativeModelFromCachedContent(cachedContent, {
          generationConfig: { temperature: 0.7, maxOutputTokens: 4096 },
        })
      }
    } else {
      // 자막이 짧아서 캐싱 불필요 — 기존 방식
      const fullTranscriptSection = transcript
        ? `\n---전체 자막 전문---\n${transcript}\n---`
        : ''
      model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        systemInstruction: baseSystemInstruction + fullTranscriptSection,
        generationConfig: { temperature: 0.7, maxOutputTokens: 4096 },
      })
    }

    // 캐시 사용 시 히스토리에서 자막 초기 교환 2개 제외 (캐시에 이미 포함됨)
    const historyOffset = useCache ? 0 : 0
    const history = messages.slice(historyOffset, -1).map(m => ({
      role: m.role as 'user' | 'model',
      parts: [{ text: m.content }],
    }))

    // 현재 구간 자막은 동적이므로 마지막 메시지에 추가
    const lastContent = messages[messages.length - 1].content
    const lastMessage = nearbySection
      ? `${lastContent}\n\n[참고: 현재 재생 위치 자막]${nearbySection}${summarySection}`
      : `${lastContent}${summarySection}`

    const chat = model.startChat({ history })
    const result = await chat.sendMessage(lastMessage)
    const text = result.response.text()

    return NextResponse.json({ text, cacheId: newCacheId ?? cacheId })
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e)
    console.error('[Docent Chat API] error:', errMsg)
    return NextResponse.json({ error: '오류가 발생했습니다.', detail: errMsg }, { status: 500 })
  }
}
