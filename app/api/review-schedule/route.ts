import { NextRequest, NextResponse } from 'next/server'

/**
 * 에빙하우스 망각곡선 기반 복습 스케줄 API
 *
 * POST /api/review-schedule        — 오답 발생 시 복습 항목 생성/갱신
 * GET  /api/review-schedule?uid=   — 오늘 복습해야 할 항목 목록 반환
 */

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!
const API_KEY    = process.env.NEXT_PUBLIC_FIREBASE_API_KEY!
const BASE       = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`

// SM-2 복습 간격 (일 단위): 틀릴수록 리셋
const INTERVALS = [1, 3, 7, 14, 30, 60]

function addDays(date: Date, days: number): string {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10) // YYYY-MM-DD
}

function toFV(v: unknown): unknown {
  if (v === null || v === undefined) return { nullValue: null }
  if (typeof v === 'string')  return { stringValue: v }
  if (typeof v === 'number')  return { integerValue: String(v) }
  if (typeof v === 'boolean') return { booleanValue: v }
  if (Array.isArray(v))       return { arrayValue: { values: v.map(toFV) } }
  if (typeof v === 'object') {
    const fields: Record<string, unknown> = {}
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) fields[k] = toFV(val)
    return { mapValue: { fields } }
  }
  return { stringValue: String(v) }
}

function fromFV(fv: any): any {
  if (!fv) return null
  if ('stringValue'  in fv) return fv.stringValue
  if ('integerValue' in fv) return Number(fv.integerValue)
  if ('doubleValue'  in fv) return fv.doubleValue
  if ('booleanValue' in fv) return fv.booleanValue
  if ('nullValue'    in fv) return null
  if ('arrayValue'   in fv) return (fv.arrayValue.values || []).map(fromFV)
  if ('mapValue'     in fv) {
    const obj: Record<string, any> = {}
    for (const [k, v] of Object.entries(fv.mapValue.fields || {})) obj[k] = fromFV(v)
    return obj
  }
  return null
}

function docToObj(doc: any): Record<string, any> {
  const obj: Record<string, any> = { id: doc.name?.split('/').pop() }
  for (const [k, v] of Object.entries(doc.fields || {})) obj[k] = fromFV(v)
  return obj
}

// ── POST: 오답 항목 upsert ──────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { studentId, classCode, sessionId, videoId, videoTitle, questionIdx, question } = body

    if (!studentId || !sessionId || questionIdx == null) {
      return NextResponse.json({ error: '필수 파라미터 누락' }, { status: 400 })
    }

    // 기존 항목 조회 (같은 student + session + questionIdx)
    const searchUrl = `${BASE}:runQuery?key=${API_KEY}`
    const searchBody = {
      structuredQuery: {
        from: [{ collectionId: 'review_schedule' }],
        where: {
          compositeFilter: {
            op: 'AND',
            filters: [
              { fieldFilter: { field: { fieldPath: 'studentId' }, op: 'EQUAL', value: { stringValue: studentId } } },
              { fieldFilter: { field: { fieldPath: 'sessionId' },  op: 'EQUAL', value: { stringValue: sessionId } } },
              { fieldFilter: { field: { fieldPath: 'questionIdx' }, op: 'EQUAL', value: { integerValue: String(questionIdx) } } },
            ],
          },
        },
        limit: 1,
      },
    }
    const searchRes = await fetch(searchUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(searchBody) })
    const searchData = await searchRes.json()

    const existing = searchData[0]?.document
    const today = new Date()

    let docId: string
    let nextRepetition: number
    let nextInterval: number

    if (existing) {
      // 이미 있는 항목 → 오답 반복: repetition 리셋 or 유지
      const cur = docToObj(existing)
      const rep = typeof cur.repetition === 'number' ? cur.repetition : 0
      nextRepetition = Math.max(0, rep - 1) // 틀리면 한 단계 후퇴
      nextInterval   = INTERVALS[nextRepetition] ?? 1
      docId = cur.id
    } else {
      nextRepetition = 0
      nextInterval   = INTERVALS[0]
      docId = `${studentId}_${sessionId}_${questionIdx}`
    }

    const docData = {
      studentId,
      classCode: classCode || '',
      sessionId,
      videoId: videoId || '',
      videoTitle: videoTitle || '',
      questionIdx,
      question: question || '',
      repetition: nextRepetition,
      nextReviewDate: addDays(today, nextInterval),
      lastAttemptedAt: today.toISOString(),
      status: 'pending',
    }

    await fetch(`${BASE}/review_schedule/${docId}?key=${API_KEY}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: Object.fromEntries(Object.entries(docData).map(([k, v]) => [k, toFV(v)])) }),
    })

    return NextResponse.json({ success: true, nextReviewDate: docData.nextReviewDate })
  } catch (e) {
    console.error('[review-schedule POST]', e)
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}

