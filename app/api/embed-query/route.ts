import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY!)
const embeddingModel = genAI.getGenerativeModel({ model: 'text-embedding-004' })

export async function POST(req: NextRequest) {
  try {
    const { query } = await req.json()
    if (!query?.trim()) {
      return NextResponse.json({ error: 'query required' }, { status: 400 })
    }

    const result = await embeddingModel.embedContent(query.trim())
    const embedding = result.embedding.values  // number[] (768 dims)

    return NextResponse.json({ embedding })
  } catch (e) {
    console.error('[embed-query] error:', e)
    return NextResponse.json({ error: '임베딩 생성 실패' }, { status: 500 })
  }
}
