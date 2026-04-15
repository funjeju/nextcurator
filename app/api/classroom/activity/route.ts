import { NextRequest, NextResponse } from 'next/server'
import { FIRESTORE_BASE } from '@/lib/firestore-rest'

const API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY!

export async function POST(req: NextRequest) {
  try {
    const { studentId, studentName, classCode, type, videoId, sessionId, videoTitle, value } = await req.json()
    if (!studentId || !classCode || !type) {
      return NextResponse.json({ error: 'studentId, classCode, type required' }, { status: 400 })
    }

    const url = `${FIRESTORE_BASE}/activity_logs?key=${API_KEY}`

    const toFSValue = (v: unknown): any => {
      if (v === null || v === undefined) return { nullValue: null }
      if (typeof v === 'string') return { stringValue: v }
      if (typeof v === 'number') return { integerValue: String(v) }
      if (typeof v === 'boolean') return { booleanValue: v }
      if (typeof v === 'object') {
        return { mapValue: { fields: Object.fromEntries(Object.entries(v as object).map(([k, val]) => [k, toFSValue(val)])) } }
      }
      return { stringValue: String(v) }
    }

    const body = {
      fields: {
        studentId: { stringValue: studentId },
        studentName: { stringValue: studentName || '' },
        classCode: { stringValue: classCode },
        type: { stringValue: type },
        videoId: videoId ? { stringValue: videoId } : { nullValue: null },
        sessionId: sessionId ? { stringValue: sessionId } : { nullValue: null },
        videoTitle: videoTitle ? { stringValue: videoTitle } : { nullValue: null },
        value: { mapValue: { fields: Object.fromEntries(Object.entries(value || {}).map(([k, v]) => [k, toFSValue(v)])) } },
        timestamp: { timestampValue: new Date().toISOString() },
      }
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!res.ok) return NextResponse.json({ error: await res.text() }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
