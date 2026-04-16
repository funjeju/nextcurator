'use client'

import { Category, SummaryData, RecipeSummary as RecipeSummaryType, EnglishSummary as EnglishSummaryType, LearningSummary as LearningSummaryType, NewsSummary as NewsSummaryType, SelfDevSummary as SelfDevSummaryType, TravelSummary as TravelSummaryType, StorySummary as StorySummaryType, TipsSummary as TipsSummaryType, VoiceSummary as VoiceSummaryType, ReportSummary as ReportSummaryType } from '@/types/summary'
import RecipeSummary from './RecipeSummary'
import EnglishSummary from './EnglishSummary'
import LearningSummary from './LearningSummary'
import NewsSummary from './NewsSummary'
import SelfDevSummary from './SelfDevSummary'
import TravelSummary from './TravelSummary'
import StorySummary from './StorySummary'
import TipsSummary from './TipsSummary'
import VoiceSummary from './VoiceSummary'
import ReportSummary from './ReportSummary'

/** 텍스트에 한글 비율이 낮으면 외국어로 판단 */
function isLikelyForeign(summary: SummaryData): boolean {
  const text = JSON.stringify(summary)
  const hangul = (text.match(/[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]/g) || []).length
  const latin  = (text.match(/[a-zA-Z]/g) || []).length
  // 영문자 수가 한글 수의 2배 이상이면 외국어 요약으로 판단
  return latin > hangul * 2 && latin > 50
}

interface Props {
  category: Category
  summary: SummaryData
  onSeek: (ts: string) => void
  sessionId?: string
  commentCounts?: Record<string, number>
  onComment?: (segmentId: string, segmentLabel: string) => void
  transcriptSource?: string  // 'pdf' | 'web' | 'youtube' | ...
  videoId?: string
  thumbnail?: string
}

export default function SummaryShell({ category, summary, onSeek, sessionId, commentCounts, onComment, transcriptSource, videoId, thumbnail }: Props) {
  const hideTimestamp = transcriptSource === 'pdf' || transcriptSource === 'web'
  const showTranslate = isLikelyForeign(summary)
  const sharedProps = { sessionId, commentCounts, onComment, hideTimestamp, showTranslate }
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
      return <TravelSummary data={summary as TravelSummaryType} onSeek={onSeek} {...sharedProps} videoId={videoId} thumbnail={thumbnail} />
    case 'story':
      return <StorySummary data={summary as StorySummaryType} onSeek={onSeek} {...sharedProps} />
    case 'tips':
      return <TipsSummary data={summary as TipsSummaryType} onSeek={onSeek} {...sharedProps} />
    case 'voice':
      return <VoiceSummary data={summary as VoiceSummaryType} />
    case 'report':
      return <ReportSummary data={summary as ReportSummaryType} onSeek={onSeek} {...sharedProps} />
  }
}
