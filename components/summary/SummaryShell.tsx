'use client'

import { Category, SummaryData, RecipeSummary as RecipeSummaryType, EnglishSummary as EnglishSummaryType, LearningSummary as LearningSummaryType, NewsSummary as NewsSummaryType, SelfDevSummary as SelfDevSummaryType, TravelSummary as TravelSummaryType, StorySummary as StorySummaryType, TipsSummary as TipsSummaryType } from '@/types/summary'
import RecipeSummary from './RecipeSummary'
import EnglishSummary from './EnglishSummary'
import LearningSummary from './LearningSummary'
import NewsSummary from './NewsSummary'
import SelfDevSummary from './SelfDevSummary'
import TravelSummary from './TravelSummary'
import StorySummary from './StorySummary'
import TipsSummary from './TipsSummary'

interface Props {
  category: Category
  summary: SummaryData
  onSeek: (ts: string) => void
  sessionId?: string
  commentCounts?: Record<string, number>
  // kept for CommentSection scroll behavior (action bar comment icon)
  onComment?: (segmentId: string, segmentLabel: string) => void
}

export default function SummaryShell({ category, summary, onSeek, sessionId, commentCounts, onComment }: Props) {
  const sharedProps = { sessionId, commentCounts, onComment }
  switch (category) {
    case 'recipe':
      return <RecipeSummary data={summary as RecipeSummaryType} onSeek={onSeek} {...sharedProps} />
    case 'english':
      return <EnglishSummary data={summary as EnglishSummaryType} onSeek={onSeek} {...sharedProps} />
    case 'learning':
      return <LearningSummary data={summary as LearningSummaryType} onSeek={onSeek} {...sharedProps} />
    case 'news':
      return <NewsSummary data={summary as NewsSummaryType} onSeek={onSeek} {...sharedProps} />
    case 'selfdev':
      return <SelfDevSummary data={summary as SelfDevSummaryType} onSeek={onSeek} {...sharedProps} />
    case 'travel':
      return <TravelSummary data={summary as TravelSummaryType} onSeek={onSeek} {...sharedProps} />
    case 'story':
      return <StorySummary data={summary as StorySummaryType} onSeek={onSeek} {...sharedProps} />
    case 'tips':
      return <TipsSummary data={summary as TipsSummaryType} onSeek={onSeek} {...sharedProps} />
  }
}
