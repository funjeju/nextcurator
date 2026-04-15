import { NextRequest, NextResponse } from 'next/server'
import { generateSegmentQuiz, SegmentSummary } from '@/lib/claude'

export const maxDuration = 30

export async function POST(req: NextRequest) {
  try {
    const { segment, chunkText } = await req.json() as {
      segment: SegmentSummary
      chunkText: string
    }

    if (!segment || !chunkText) {
      return NextResponse.json({ error: 'segment and chunkText required' }, { status: 400 })
    }

    const quiz = await generateSegmentQuiz(segment, chunkText)
    return NextResponse.json({ quiz })
  } catch (error) {
    console.error('[segment-quiz] error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '퀴즈 생성 실패' },
      { status: 500 }
    )
  }
}
