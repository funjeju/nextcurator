import { GoogleGenerativeAI } from '@google/generative-ai'
import { Category, SummaryData } from '@/types/summary'

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY!)

const classifyModel = genAI.getGenerativeModel({
  model: 'gemini-2.5-flash',
  systemInstruction: 'You are a JSON generator. Always respond with valid JSON only. No explanation, no markdown, no code blocks.',
  generationConfig: {
    temperature: 0.1,
    maxOutputTokens: 1000,
    // @ts-expect-error thinkingConfig not yet in types but supported
    thinkingConfig: { thinkingBudget: 0 },
  },
})

const summaryModel = genAI.getGenerativeModel({
  model: 'gemini-2.5-flash',
  systemInstruction: 'You are a JSON generator. Always respond with valid JSON only. No explanation, no markdown, no code blocks. Start with { and end with }.',
  generationConfig: {
    temperature: 0.3,
    maxOutputTokens: 16384,
    // @ts-expect-error thinkingConfig not yet in types but supported
    thinkingConfig: { thinkingBudget: 0 },
  },
})

const VALID_CATEGORIES: Category[] = ['recipe', 'english', 'learning', 'news', 'selfdev', 'travel']

function extractJSON(text: string): unknown {
  // 마크다운 코드블록 제거 후 JSON 추출
  const stripped = text.replace(/```(?:json)?\n?/g, '').replace(/```/g, '').trim()
  const match = stripped.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('No JSON in response')
  return JSON.parse(match[0])
}

export async function classifyCategory(transcript: string): Promise<{ category: Category; confidence: number }> {
  const result = await classifyModel.generateContent(`Classify this YouTube transcript into exactly one of these categories:
- "recipe": cooking, baking, food preparation
- "english": videos whose MAIN PURPOSE is teaching English language (lessons, expressions, grammar). NOT just videos that contain English words.
- "learning": academic lectures, science, math, history, certifications
- "news": news, current events, reviews, analysis, information
- "selfdev": self-improvement, motivation, psychology, meditation
- "travel": travel vlogs, place introductions, tourism, local food tours

Transcript:
${transcript.slice(0, 2000)}

Respond with JSON: {"category": "news", "confidence": 0.95}`)

  const text = result.response.text().trim()
  const parsed = extractJSON(text) as { category: Category; confidence: number }

  if (!VALID_CATEGORIES.includes(parsed.category)) {
    return { category: 'news', confidence: 0.5 }
  }
  return parsed
}

const SUMMARY_PROMPTS: Record<Category, string> = {
  recipe: `다음 요리 영상 자막을 분석해서 레시피 JSON을 만드세요.

{"dish_name":"요리명","difficulty":"초보","total_time":"시간","servings":"인분","ingredients":[{"name":"재료","amount":"분량"}],"steps":[{"step":1,"desc":"설명","timestamp":"MM:SS"}],"key_tips":["팁"]}`,

  english: `다음 영어학습 영상 자막을 분석해서 학습카드 JSON을 만드세요.

{"song_or_title":"제목","artist":"아티스트","expressions":[{"text":"표현","meaning":"의미","note":"설명","timestamp":"MM:SS"}],"vocabulary":[{"word":"단어","meaning":"뜻","pronunciation":"발음"}],"patterns":["패턴"],"cultural_context":"맥락"}`,

  learning: `다음 학습 영상 자막을 분석해서 학습정리 JSON을 만드세요.

{"subject":"주제","concepts":[{"name":"개념","desc":"설명","timestamp":"MM:SS"}],"key_points":[{"point":"포인트","timestamp":"MM:SS"}],"examples":[{"desc":"예시","timestamp":"MM:SS"}]}`,

  news: `다음 뉴스 영상 자막을 분석해서 브리핑 JSON을 만드세요.

{"headline":"제목","three_line_summary":"요약","five_w":{"who":"누가","when":"언제","where":"어디서","what":"무엇","how":"어떻게","why":"왜"},"background":{"desc":"배경","timestamp":"MM:SS"},"implications":[{"point":"시사점","timestamp":"MM:SS"}]}`,

  selfdev: `다음 자기계발 영상 자막을 분석해서 인사이트 JSON을 만드세요.

{"core_message":{"text":"메시지","timestamp":"MM:SS"},"insights":[{"point":"인사이트","timestamp":"MM:SS"}],"checklist":["항목"],"quotes":[{"text":"인용","timestamp":"MM:SS"}]}`,

  travel: `다음 여행 영상 자막을 분석해서 가이드 JSON을 만드세요.

{"destination":"여행지","places":[{"name":"장소","desc":"설명","price":"가격","tip":"팁","timestamp":"MM:SS"}],"route":"동선","practical_info":["정보"],"warnings":["주의"]}`,
}

export async function generateSummary(category: Category, transcript: string): Promise<SummaryData> {
  const prompt = SUMMARY_PROMPTS[category]
  const result = await summaryModel.generateContent(`${prompt}

자막:
${transcript.slice(0, 8000)}`)

  const text = result.response.text().trim()
  return extractJSON(text) as SummaryData
}
