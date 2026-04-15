'use client'

import { useState } from 'react'
import { useAuth } from '@/providers/AuthProvider'
import { useRouter } from 'next/navigation'
import { buildStudentEmail } from '@/lib/classroom'
import Header from '@/components/common/Header'
import Link from 'next/link'

export default function StudentLoginPage() {
  const { signInStudent } = useAuth()
  const router = useRouter()
  const [classCode, setClassCode] = useState('')
  const [studentName, setStudentName] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!classCode.trim() || !studentName.trim() || !password) {
      setError('모든 항목을 입력해주세요.')
      return
    }
    setLoading(true)
    try {
      const email = buildStudentEmail(classCode.trim().toUpperCase(), studentName.trim())
      await signInStudent(email, password)
      router.push('/mypage')
    } catch (e: any) {
      const msg = e.code === 'auth/invalid-credential' || e.code === 'auth/wrong-password'
        ? '클래스 코드, 이름 또는 비밀번호가 올바르지 않습니다.'
        : e.message || '로그인에 실패했습니다.'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#1a1918] text-white">
      <Header title="📖 학생 로그인" />
      <main className="max-w-lg mx-auto px-4 py-12">
        <div className="bg-[#23211f] rounded-[28px] border border-white/10 p-8">
          <h1 className="text-2xl font-black mb-2">학생 로그인</h1>
          <p className="text-gray-400 text-sm mb-8">클래스 코드와 이름으로 로그인하세요.</p>

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
                placeholder="본인 이름"
                className="w-full bg-[#1a1918] border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-orange-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">비밀번호</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="비밀번호"
                className="w-full bg-[#1a1918] border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-orange-500 transition-colors"
              />
            </div>

            {error && <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-orange-500 hover:bg-orange-600 rounded-xl font-bold text-sm transition-colors disabled:opacity-50"
            >
              {loading ? '로그인 중...' : '로그인'}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-white/5 text-center">
            <p className="text-xs text-gray-500">
              처음 참여하는 학생이라면{' '}
              <Link href="/classroom/join" className="text-orange-400 hover:underline">여기서 가입</Link>
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
