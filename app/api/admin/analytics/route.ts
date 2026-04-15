import { NextRequest, NextResponse } from 'next/server'
import { FIRESTORE_BASE } from '@/lib/firestore-rest'
import { checkIsAdminByToken } from '@/lib/admin'

const API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY!

// ISO 날짜 문자열에서 YYYY-MM-DD 추출
function toDateStr(iso: string): string {
  return iso ? iso.slice(0, 10) : ''
}

// 최근 N일 날짜 배열 생성 (오늘 포함)
function getLast30Days(): string[] {
  const days: string[] = []
  for (let i = 29; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    days.push(d.toISOString().slice(0, 10))
  }
  return days
}

// Firestore REST: 컬렉션 전체 문서 조회 (필드 제한해서 빠르게)
async function fetchCollection(
  collectionId: string,
  idToken: string,
  sinceISO: string,
  dateField: string,
  selectFields: string[]
): Promise<any[]> {
  const url = `${FIRESTORE_BASE}:runQuery?key=${API_KEY}`
  const body = {
    structuredQuery: {
      from: [{ collectionId }],
      where: {
        fieldFilter: {
          field: { fieldPath: dateField },
          op: 'GREATER_THAN_OR_EQUAL',
          value: { stringValue: sinceISO },
        },
      },
      select: {
        fields: selectFields.map(f => ({ fieldPath: f })),
      },
      limit: 2000,
    },
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`,
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  })
  if (!res.ok) return []
  const results = await res.json()
  if (!Array.isArray(results)) return []
  return results
    .filter((r: any) => r.document?.fields)
    .map((r: any) => {
      const f = r.document.fields
      const out: Record<string, any> = {}
      for (const field of selectFields) {
        const v = f[field]
        if (!v) continue
        if (v.stringValue !== undefined) out[field] = v.stringValue
        else if (v.integerValue !== undefined) out[field] = Number(v.integerValue)
        else if (v.doubleValue !== undefined) out[field] = Number(v.doubleValue)
        else if (v.booleanValue !== undefined) out[field] = v.booleanValue
        else if (v.timestampValue !== undefined) out[field] = v.timestampValue
      }
      return out
    })
}

// 날짜별 카운트 집계
function countByDay(items: any[], dateField: string, days: string[]): { date: string; count: number }[] {
  const map: Record<string, number> = {}
  for (const d of days) map[d] = 0
  for (const item of items) {
    const d = toDateStr(item[dateField] || '')
    if (d in map) map[d]++
  }
  return days.map(d => ({ date: d, count: map[d] }))
}

// 누적 합계 변환
function toCumulative(data: { date: string; count: number }[]): { date: string; count: number; cumulative: number }[] {
  let sum = 0
  return data.map(d => {
    sum += d.count
    return { ...d, cumulative: sum }
  })
}

export async function POST(req: NextRequest) {
  try {
    const idToken = req.headers.get('Authorization')?.replace('Bearer ', '') ?? ''
    const isAdmin = await checkIsAdminByToken(idToken)
    if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const days = getLast30Days()
    const since = days[0] + 'T00:00:00.000Z'

    // 병렬 조회
    const [recentUsers, recentVideos, recentSaved] = await Promise.all([
      fetchCollection('users', idToken, since, 'updatedAt', ['updatedAt', 'role', 'plan', 'classCode']),
      fetchCollection('summaries', idToken, since, 'summarizedAt', ['summarizedAt']),
      fetchCollection('saved_summaries', idToken, since, 'createdAt', ['createdAt', 'userId']),
    ])

    // 일별 가입자 (updatedAt 기준 — 신규 생성 시 설정됨)
    const dailySignups = toCumulative(countByDay(recentUsers, 'updatedAt', days))

    // 일별 영상 분석
    const dailyVideos = countByDay(recentVideos, 'summarizedAt', days)

    // 일별 저장 수
    const dailySaved = countByDay(recentSaved, 'createdAt', days)

    // 전체 통계 (별도 집계)
    const [totalUsersRes, totalVideosRes, totalSavedRes] = await Promise.all([
      fetch(`${FIRESTORE_BASE}:runAggregationQuery?key=${API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ structuredAggregationQuery: { structuredQuery: { from: [{ collectionId: 'users' }] }, aggregations: [{ alias: 'count', count: {} }] } }),
        cache: 'no-store',
      }),
      fetch(`${FIRESTORE_BASE}:runAggregationQuery?key=${API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ structuredAggregationQuery: { structuredQuery: { from: [{ collectionId: 'summaries' }] }, aggregations: [{ alias: 'count', count: {} }] } }),
        cache: 'no-store',
      }),
      fetch(`${FIRESTORE_BASE}:runAggregationQuery?key=${API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
        body: JSON.stringify({ structuredAggregationQuery: { structuredQuery: { from: [{ collectionId: 'saved_summaries' }] }, aggregations: [{ alias: 'count', count: {} }] } }),
        cache: 'no-store',
      }),
    ])

    const [tu, tv, ts] = await Promise.all([totalUsersRes.json(), totalVideosRes.json(), totalSavedRes.json()])
    const totalUsers = Number(tu?.[0]?.result?.aggregateFields?.count?.integerValue ?? 0)
    const totalVideos = Number(tv?.[0]?.result?.aggregateFields?.count?.integerValue ?? 0)
    const totalSaved = Number(ts?.[0]?.result?.aggregateFields?.count?.integerValue ?? 0)

    // 역할별 분포 (최근 30일 가입자 기준)
    const roleBreakdown = {
      teacher: recentUsers.filter(u => u.role === 'teacher').length,
      student: recentUsers.filter(u => u.role === 'student').length,
      general: recentUsers.filter(u => !u.role).length,
    }

    // 주요 KPI
    const last7Days = days.slice(-7)
    const last7Videos = recentVideos.filter(v => toDateStr(v.summarizedAt) >= last7Days[0]).length
    const last7Signups = recentUsers.filter(u => toDateStr(u.updatedAt) >= last7Days[0]).length
    const saveRate = totalVideos > 0 ? Math.round((totalSaved / totalVideos) * 100) : 0
    const avgVideosPerUser = totalUsers > 0 ? +(totalVideos / totalUsers).toFixed(1) : 0

    // 30일 신규 가입자 수 (일별 합계)
    const newUsersLast30 = recentUsers.length
    const newVideosLast30 = recentVideos.length

    return NextResponse.json({
      dailySignups,
      dailyVideos,
      dailySaved,
      kpi: {
        totalUsers,
        totalVideos,
        totalSaved,
        saveRate,
        avgVideosPerUser,
        newUsersLast30,
        newVideosLast30,
        last7Signups,
        last7Videos,
      },
      roleBreakdown,
    })
  } catch (error: any) {
    console.error('[Admin Analytics] Error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
