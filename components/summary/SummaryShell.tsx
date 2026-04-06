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
}

export default function SummaryShell({ category, summary, onSeek }: Props) {
  switch (category) {
    case 'recipe':
      return <RecipeSummary data={summary as RecipeSummaryType} onSeek={onSeek} />
    case 'english':
      return <EnglishSummary data={summary as EnglishSummaryType} onSeek={onSeek} />
    case 'learning':
      return <LearningSummary data={summary as LearningSummaryType} onSeek={onSeek} />
    case 'news':
      return <NewsSummary data={summary as NewsSummaryType} onSeek={onSeek} />
    case 'selfdev':
      return <SelfDevSummary data={summary as SelfDevSummaryType} onSeek={onSeek} />
    case 'travel':
      return <TravelSummary data={summary as TravelSummaryType} onSeek={onSeek} />
    case 'story':
      return <StorySummary data={summary as StorySummaryType} onSeek={onSeek} />
  }
}
