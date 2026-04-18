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

// 스토리 전용 모델 — 웹소설 서술 품질을 위해 temperature 높게
const storyModel = genAI.getGenerativeModel({
  model: 'gemini-2.5-flash',
  systemInstruction: 'You are a JSON generator. Always respond with valid JSON only. No explanation, no markdown, no code blocks. Start with { and end with }.',
  generationConfig: {
    temperature: 0.6,
    maxOutputTokens: 16384,
    // @ts-expect-error thinkingConfig not yet in types but supported
    thinkingConfig: { thinkingBudget: 0 },
  },
})

const VALID_CATEGORIES: Category[] = ['recipe', 'english', 'learning', 'news', 'selfdev', 'travel', 'story', 'tips', 'report']

/**
 * AI 응답에서 JSON을 견고하게 추출합니다.
 * - 마크다운 코드 블록 제거
 * - 마지막 쉼표(Trailing commas) 제거
 * - 제어 문자 정리
 */
function extractJSON(text: string): unknown {
  // 1. 마크다운 코드블록 제거
  let cleaned = text.replace(/```(?:json)?\n?/gi, '').replace(/```/g, '').trim()

  // 2. JSON 부분만 추출 ({ ... })
  const match = cleaned.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('응답에서 JSON 구조를 찾을 수 없습니다.')
  cleaned = match[0]

  try {
    return JSON.parse(cleaned)
  } catch {
    // 3. Trailing comma 제거
    try {
      cleaned = cleaned.replace(/,\s*([}\]])/g, '$1')
      return JSON.parse(cleaned)
    } catch {
      // 4. JSON 문자열 값 안의 raw 제어문자 이스케이프 (Gemini가 가끔 넣는 literal \n 등)
      try {
        cleaned = cleaned.replace(/"(?:[^"\\]|\\.)*"/g, m =>
          m.replace(/[\u0000-\u001F]/g, c => {
            if (c === '\n') return '\\n'
            if (c === '\r') return '\\r'
            if (c === '\t') return '\\t'
            if (c === '\b') return '\\b'
            if (c === '\f') return '\\f'
            return ''  // 나머지 제어문자는 제거
          })
        )
        return JSON.parse(cleaned)
      } catch (finalError) {
        console.error('[JSON Parse Error Source]:', text.slice(0, 500))
        throw finalError
      }
    }
  }
}