// ── GET: 오늘 복습 목록 ─────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const studentId = searchParams.get('uid')
    if (!studentId) return NextResponse.json({ items: [] })

    const today = new Date().toISOString().slice(0, 10)

    const searchUrl = `${BASE}:runQuery?key=${API_KEY}`
    const searchBody = {
      structuredQuery: {
        from: [{ collectionId: 'review_schedule' }],
        where: {
          compositeFilter: {
            op: 'AND',
            filters: [
              { fieldFilter: { field: { fieldPath: 'studentId' }, op: 'EQUAL',              value: { stringValue: studentId } } },
              { fieldFilter: { field: { fieldPath: 'status' },    op: 'EQUAL',              value: { stringValue: 'pending' } } },
              { fieldFilter: { field: { fieldPath: 'nextReviewDate' }, op: 'LESS_THAN_OR_EQUAL', value: { stringValue: today } } },
            ],
          },
        },
        limit: 50,
      },
    }

    const res  = await fetch(searchUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(searchBody) })
    const data = await res.json()

    const items = (data as any[])
      .filter((r: any) => r.document)
      .map((r: any) => docToObj(r.document))

    return NextResponse.json({ items })
  } catch (e) {
    console.error('[review-schedule GET]', e)
    return NextResponse.json({ items: [] })
  }
}

// ── PATCH: 복습 완료 처리 ───────────────────────────────────────────────────────
export async function PATCH(req: NextRequest) {
  try {
    const { docId, correct, studentId, sessionId, questionIdx } = await req.json()

    // docId가 없으면 studentId+sessionId+questionIdx로 구성
    const id = docId || `${studentId}_${sessionId}_${questionIdx}`

    // 현재 항목 조회
    const getRes  = await fetch(`${BASE}/review_schedule/${id}?key=${API_KEY}`)
    const getData = await getRes.json()
    if (!getData.fields) return NextResponse.json({ error: '항목 없음' }, { status: 404 })

    const cur = docToObj(getData)
    const today = new Date()

    let nextRepetition: number
    let nextInterval: number
    let status: string

    if (correct) {
      nextRepetition = Math.min((cur.repetition ?? 0) + 1, INTERVALS.length - 1)
      nextInterval   = INTERVALS[nextRepetition]
      status = nextRepetition >= INTERVALS.length - 1 ? 'mastered' : 'pending'
    } else {
      nextRepetition = Math.max(0, (cur.repetition ?? 0) - 1)
      nextInterval   = INTERVALS[nextRepetition]
      status = 'pending'
    }

    const update = {
      repetition:     nextRepetition,
      nextReviewDate: addDays(today, nextInterval),
      lastAttemptedAt: today.toISOString(),
      status,
    }

    await fetch(`${BASE}/review_schedule/${id}?key=${API_KEY}&updateMask.fieldPaths=repetition&updateMask.fieldPaths=nextReviewDate&updateMask.fieldPaths=lastAttemptedAt&updateMask.fieldPaths=status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: Object.fromEntries(Object.entries(update).map(([k, v]) => [k, toFV(v)])) }),
    })

    return NextResponse.json({ success: true, status, nextReviewDate: update.nextReviewDate })
  } catch (e) {
    console.error('[review-schedule PATCH]', e)
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}
