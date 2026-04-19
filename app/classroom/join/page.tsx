'use client'

import { useState } from 'react'
import { useAuth } from '@/providers/AuthProvider'
import { useRouter, useSearchParams } from 'next/navigation'
import { buildStudentEmail } from '@/lib/classroom'
import { inheritMasterFolder } from '@/lib/classroom'
import Header from '@/components/common/Header'
import Link from 'next/link'

type Step = 'form' | 'loading' | 'done'

export default function ClassroomJoinPage() {
  const { signInStudent } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [classCode, setClassCode] = useState((searchParams.get('code') ?? '').toUpperCase())
  const [studentName, setStudentName] = useState('')
  const [password, setPassword] = useState('')
  const [step, setStep] = useState<Step>('form')
  const [error, setError] = useState('')
  const [teacherName, setTeacherName] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!classCode.trim() || !studentName.trim() || !password) {
      setError('모든 항목을 입력해주세요.')
      return
    }
    setStep('loading')

    try {
      // 1. 서버에서 Firebase Auth 계정 생성 + Firestore 문서 생성
      const res = await fetch('/api/classroom/enroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classCode: classCode.trim(), studentName: studentName.trim(), password }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      setTeacherName(data.teacherName || '')

      // 2. 생성된 계정으로 로그인
      const email = buildStudentEmail(classCode.trim().toUpperCase(), studentName.trim())
      await signInStudent(email, password)

      // 3. 로그인 후 masterFolder 상속 (클라이언트 SDK 사용)
      // masterFolderIds(복수) 우선, 없으면 masterFolderId(단일) 하위호환
      const folderIdsToInherit: string[] =
        data.masterFolderIds?.length
          ? data.masterFolderIds
          : data.masterFolderId
          ? [data.masterFolderId]
          : []

      if (folderIdsToInherit.length > 0 && data.teacherId) {
        for (const folderId of folderIdsToInherit) {
          try {
            await inheritMasterFolder(
              data.teacherId,
              folderId,
              data.uid,
              studentName.trim(),
              data.teacherName || '선생님',
            )
          } catch (e) {
            console.warn('[Join] 폴더 상속 실패:', folderId, e)
          }
        }
      }

      setStep('done')
      setTimeout(() => router.push('/mypage'), 2000)
    } catch (e: any) {
      setError(e.message || '오류가 발생했습니다.')
      setStep('form')
    }
  }

  if (step === 'loading') {
    return (
      <div className="min-h-screen bg-[#1a1918] flex flex-col items-center justify-center gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500" />
        <p className="text-gray-400 text-sm">계정을 만들고 있어요...</p>
      </div>
    )
  }

  if (step === 'done') {
    return (
      <div className="min-h-screen bg-[#1a1918] flex flex-col items-center justify-center gap-4 text-center px-4">
        <div className="text-5xl mb-2">🎉</div>
        <h2 className="text-xl font-black text-white">가입 완료!</h2>
        <p className="text-gray-400 text-sm">
          {teacherName ? `${teacherName} 선생님의 ` : ''}수업자료가 내 페이지에 추가됐어요.
        </p>
        <p className="text-gray-600 text-xs">잠시 후 이동합니다...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#1a1918] text-white">
      <Header title="📖 클래스 참여하기" />
      <main className="max-w-lg mx-auto px-4 py-12">
        <div className="bg-[#23211f] rounded-[28px] border border-white/10 p-8">
          <h1 className="text-2xl font-black mb-2">수업 참여</h1>
          <p className="text-gray-400 text-sm mb-8">선생님께 받은 클래스 코드와 이름을 입력하세요.</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">클래스 코드</label>
              <input
                type="text"
                value={classCode}
                onChange={e => setClassCode(e.target.value.toUpperCase())}
                placeholder="예) AB1C23"
                maxLength={6}
                className="w-full bg-[#1a1918] border border-white/10 rounded-xl px-4 py-3 text-sm font-mono tracking-widest focus:outline-none focus:border-orange-500 transition-colors uppercase"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">이름</label>
              <input
                type="text"
                value={studentName}
                onChange={e => setStudentName(e.target.value)}
                placeholder="본인 이름을 입력하세요"
                className="w-full bg-[#1a1918] border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-orange-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">비밀번호 설정</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="6자 이상"
                className="w-full bg-[#1a1918] border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-orange-500 transition-colors"
              />
            </div>

            {error && <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2">{error}</p>}

            <button
              type="submit"
              className="w-full py-3.5 bg-orange-500 hover:bg-orange-600 rounded-xl font-bold text-sm transition-colors"
            >
              수업 참여하기
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-white/5 text-center">
            <p className="text-xs text-gray-500">
              이미 가입했나요?{' '}
              <Link href="/classroom/login" className="text-orange-400 hover:underline">로그인</Link>
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
