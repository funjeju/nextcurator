import { NextRequest, NextResponse } from 'next/server'
import { FIRESTORE_BASE } from '@/lib/firestore-rest'
import { checkIsAdmin } from '@/lib/admin'

const API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY!

async function getCount(collectionId: string): Promise<number> {
  const url = `${FIRESTORE_BASE}:runAggregationQuery?key=${API_KEY}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      structuredAggregationQuery: {
        structuredQuery: { from: [{ collectionId }] },
        aggregations: [{ alias: 'count', count: {} }],
      },
    }),
    cache: 'no-store',
  })
  if (!res.ok) return 0
  const data = await res.json()
  return Number(data?.[0]?.result?.aggregateFields?.count?.integerValue ?? 0)
}

async function getTodayCount(): Promise<number> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayISO = today.toISOString()

  const url = `${FIRESTORE_BASE}:runAggregationQuery?key=${API_KEY}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      structuredAggregationQuery: {
        structuredQuery: {
          from: [{ collectionId: 'summaries' }],
          where: {
            fieldFilter: {
              field: { fieldPath: 'summarizedAt' },
              op: 'GREATER_THAN_OR_EQUAL',
              value: { timestampValue: todayISO },
            },
          },
        },
        aggregations: [{ alias: 'count', count: {} }],
      },
    }),
    cache: 'no-store',
  })
  if (!res.ok) return 0
  const data = await res.json()
  return Number(data?.[0]?.result?.aggregateFields?.count?.integerValue ?? 0)
}

export async function POST(req: NextRequest) {
  try {
    const { uid, email } = await req.json()
    const isAdmin = await checkIsAdmin(uid, email)
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const [totalSummaries, totalSaved, totalUsers, todaySummaries] = await Promise.all([
      getCount('summaries'),
      getCount('saved_summaries'),
      getCount('users'),
      getTodayCount(),
    ])

    return NextResponse.json({ totalSummaries, totalSaved, totalUsers, todaySummaries })
  } catch (error: any) {
    console.error('[Admin Stats] Error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
