'use client'

import { Category, SummaryData, RecipeSummary as RecipeSummaryType, EnglishSummary as EnglishSummaryType, LearningSummary as LearningSummaryType, NewsSummary as NewsSummaryType, SelfDevSummary as SelfDevSummaryType, TravelSummary as TravelSummaryType, StorySummary as StorySummaryType } from '@/types/summary'
import RecipeSummary from './RecipeSummary'
import EnglishSummary from './EnglishSummary'
import LearningSummary from './LearningSummary'
import NewsSummary from './NewsSummary'
import SelfDevSummary from './SelfDevSummary'
import TravelSummary from './TravelSummary'
import StorySummary from './StorySummary'

interface Props {
  category: Category
  summary: SummaryData
  onSeek: (ts: string) => void
  onComment?: (segmentId: string, segmentLabel: string) => void
  commentCounts?: Record<string, number>
}

export default function SummaryShell({ category, summary, onSeek, onComment, commentCounts }: Props) {
  const commentProps = { onComment, commentCounts }
  switch (category) {
    case 'recipe':
      return <RecipeSummary data={summary as RecipeSummaryType} onSeek={onSeek} {...commentProps} />
    case 'english':
      return <EnglishSummary data={summary as EnglishSummaryType} onSeek={onSeek} {...commentProps} />
    case 'learning':
      return <LearningSummary data={summary as LearningSummaryType} onSeek={onSeek} {...commentProps} />
    case 'news':
      return <NewsSummary data={summary as NewsSummaryType} onSeek={onSeek} {...commentProps} />
    case 'selfdev':
      return <SelfDevSummary data={summary as SelfDevSummaryType} onSeek={onSeek} {...commentProps} />
    case 'travel':
      return <TravelSummary data={summary as TravelSummaryType} onSeek={onSeek} {...commentProps} />
    case 'story':
      return <StorySummary data={summary as StorySummaryType} onSeek={onSeek} {...commentProps} />
  }
}
