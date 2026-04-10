import { NextRequest, NextResponse } from 'next/server'
import { generateQuiz } from '@/lib/claude'

export async function POST(req: NextRequest) {
  try {
    const { category, summary, title } = await req.json()
    if (!category || !summary) return NextResponse.json({ error: 'category, summary 필요' }, { status: 400 })
    if (category !== 'english' && category !== 'learning') {
      return NextResponse.json({ error: '영어/학습 카테고리만 지원합니다' }, { status: 400 })
    }
    const quiz = await generateQuiz(category, summary, title || '')
    return NextResponse.json(quiz)
  } catch (e) {
    console.error('Quiz generation error:', e)
    return NextResponse.json({ error: '퀴즈 생성에 실패했습니다.' }, { status: 500 })
  }
}
