import { NextRequest, NextResponse } from 'next/server'
import { FIRESTORE_BASE } from '@/lib/firestore-rest'
import { generateClassCode } from '@/lib/classroom'

const API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY!
const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!

async function codeExists(code: string): Promise<boolean> {
  const url = `${FIRESTORE_BASE}/classes/${code}?key=${API_KEY}`
  const res = await fetch(url)
  return res.ok
}

async function getUniqueCode(): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const code = generateClassCode()
    if (!(await codeExists(code))) return code
  }
  throw new Error('코드 생성 실패')
}

export async function POST(req: NextRequest) {
  try {
    const { uid, teacherName, schoolName, grade, classNum } = await req.json()
    if (!uid || !schoolName || !grade || !classNum) {
      return NextResponse.json({ error: '필수 항목이 누락되었습니다.' }, { status: 400 })
    }

    const classCode = await getUniqueCode()
    const now = new Date().toISOString()

    // Firestore에 classes 문서 생성
    const url = `${FIRESTORE_BASE}/classes/${classCode}?key=${API_KEY}`
    const body = {
      fields: {
        classCode: { stringValue: classCode },
        teacherId: { stringValue: uid },
        teacherName: { stringValue: teacherName || '' },
        schoolName: { stringValue: schoolName },
        grade: { integerValue: String(grade) },
        classNum: { integerValue: String(classNum) },
        masterFolderId: { nullValue: null },
        createdAt: { timestampValue: now },
      }
    }

    const res = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const err = await res.text()
      return NextResponse.json({ error: err }, { status: 500 })
    }

    // 교사 user 문서에 role + classCode + profileCompleted 저장
    const userUrl = `${FIRESTORE_BASE}/users/${uid}?updateMask.fieldPaths=role&updateMask.fieldPaths=classCode&updateMask.fieldPaths=schoolName&updateMask.fieldPaths=grade&updateMask.fieldPaths=classNum&updateMask.fieldPaths=profileCompleted&key=${API_KEY}`
    await fetch(userUrl, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: {
          role: { stringValue: 'teacher' },
          classCode: { stringValue: classCode },
          schoolName: { stringValue: schoolName },
          grade: { integerValue: String(grade) },
          classNum: { integerValue: String(classNum) },
          profileCompleted: { booleanValue: true },
        }
      }),
    })

    return NextResponse.json({ classCode })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
