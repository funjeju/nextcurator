export type Category = 'recipe' | 'english' | 'learning' | 'news' | 'selfdev' | 'travel' | 'story' | 'tips' | 'voice'

export interface SquareMeta {
  tags: string[]
  topic_cluster: string
  vibe: string
}

export interface RecipeSummary {
  square_meta: SquareMeta
  dish_name: string
  difficulty: '초보' | '중급' | '고급'
  total_time: string
  servings: string
  ingredient_groups?: { group: string; items: { name: string; amount: string }[] }[]
  ingredients?: { name: string; amount: string }[]
  steps: { step: number; desc: string; timestamp: string; tip?: string }[]
  key_tips: string[]
}

export interface EnglishSummary {
  square_meta: SquareMeta
  song_or_title: string
  artist?: string
  expressions: { text: string; meaning: string; note: string; timestamp: string }[]
  vocabulary: { word: string; meaning: string; pronunciation: string }[]
  patterns: string[]
  cultural_context?: string
}

export interface LearningSummary {
  square_meta: SquareMeta
  subject: string
  concepts: { name: string; desc: string; timestamp: string }[]
  key_points: { point: string; timestamp: string }[]
  examples: { desc: string; timestamp: string }[]
}

export interface NewsSummary {
  square_meta: SquareMeta
  headline: string
  three_line_summary: string
  five_w: { who: string; when: string; where: string; what: string; how: string; why: string }
  background: { desc: string; timestamp: string }
  implications: { point: string; timestamp: string }[]
}

export interface SelfDevSummary {
  square_meta: SquareMeta
  core_message: { text: string; timestamp: string }
  insights: { point: string; timestamp: string }[]
  checklist: string[]
  quotes: { text: string; timestamp: string }[]
}

export interface TravelSummary {
  square_meta: SquareMeta
  destination: string
  places: { name: string; desc: string; price?: string; tip?: string; timestamp: string }[]
  route: string
  practical_info: string[]
  warnings: string[]
}

export interface StorySummary {
  square_meta: SquareMeta
  title: string
  genre: string
  characters: { name: string; desc: string }[]
  timeline: { timestamp: string; event: string }[]
  conclusion: string
}

export interface TipsSummary {
  square_meta: SquareMeta
  topic: string
  tips: { number: number; title: string; desc: string; timestamp: string; difficulty?: string }[]
  key_message: string
  tools: string[]
  top3: string[]
}

export interface VoiceSummary {
  square_meta: SquareMeta
  title: string                // AI가 생성한 제목
  main_topic: string           // 핵심 주제 한 문장
  duration_estimate: string    // "약 3분", "약 10분"
  key_points: { point: string; detail?: string }[]
  action_items: string[]
  transcript: string           // 전체 전사 텍스트
  emoji: string                // 대표 이모지 (썸네일용)
  color_theme: 'blue' | 'green' | 'orange' | 'purple' | 'pink' | 'teal' | 'amber'
}

export type SummaryData = RecipeSummary | EnglishSummary | LearningSummary | NewsSummary | SelfDevSummary | TravelSummary | StorySummary | TipsSummary | VoiceSummary

export interface QuizQuestion {
  type: 'flashcard' | 'multiple_choice'
  question: string
  answer: string
  options?: string[]   // multiple_choice only
  hint?: string
}

export interface QuizData {
  category: 'english' | 'learning'
  title: string
  questions: QuizQuestion[]
}

export interface VocabItem {
  word: string
  meaning: string        // 한국어 뜻
  pronunciation: string  // /prəˌnʌnsiˈeɪʃən/
  example: string        // 영어 예문
  exampleKo: string      // 예문 한국어 번역
}

export interface WorksheetQuestion {
  id: number
  question: string
  answer: string
  hint?: string
  options?: string[]   // matching: 보기 선택지
}

export interface WorksheetExercise {
  type: 'matching' | 'fill_blank' | 'translate'
  title: string
  instructions: string
  questions: WorksheetQuestion[]
}

export interface WorksheetData {
  title: string
  level: 'elementary' | 'middle' | 'advanced'
  levelLabel: string
  vocabulary: VocabItem[]
  exercises: WorksheetExercise[]
}

export interface SummarizeResponse {
  sessionId: string
  videoId: string
  title: string
  channel: string
  thumbnail: string
  duration: number
  category: Category
  summary: SummaryData
  transcript?: string
  transcriptSource?: string
  videoPublishedAt?: string   // YouTube 업로드 날짜 (ISO 8601)
  summarizedAt?: string       // 요약 생성 일시 (ISO 8601)
  reportSummary?: string      // 보고서형 서술 요약 (PDF용)
}
