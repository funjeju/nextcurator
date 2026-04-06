export type Category = 'recipe' | 'english' | 'learning' | 'news' | 'selfdev' | 'travel' | 'story'

export interface RecipeSummary {
  dish_name: string
  difficulty: '초보' | '중급' | '고급'
  total_time: string
  servings: string
  ingredients: { name: string; amount: string }[]
  steps: { step: number; desc: string; timestamp: string; tip?: string }[]
  key_tips: string[]
}

export interface EnglishSummary {
  song_or_title: string
  artist?: string
  expressions: { text: string; meaning: string; note: string; timestamp: string }[]
  vocabulary: { word: string; meaning: string; pronunciation: string }[]
  patterns: string[]
  cultural_context?: string
}

export interface LearningSummary {
  subject: string
  concepts: { name: string; desc: string; timestamp: string }[]
  key_points: { point: string; timestamp: string }[]
  examples: { desc: string; timestamp: string }[]
}

export interface NewsSummary {
  headline: string
  three_line_summary: string
  five_w: { who: string; when: string; where: string; what: string; how: string; why: string }
  background: { desc: string; timestamp: string }
  implications: { point: string; timestamp: string }[]
}

export interface SelfDevSummary {
  core_message: { text: string; timestamp: string }
  insights: { point: string; timestamp: string }[]
  checklist: string[]
  quotes: { text: string; timestamp: string }[]
}

export interface TravelSummary {
  destination: string
  places: { name: string; desc: string; price?: string; tip?: string; timestamp: string }[]
  route: string
  practical_info: string[]
  warnings: string[]
}

export interface StorySummary {
  title: string
  genre: string
  characters: { name: string; desc: string }[]
  timeline: { timestamp: string; event: string }[]
  conclusion: string
}

export type SummaryData = RecipeSummary | EnglishSummary | LearningSummary | NewsSummary | SelfDevSummary | TravelSummary | StorySummary

export interface SummarizeResponse {
  sessionId: string
  videoId: string
  title: string
  channel: string
  thumbnail: string
  duration: number
  category: Category
  summary: SummaryData
}
