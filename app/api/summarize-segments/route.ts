import { NextRequest, NextResponse } from 'next/server'
import {
  splitTranscriptIntoChunks,
  generateSegmentSummary,
  generateSegmentQuiz,
  SegmentSummary,
  SegmentQuizQuestion,
} from '@/lib/claude'

export const maxDuration = 120

export interface SegmentResult extends SegmentSummary {
  chunkText?: string  // 퀴즈 생성용 미리 잘라둔 텍스트 (8000자)
  quiz?: SegmentQuizQuestion[]
}

export async function POST(req: NextRequest) {
  try {
    const { transcript } = await req.json()

    if (!transcript || typeof transcript !== 'string') {
      return NextResponse.json({ error: 'transcript required' }, { status: 400 })
    }

    if (transcript.length < 500) {
      return NextResponse.json({ error: 'transcript too short' }, { status: 400 })
    }

    // 10분 단위로 자막 분할
    const chunks = splitTranscriptIntoChunks(transcript, 10)

    if (chunks.length <= 1) {
      return NextResponse.json({ error: 'too_short_for_segments' }, { status: 422 })
    }

    // 모든 구간 요약 병렬 생성
    const summaries = await Promise.all(
      chunks.map((chunk, i) => generateSegmentSummary(chunk, i))
    )

    // 각 구간 요약에 chunkText 첨부 (퀴즈 생성 시 재사용)
    const results: SegmentResult[] = summaries.map((seg, i) => ({
      ...seg,
      chunkText: chunks[i].text.slice(0, 8000),
    }))

    return NextResponse.json({ segments: results, chunkCount: chunks.length })
  } catch (error) {
    console.error('[summarize-segments] error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '구간 요약 생성 실패' },
      { status: 500 }
    )
  }
}
