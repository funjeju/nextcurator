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

const VALID_CATEGORIES: Category[] = ['recipe', 'english', 'learning', 'news', 'selfdev', 'travel', 'story', 'tips', 'report']

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

  english: `다음 영어학습 영상 자막을 분석해서 학습카드 JSON을 만드세요.

{"square_meta":{"tags":["키워드1","키워드2","키워드3","키워드4","키워드5"],"topic_cluster":"대주제","vibe":"분위기"},"song_or_title":"제목","artist":"아티스트","expressions":[{"text":"표현","meaning":"의미","note":"설명","timestamp":"MM:SS"}],"vocabulary":[{"word":"단어","meaning":"뜻","pronunciation":"발음"}],"patterns":["패턴"],"cultural_context":"맥락"}`,

  learning: `다음 학습 영상 자막을 분석해서 학습정리 JSON을 만드세요.

{"square_meta":{"tags":["키워드1","키워드2","키워드3","키워드4","키워드5"],"topic_cluster":"대주제","vibe":"분위기"},"subject":"주제","concepts":[{"name":"개념","desc":"설명","timestamp":"MM:SS"}],"key_points":[{"point":"포인트","timestamp":"MM:SS"}],"examples":[{"desc":"예시","timestamp":"MM:SS"}]}`,

  news: `다음 뉴스 영상 자막을 분석해서 브리핑 JSON을 만드세요.

{"square_meta":{"tags":["키워드1","키워드2","키워드3","키워드4","키워드5"],"topic_cluster":"대주제","vibe":"분위기"},"headline":"제목","three_line_summary":"요약","five_w":{"who":"누가","when":"언제","where":"어디서","what":"무엇","how":"어떻게","why":"왜"},"background":{"desc":"배경","timestamp":"MM:SS"},"implications":[{"point":"시사점","timestamp":"MM:SS"}]}`,

  selfdev: `다음 자기계발 영상 자막을 분석해서 인사이트 JSON을 만드세요.

{"square_meta":{"tags":["키워드1","키워드2","키워드3","키워드4","키워드5"],"topic_cluster":"대주제","vibe":"분위기"},"core_message":{"text":"메시지","timestamp":"MM:SS"},"insights":[{"point":"인사이트","timestamp":"MM:SS"}],"checklist":["항목"],"quotes":[{"text":"인용","timestamp":"MM:SS"}]}`,

  travel: `다음 여행 영상 자막을 분석해서 가이드 JSON을 만드세요.

{"square_meta":{"tags":["키워드1","키워드2","키워드3","키워드4","키워드5"],"topic_cluster":"대주제","vibe":"분위기"},"destination":"여행지","places":[{"name":"장소","desc":"설명","price":"가격","tip":"팁","timestamp":"MM:SS"}],"route":"동선","practical_info":["정보"],"warnings":["주의"]}`,

  story: `다음 스토리/드라마/가십 영상 자막을 분석해서 스토리 전개를 알 수 있는 타임라인 중심 JSON을 만드세요.

{"square_meta":{"tags":["키워드1","키워드2","키워드3","키워드4","키워드5"],"topic_cluster":"대주제","vibe":"분위기"},"title":"스토리/드라마 제목 또는 주제","genre":"장르(코미디/드라마/미스터리/썰 등)","characters":[{"name":"등장인물(가명/호칭 등)","desc":"특징이나 역할"}],"timeline":[{"timestamp":"MM:SS","event":"이 시간대에 벌어진 주요 사건"}],"conclusion":"결말 또는 요약"}`,

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

  const result = await summaryModel.generateContent(`${prompt}${sourceNote}${langNote}

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
