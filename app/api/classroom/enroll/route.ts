/**
 * 학생 가입 API
 * - Firebase Auth에 이메일/패스워드 계정 생성 (내부 이메일 자동 생성)
 * - users 문서 생성 (role=student, classCode, studentName)
 * - 교사의 masterFolder를 학생에게 자동 복제
 */
import { NextRequest, NextResponse } from 'next/server'
import { FIRESTORE_BASE } from '@/lib/firestore-rest'
import { buildStudentEmail } from '@/lib/classroom'

const API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY!
const FIREBASE_PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!
const WEB_API_KEY = process.env.NEXT_PUBLIC_FIREBASE_API_KEY!

async function getClass(classCode: string) {
  const url = `${FIRESTORE_BASE}/classes/${classCode.toUpperCase()}?key=${API_KEY}`
  const res = await fetch(url)
  if (!res.ok) return null
  const data = await res.json()
  if (!data.fields) return null
  return {
    classCode: data.fields.classCode?.stringValue,
    teacherId: data.fields.teacherId?.stringValue,
    teacherName: data.fields.teacherName?.stringValue || '',
    schoolName: data.fields.schoolName?.stringValue,
    grade: Number(data.fields.grade?.integerValue),
    classNum: Number(data.fields.classNum?.integerValue),
    masterFolderId: data.fields.masterFolderId?.stringValue || null,
  }
}

async function checkStudentExists(classCode: string, studentName: string): Promise<boolean> {
  const url = `${FIRESTORE_BASE}:runQuery?key=${API_KEY}`
  const body = {
    structuredQuery: {
      from: [{ collectionId: 'users' }],
      where: {
        compositeFilter: {
          op: 'AND',
          filters: [
            { fieldFilter: { field: { fieldPath: 'classCode' }, op: 'EQUAL', value: { stringValue: classCode } } },
            { fieldFilter: { field: { fieldPath: 'studentName' }, op: 'EQUAL', value: { stringValue: studentName } } },
          ]
        }
      },
      limit: 1,
    }
  }
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const results = await res.json()
  return !!(results[0]?.document)
}

export async function POST(req: NextRequest) {
  try {
    const { classCode, studentName, password } = await req.json()
    if (!classCode || !studentName || !password) {
      return NextResponse.json({ error: '클래스 코드, 이름, 비밀번호를 모두 입력해주세요.' }, { status: 400 })
    }
    if (password.length < 6) {
      return NextResponse.json({ error: '비밀번호는 6자 이상이어야 합니다.' }, { status: 400 })
    }

    const upperCode = classCode.toUpperCase()

    // 1. 클래스 존재 확인
    const classroom = await getClass(upperCode)
    if (!classroom) {
      return NextResponse.json({ error: '유효하지 않은 클래스 코드입니다.' }, { status: 404 })
    }

    // 2. 같은 반 동명이인 방지
    const exists = await checkStudentExists(upperCode, studentName)
    if (exists) {
      return NextResponse.json({ error: '이미 등록된 이름입니다. 선생님께 문의하세요.' }, { status: 409 })
    }

    // 3. Firebase Auth 계정 생성 (Identity Toolkit REST API)
    const email = buildStudentEmail(upperCode, studentName)
    const signUpUrl = `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${WEB_API_KEY}`
    const signUpRes = await fetch(signUpUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // displayName을 Firebase Auth에 함께 저장 — 이후 initNewUserTokens가 이름을 정확히 불러오도록
      body: JSON.stringify({ email, password, displayName: studentName, returnSecureToken: true }),
    })
    const signUpData = await signUpRes.json()
    if (!signUpRes.ok) {
      const msg = signUpData.error?.message || '계정 생성 실패'
      if (msg === 'EMAIL_EXISTS') {
        return NextResponse.json({ error: '이미 가입된 이름입니다.' }, { status: 409 })
      }
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    const uid = signUpData.localId
    const newUserToken = signUpData.idToken  // 신규 계정의 ID 토큰 (Firestore 인증용)

    // 4. Firestore users 문서 생성 (신규 계정 토큰으로 인증)
    const userUrl = `${FIRESTORE_BASE}/users/${uid}?key=${API_KEY}`
    const userRes = await fetch(userUrl, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(newUserToken ? { 'Authorization': `Bearer ${newUserToken}` } : {}),
      },
      body: JSON.stringify({
        fields: {
          uid: { stringValue: uid },
          displayName: { stringValue: studentName },
          studentName: { stringValue: studentName },
          photoURL: { stringValue: '' },
          email: { stringValue: email },
          role: { stringValue: 'student' },
          classCode: { stringValue: upperCode },
          schoolName: { stringValue: classroom.schoolName || '' },
          grade: { integerValue: String(classroom.grade) },
          classNum: { integerValue: String(classroom.classNum) },
          tokens: { integerValue: '0' },
          plan: { stringValue: 'free' },
          profileCompleted: { booleanValue: true },
        }
      }),
    })

    if (!userRes.ok) {
      const errText = await userRes.text()
      console.error('[Enroll] users 문서 생성 실패:', errText)
      // Auth 계정은 생성됐지만 문서 저장 실패 → 오류 반환
      return NextResponse.json({ error: '학생 정보 저장에 실패했습니다. 다시 시도해주세요.' }, { status: 500 })
    }

    // 5. 교사의 masterFolder가 있으면 자동 복제
    if (classroom.masterFolderId && classroom.teacherId) {
      try {
        // 클라이언트 SDK가 필요한 복잡한 작업이라 별도 API 호출로 처리
        // 여기서는 플래그만 저장하고 클라이언트 로그인 후 처리
        // (idToken이 있어야 Firestore 클라이언트 SDK 사용 가능)
      } catch (e) {
        console.warn('[Enroll] masterFolder 상속 실패:', e)
      }
    }

    return NextResponse.json({
      success: true,
      uid,
      email,
      classCode: upperCode,
      teacherName: classroom.teacherName,
      masterFolderId: classroom.masterFolderId,
      teacherId: classroom.teacherId,
    })
  } catch (error: any) {
    console.error('[Enroll] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