export async function classifyCategory(transcript: string): Promise<{ category: Category; confidence: number }> {
  const result = await classifyModel.generateContent(`Classify this YouTube transcript into exactly one of these categories:
- "recipe": cooking, baking, food preparation
- "english": videos whose MAIN PURPOSE is teaching English language (lessons, expressions, grammar). NOT just videos that contain English words.
- "learning": academic lectures, science, math, history, certifications
- "news": news, current events, reviews, analysis, information
- "selfdev": self-improvement, motivation, psychology, meditation
- "travel": travel vlogs, place introductions, tourism, local food tours
- "story": drama, movies, storytelling, gossip, narrative content focusing on a sequence of events
- "tips": life hacks, how-to guides, productivity tips, daily life tips, saving money, home organization, app/tool usage tips. Use this when the video presents a numbered or listed set of practical tips/hacks.

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

재료는 역할에 따라 그룹으로 분류하세요. 예: "메인 재료", "양념", "육수", "소스", "고명", "반죽", "채소" 등 해당되는 그룹만 사용하세요. 그룹이 1개라도 ingredient_groups를 사용하세요.

{"square_meta":{"tags":["키워드1","키워드2","키워드3","키워드4","키워드5"],"topic_cluster":"대주제","vibe":"분위기"},"dish_name":"요리명","difficulty":"초보","total_time":"시간","servings":"인분","ingredient_groups":[{"group":"메인 재료","items":[{"name":"재료","amount":"분량"}]},{"group":"양념","items":[{"name":"재료","amount":"분량"}]}],"steps":[{"step":1,"desc":"설명","timestamp":"MM:SS"}],"key_tips":["팁"]}`,

  english: `다음 영어 영상 자막을 분석해서 한국인 영어 학습자를 위한 학습카드 JSON을 만드세요.

[필수 지침]
- 이 결과물은 한국인이 영어를 공부하기 위한 자료입니다. 모든 설명(meaning, note, desc)은 반드시 한국어로 작성하세요.
- expressions: 영상에서 실제로 사용된 핵심 영어 표현을 그대로 추출하고, 한국어로 의미와 뉘앙스를 설명하세요.
- vocabulary: 고급 어휘나 헷갈리기 쉬운 단어를 선별하고, 한국어로 뜻과 예문 설명을 담으세요.
- patterns: 영상에서 반복되는 문법 패턴이나 표현 구조를 "영어 패턴 → 한국어 설명" 형식으로 작성하세요.
- cultural_context: 문화적 배경이나 뉘앙스를 한국어로 설명하세요.
- key_message: 이 영상의 핵심 내용을 한국어로 2~3문장 요약하세요.

{"square_meta":{"tags":["키워드1","키워드2","키워드3","키워드4","키워드5"],"topic_cluster":"대주제","vibe":"분위기"},"title":"영상 제목(영어)","key_message":"영상 핵심 내용 한국어 요약 2~3문장","expressions":[{"text":"영어 원문 표현","meaning":"한국어 의미","note":"한국어로 뉘앙스·사용법 설명","timestamp":"MM:SS"}],"vocabulary":[{"word":"영어 단어","meaning":"한국어 뜻","example":"영어 예문","example_ko":"한국어 번역"}],"patterns":[{"pattern":"영어 문법/표현 패턴","desc":"한국어 설명"}],"cultural_context":"문화적 맥락 한국어 설명"}`,

  learning: `다음 학습 영상 자막을 분석해서 학습정리 JSON을 만드세요.

[필수 지침]
- concepts의 desc는 "이 개념이 무엇인지"와 "왜 중요한지"를 2문장으로 설명하세요. 단순 정의에 그치지 말고, 이해를 돕는 맥락을 담으세요.
- key_points는 "이것만 알면 된다"는 핵심 인사이트를 완전한 문장으로 써주세요.
- examples는 강사가 든 구체적인 예시·비유·사례를 원문에 가깝게 재현하세요.

{"square_meta":{"tags":["키워드1","키워드2","키워드3","키워드4","키워드5"],"topic_cluster":"대주제","vibe":"분위기"},"subject":"주제","concepts":[{"name":"개념명","desc":"개념 설명 2문장 (정의 + 중요성/맥락)","timestamp":"MM:SS"}],"key_points":[{"point":"핵심 포인트 완전한 문장","timestamp":"MM:SS"}],"examples":[{"desc":"강사가 든 구체적 예시나 비유","timestamp":"MM:SS"}]}`,

  news: `자막을 처음부터 끝까지 읽고, 이 뉴스의 핵심 사건·사실만 추출해서 JSON을 완성하세요.

[필수 지침]
- 자막에 나온 실제 인물명·기관명·날짜·장소·수치를 그대로 사용하세요. 추측하거나 일반론으로 채우지 마세요.
- headline: 이 뉴스의 핵심 사건을 담은 제목 (기사 헤드라인처럼).
- three_line_summary: 반드시 3개의 독립 문장. 1문장=무슨 일이 발생했는가, 2문장=왜 발생했는가(배경·원인), 3문장=결과·현재 상황 또는 전망. 줄바꿈(\n)으로 구분.
- five_w: 이 뉴스 사건을 관통하는 육하원칙. 각 항목은 구체적인 사실이어야 함.
  · who: 사건의 핵심 주체 (인물명 또는 기관명 명시)
  · when: 사건 발생 시점 (날짜·시간 등 자막에 언급된 시점)
  · where: 사건 발생 장소 또는 국가·지역
  · what: 실제로 일어난 일 — 가장 구체적으로, 행동·결정·사건을 직접 서술
  · how: 어떤 경위나 방법으로 벌어졌는지 (과정·절차·수단)
  · why: 자막에 명시된 원인·동기·이유 (없으면 "" 로 둘 것)
- background: 이번 사건 이전에 있었던 관련 맥락 또는 역사적 배경 (현재 사건 내용 반복 금지).
- implications: 2~4개, 서로 겹치지 않는 독립적 시사점. 자막 근거 기반으로 작성.

{"square_meta":{"tags":["키워드1","키워드2","키워드3","키워드4","키워드5"],"topic_cluster":"대주제","vibe":"분위기"},"headline":"핵심 사건 중심 제목","three_line_summary":"무슨 일 문장.\n왜 발생했나 문장.\n결과·전망 문장.","five_w":{"who":"","when":"","where":"","what":"","how":"","why":""},"background":{"desc":"","timestamp":"MM:SS"},"implications":[{"point":"","timestamp":"MM:SS"}]}`,

  selfdev: `다음 자기계발 영상 자막을 분석해서 인사이트 JSON을 만드세요.

[필수 지침]
- core_message: 이 영상이 전하려는 단 하나의 핵심 메시지를 명확하고 임팩트 있게 한 문장으로.
- insights: 단순 나열이 아닌, "왜 이것이 삶을 바꾸는가"라는 관점에서 각 인사이트를 2문장으로 서술. 번화한 자기계발서 문체보다는 솔직하고 설득력 있게.
- checklist: 내일 당장 실행 가능한 행동으로 구체화. "~하기" 동사형으로.
- quotes: 영상에 나온 인상적인 실제 발언이나 핵심 문장을 그대로.

{"square_meta":{"tags":["키워드1","키워드2","키워드3","키워드4","키워드5"],"topic_cluster":"대주제","vibe":"분위기"},"core_message":{"text":"핵심 메시지 한 문장","timestamp":"MM:SS"},"insights":[{"point":"인사이트 2문장 (관찰 + 이유/의미)","timestamp":"MM:SS"}],"checklist":["내일 당장 실행 가능한 행동 (~하기 형식)"],"quotes":[{"text":"영상에서 나온 인상적인 실제 발언","timestamp":"MM:SS"}]}`,

  travel: `다음 여행 영상 자막을 분석해서 가이드 JSON을 만드세요.

{"square_meta":{"tags":["키워드1","키워드2","키워드3","키워드4","키워드5"],"topic_cluster":"대주제","vibe":"분위기"},"destination":"여행지","places":[{"name":"장소","desc":"설명","price":"가격","tip":"팁","timestamp":"MM:SS"}],"route":"동선","practical_info":["정보"],"warnings":["주의"]}`,

  story: `다음 스토리/드라마/가십 영상 자막을 분석해서 독자를 몰입시키는 스토리 JSON을 만드세요.

[필수 지침 — 반드시 따를 것]
- timeline의 각 event는 마치 웹소설 화자가 독자에게 들려주듯, 생생하고 맛깔난 2~3문장으로 써주세요.
  · 인물의 감정·표정·반응·대화 뉘앙스를 살려주세요.
  · 긴장감, 반전, 웃음 포인트가 있다면 자연스럽게 녹여주세요.
  · 예시 문체: "그 순간 A의 표정이 굳어버렸다. B가 꺼낸 말 한마디가 그것도 그 타이밍에 나올 줄은 아무도 몰랐다."
  · 절대 "A가 B를 만남", "C 사건 발생" 식의 건조한 나열은 하지 마세요.
- characters의 desc는 이 인물의 성격·행동 패턴·관계를 독자가 상상할 수 있게 2문장으로.
- conclusion은 결말의 여운 또는 반전을 살린 마무리 1~2문장으로 끝내주세요.
- genre에는 실제 분위기를 반영하세요 (예: "충격 반전 썰", "풋풋한 로맨스", "억장 무너지는 드라마").

{"square_meta":{"tags":["키워드1","키워드2","키워드3","키워드4","키워드5"],"topic_cluster":"대주제","vibe":"분위기 (예: 긴장감 넘치는, 웃음 폭발, 눈물 찔끔)"},"title":"스토리 제목","genre":"장르 (예: 충격 반전 썰, 로맨스 드라마, 소름 미스터리)","characters":[{"name":"인물명 또는 호칭","desc":"성격·행동 패턴·관계를 독자가 상상할 수 있게 2문장으로"}],"timeline":[{"timestamp":"MM:SS","event":"웹소설 화자처럼 생생하게 2~3문장. 감정·뉘앙스·반전 포인트 살릴 것"}],"conclusion":"결말의 여운 또는 반전을 살린 마무리 1~2문장"}`,

  tips: `다음 팁/하우투 영상 자막을 분석해서 팁 카드 JSON을 만드세요.
각 팁은 번호와 함께 명확한 제목과 실용적인 설명으로 정리하세요. difficulty는 "쉬움"/"보통"/"어려움" 중 하나.

{"square_meta":{"tags":["키워드1","키워드2","키워드3","키워드4","키워드5"],"topic_cluster":"대주제","vibe":"분위기"},"topic":"팁 주제 (예: 집 정리 꿀팁)","tips":[{"number":1,"title":"팁 제목","desc":"팁 설명 1~2문장","timestamp":"MM:SS","difficulty":"쉬움"}],"key_message":"영상을 관통하는 핵심 메시지 한 줄","tools":["필요한 도구나 앱 등 (없으면 빈 배열)"],"top3":["지금 당장 적용할 수 있는 팁 요약 1","지금 당장 적용할 수 있는 팁 요약 2","지금 당장 적용할 수 있는 팁 요약 3"]}`,

  // voice는 별도 API에서 Gemini가 직접 처리하므로 placeholder만 사용
  voice: '',

  report: `다음 영상 자막을 분석해서 보고서 형식의 JSON을 만드세요.
sections는 영상 흐름에 따라 4~7개로 구성하고, 각 섹션은 2~3문장의 서술형 body로 작성하세요.
timestamp는 해당 섹션이 시작되는 시점(MM:SS 또는 HH:MM:SS)을 기입하세요.
context_summary는 200~300자 분량의 한국어 맥락 요약입니다.
conclusion은 한 문장 핵심 결론입니다.

{"square_meta":{"tags":["키워드1","키워드2","키워드3","키워드4","키워드5"],"topic_cluster":"대주제","vibe":"분위기"},"title":"보고서 제목","context_summary":"전체 맥락 200~300자 요약","table_of_contents":["1. 섹션 제목","2. 섹션 제목"],"sections":[{"number":1,"heading":"소제목","timestamp":"MM:SS","body":"서술형 요약 2~3문장"}],"conclusion":"핵심 결론 한 문장"}`,
}

/**
 * 긴 자막을 전체적으로 커버하도록 샘플링
 * - 6만자 이하: 전체 사용
 * - 6만자 초과: 앞 40% + 중간 30% + 뒤 30% 균등 분배
 */
function sampleTranscript(transcript: string, maxChars = 60000): string {
  if (transcript.length <= maxChars) return transcript

  const frontChars  = Math.floor(maxChars * 0.40)
  const middleChars = Math.floor(maxChars * 0.30)
  const endChars    = Math.floor(maxChars * 0.30)

  const midStart = Math.floor(transcript.length / 2) - Math.floor(middleChars / 2)
  const endStart = transcript.length - endChars

  const front  = transcript.slice(0, frontChars)
  const middle = transcript.slice(midStart, midStart + middleChars)
  const end    = transcript.slice(endStart)

  return [front, '\n...[중략]...\n', middle, '\n...[중략]...\n', end].join('')
}

export async function generateSummary(
  category: Category,
  transcript: string,
  source: 'youtube' | 'pdf' | 'web' = 'youtube',
  outputLang: 'ko' | 'original' = 'ko'
): Promise<SummaryData> {
  const prompt = SUMMARY_PROMPTS[category]
  const sampled = sampleTranscript(transcript)  // 기본 6만자

  const sourceNote = source !== 'youtube'
    ? `\n※ 이 콘텐츠는 ${source === 'pdf' ? 'PDF 문서' : '웹 페이지'}입니다. timestamp 필드는 모두 빈 문자열("")로 채우세요.`
    : ''

  // 원문 언어 출력 모드: 한국어로 쓰지 않고 원문 언어 그대로 출력
  const langNote = outputLang === 'original'
    ? '\n\n[IMPORTANT: Write ALL text values in the original language of the content (e.g. English). Do NOT translate to Korean.]'
    : ''

  const model = category === 'story' ? storyModel : summaryModel
  const result = await model.generateContent(`${prompt}${sourceNote}${langNote}

${source === 'youtube' ? '자막' : '내용'}:
${sampled}`)

  const text = result.response.text().trim()
  return extractJSON(text) as SummaryData
}

const reportModel = genAI.getGenerativeModel({
  model: 'gemini-2.5-flash',
  generationConfig: {
    temperature: 0.4,
    maxOutputTokens: 4096,
    // @ts-expect-error thinkingConfig not yet in types but supported
    thinkingConfig: { thinkingBudget: 0 },
  },
})

export async function generateReportSummary(
  category: Category,
  title: string,
  fullContext: string
): Promise<string> {
  const categoryHint: Record<Category, string> = {
    recipe:   '요리/레시피 영상',
    english:  '영어 학습 영상',
    learning: '학습/강의 영상',
    news:     '뉴스/시사 영상',
    selfdev:  '자기계발 영상',
    travel:   '여행 영상',
    story:    '스토리/드라마 영상',
    tips:     '팁/라이프핵 영상',
    voice:    '음성 녹음 메모',
    report:   '보고서 형식 정리',
  }

  const result = await reportModel.generateContent(`당신은 전문 콘텐츠 에디터입니다.
아래 "${categoryHint[category]}"의 자막/설명을 읽고, 보고서 형식의 정리 문서를 한국어로 작성하세요.

요구사항:
- 4~6개의 소제목(##)으로 구성
- 각 섹션은 2~4문장의 서술형 단락으로 작성 (글머리표 최소화)
- 첫 섹션은 반드시 "## 개요"로 시작하여 배경과 주제를 소개
- 마지막 섹션은 반드시 "## 핵심 정리"로 끝내며 결론/시사점 서술
- 중간 섹션 소제목은 내용에 맞게 자유롭게 설정
- 전체 분량: 600~900자 내외
- 마크다운 형식만 사용 (bold, 소제목만), 표나 코드블록 사용 금지

영상 제목: ${title}
카테고리: ${categoryHint[category]}

자막/내용:
${sampleTranscript(fullContext, 60000)}`)

  return result.response.text().trim()
}

/**
 * 맥락 요약 생성 — 200~300자, 검색·임베딩 최적화
 * 저장 시 1회 생성 후 Firestore에 보관
 */
export async function generateContextSummary(
  title: string,
  category: Category,
  summaryData: SummaryData
): Promise<string> {
  const categoryHint: Record<Category, string> = {
    recipe: '요리/레시피',
    english: '영어 학습',
    learning: '학습/강의',
    news: '뉴스/시사',
    selfdev: '자기계발',
    travel: '여행',
    story: '스토리/드라마',
    tips: '팁/라이프핵',
    voice: '음성 녹음 메모',
    report: '보고서 형식 정리',
  }

  const result = await classifyModel.generateContent(`다음 콘텐츠를 200~300자 이내로 맥락 요약하세요.

규칙:
- 이 텍스트는 검색과 AI 추천에 사용됩니다
- 핵심 주제, 다루는 내용, 대상 독자, 실용적 가치를 자연스러운 문장으로 담으세요
- 제목을 반복하지 말고 내용의 "맥락"을 설명하세요
- 한국어, 200~300자 이내, 단락 없이 한 문단으로

제목: ${title}
카테고리: ${categoryHint[category]}
요약 데이터: ${JSON.stringify(summaryData).slice(0, 2000)}`)

  const text = result.response.text().trim()
  return text.slice(0, 350)  // 최대 350자 안전 마진
}

export async function generateQuiz(
  category: 'english' | 'learning',
  summaryData: unknown,
  title: string
): Promise<import('@/types/summary').QuizData> {
  const hint = category === 'english'
    ? `영어 학습 요약에서 단어/표현 플래시카드와 사용법 객관식 문제를 만드세요.
flashcard: 앞면=영어 단어/표현, 뒷면=한국어 의미+예문
multiple_choice: "이 표현의 올바른 사용은?" 형태, 4개 보기`
    : `학습 요약에서 개념 확인 플래시카드와 객관식 문제를 만드세요.
flashcard: 앞면=개념명, 뒷면=설명
multiple_choice: 개념 이해 확인 문제, 4개 보기`

  const result = await classifyModel.generateContent(`${hint}

요약 데이터:
${JSON.stringify(summaryData).slice(0, 3000)}

영상 제목: ${title}

총 8~12개 문제를 만드세요. flashcard와 multiple_choice를 섞어서.
multiple_choice의 options는 정답 포함 4개 문자열 배열.

JSON 형식:
{"category":"${category}","title":"퀴즈 제목","questions":[{"type":"flashcard","question":"앞면","answer":"뒷면","hint":"힌트(선택)"},{"type":"multiple_choice","question":"문제","answer":"정답 문자열","options":["보기1","보기2","보기3","보기4"]}]}`)

  const text = result.response.text().trim()
  return extractJSON(text) as import('@/types/summary').QuizData
}

// ─────────────────────────────────────────────
// 구간별 요약 (30분+ 영상)
// ─────────────────────────────────────────────

export interface SegmentSummary {
  index: number
  startTimestamp: string
  endTimestamp: string
  headline: string
  keyPoints: string[]
}

export interface SegmentQuizQuestion {
  question: string
  options: string[]
  answer: number  // 0-based index
}

/**
 * 타임스탬프 문자열 → 초
 */
function tsToSec(ts: string): number {
  const parts = ts.split(':').map(Number)
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  return 0
}

/**
 * 자막에서 마지막 타임스탬프를 파싱하여 영상 길이(초) 추정
 */
export function estimateVideoDuration(transcript: string): number {
  const matches = [...transcript.matchAll(/\[(\d{1,2}:\d{2}(?::\d{2})?)\]/g)]
  if (matches.length === 0) return 0
  return tsToSec(matches[matches.length - 1][1])
}

/**
 * 자막을 chunkMinutes 단위 구간으로 분할
 * 각 구간: { start, end, text }
 */
export function splitTranscriptIntoChunks(
  transcript: string,
  chunkMinutes = 10
): { start: string; end: string; text: string }[] {
  const lines = transcript.split('\n').filter(l => l.trim())
  const chunkSec = chunkMinutes * 60

  // [timestamp] text 형태의 줄 파싱
  const parsed: { sec: number; ts: string; text: string }[] = []
  for (const line of lines) {
    const m = line.match(/^\[(\d{1,2}:\d{2}(?::\d{2})?)\]\s(.+)/)
    if (m) parsed.push({ sec: tsToSec(m[1]), ts: m[1], text: m[2] })
    else if (parsed.length > 0) {
      // 타임스탬프 없는 라인은 이전 구간에 붙임
      parsed[parsed.length - 1].text += ' ' + line.trim()
    }
  }

  if (parsed.length === 0) {
    // 타임스탬프 없는 자막 → 단일 청크
    return [{ start: '00:00', end: '', text: transcript.slice(0, 50000) }]
  }

  const totalSec = parsed[parsed.length - 1].sec
  const numChunks = Math.max(1, Math.ceil(totalSec / chunkSec))
  const chunks: { start: string; end: string; text: string }[] = []

  for (let i = 0; i < numChunks; i++) {
    const startSec = i * chunkSec
    const endSec = (i + 1) * chunkSec
    const lines = parsed.filter(p => p.sec >= startSec && p.sec < endSec)
    if (lines.length === 0) continue
    chunks.push({
      start: lines[0].ts,
      end: lines[lines.length - 1].ts,
      text: lines.map(l => `[${l.ts}] ${l.text}`).join('\n'),
    })
  }

  return chunks.length > 0 ? chunks : [{ start: '00:00', end: '', text: transcript.slice(0, 50000) }]
}

const segmentModel = genAI.getGenerativeModel({
  model: 'gemini-2.5-flash',
  systemInstruction: 'You are a JSON generator. Always respond with valid JSON only. No explanation, no markdown, no code blocks. Start with { and end with }.',
  generationConfig: {
    temperature: 0.2,
    maxOutputTokens: 2048,
    // @ts-expect-error thinkingConfig not yet in types but supported
    thinkingConfig: { thinkingBudget: 0 },
  },
})

/**
 * 단일 구간 요약 생성
 */
export async function generateSegmentSummary(
  chunk: { start: string; end: string; text: string },
  index: number
): Promise<SegmentSummary> {
  const result = await segmentModel.generateContent(`다음은 영상의 ${chunk.start}~${chunk.end} 구간 자막입니다.
이 구간을 분석해서 JSON으로 정리하세요.

[지침]
- headline: 이 구간의 핵심을 담은 제목 (20자 이내, 흥미를 끄는 문구)
- keyPoints: 3~5개. 각 포인트는 "무엇이 다뤄졌고 왜 중요한지"를 완전한 문장 1~2개로. 단어나 구절이 아닌 문장으로 써주세요.

{"headline":"이 구간의 핵심 제목 (20자 이내)","keyPoints":["포인트를 완전한 문장으로 (무엇 + 왜 중요한지)","포인트2","포인트3"]}

자막:
${chunk.text.slice(0, 25000)}`)

  const text = result.response.text().trim()
  const parsed = extractJSON(text) as { headline: string; keyPoints: string[] }
  return {
    index,
    startTimestamp: chunk.start,
    endTimestamp: chunk.end,
    headline: parsed.headline || `${chunk.start} ~ ${chunk.end}`,
    keyPoints: (parsed.keyPoints || []).slice(0, 5),
  }
}

/**
 * 구간별 퀴즈 생성 (2~3문항)
 */
export async function generateSegmentQuiz(
  segment: SegmentSummary,
  chunkText: string
): Promise<SegmentQuizQuestion[]> {
  const result = await segmentModel.generateContent(`다음 구간 내용을 바탕으로 이해도 확인 퀴즈 3문제를 만드세요.
각 문제는 4개의 보기 중 1개가 정답인 객관식입니다.

{"questions":[{"question":"질문","options":["보기1","보기2","보기3","보기4"],"answer":0}]}

구간 요약:
${segment.headline}
${segment.keyPoints.join('\n')}

자막:
${chunkText.slice(0, 10000)}`)

  const text = result.response.text().trim()
  const parsed = extractJSON(text) as { questions: SegmentQuizQuestion[] }
  return (parsed.questions || []).slice(0, 3)
}

export async function classifyFolder(videoTitle: string, tags: string[], existingFolders: string[]): Promise<{ suggestedFolder: string, isNew: boolean }> {
  const result = await classifyModel.generateContent(`You are a smart YouTube library organizer.
The user wants to save a summarized video.
Title: "${videoTitle}"
Tags: [${tags.join(', ')}]

The user already has the following folders:
[${existingFolders.join(', ')}]

Task: Determine the best folder for this video.
If an existing folder perfectly fits or generally encompasses this topic, select it.
If none of the existing folders fit, suggest a concise new folder name (1-2 words).

Respond in JSON ONLY:
{"suggestedFolder": "exact existing folder name OR new folder name", "isNew": true OR false}
`)

  const text = result.response.text().trim()
  try {
    return extractJSON(text) as { suggestedFolder: string, isNew: boolean }
  } catch (e) {
    return { suggestedFolder: existingFolders[0] || '기타', isNew: existingFolders.length === 0 }
  }
}
