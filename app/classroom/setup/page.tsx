'use client'

import { useState } from 'react'
import { useAuth } from '@/providers/AuthProvider'
import { useRouter } from 'next/navigation'
import Header from '@/components/common/Header'
import Link from 'next/link'

export default function ClassroomSetupPage() {
  const { user, userProfile, loading } = useAuth()
  const router = useRouter()
  const [schoolName, setSchoolName] = useState('')
  const [grade, setGrade] = useState('')
  const [classNum, setClassNum] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1a1918] flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-orange-500" />
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#1a1918] flex flex-col items-center justify-center p-6 text-center">
        <p className="text-white mb-4">로그인이 필요합니다.</p>
        <Link href="/" className="text-orange-400 underline">홈으로</Link>
      </div>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!schoolName.trim() || !grade || !classNum) {
      setError('모든 항목을 입력해주세요.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/classroom/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: user.uid,
          teacherName: userProfile?.displayName || user.displayName || '',
          schoolName: schoolName.trim(),
          grade: Number(grade),
          classNum: Number(classNum),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      router.push(`/classroom/${data.classCode}`)
    } catch (e: any) {
      setError(e.message || '오류가 발생했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#1a1918] text-white">
      <Header title="🏫 클래스 만들기" />
      <main className="max-w-lg mx-auto px-4 py-12">
        <div className="bg-[#23211f] rounded-[28px] border border-white/10 p-8">
          <h1 className="text-2xl font-black mb-2">새 클래스 개설</h1>
          <p className="text-gray-400 text-sm mb-8">학교·학년·반 정보를 입력하면 학생들과 공유할 고유 코드가 발급됩니다.</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">학교명</label>
              <input
                type="text"
                value={schoolName}
                onChange={e => setSchoolName(e.target.value)}
                placeholder="예) 제주초등학교"
                className="w-full bg-[#1a1918] border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-orange-500 transition-colors"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">학년</label>
                <select
                  value={grade}
                  onChange={e => setGrade(e.target.value)}
                  className="w-full bg-[#1a1918] border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-orange-500 transition-colors"
                >
                  <option value="">선택</option>
                  {[1,2,3,4,5,6].map(g => <option key={g} value={g}>{g}학년</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">반</label>
                <select
                  value={classNum}
                  onChange={e => setClassNum(e.target.value)}
                  className="w-full bg-[#1a1918] border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-orange-500 transition-colors"
                >
                  <option value="">선택</option>
                  {[1,2,3,4,5,6,7,8,9,10].map(n => <option key={n} value={n}>{n}반</option>)}
                </select>
              </div>
            </div>

            {error && <p className="text-red-400 text-xs">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 bg-orange-500 hover:bg-orange-600 rounded-xl font-bold text-sm transition-colors disabled:opacity-50"
            >
              {submitting ? '생성 중...' : '클래스 코드 발급하기'}
            </button>
          </form>
        </div>
      </main>
    </div>
  )
}
