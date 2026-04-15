'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/providers/AuthProvider'
import { getTotalUnread } from '@/lib/db'

export default function Header({ title = '🎬 Next Curator' }: { title?: string }) {
  const { user, userProfile, signInWithGoogle, signOut } = useAuth()
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    if (!user) { setUnread(0); return }
    getTotalUnread(user.uid).then(setUnread).catch(() => {})
    const interval = setInterval(() => getTotalUnread(user.uid).then(setUnread).catch(() => {}), 30000)
    return () => clearInterval(interval)
  }, [user])

  const handleNav = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (typeof window !== 'undefined' && (window as any).__NEXT_CURATOR_UNSAVED__) {
      if (!confirm('저장하지 않고 이동하시겠습니까? 분석 내용은 사라집니다.')) {
        e.preventDefault()
      }
    }
  }

  const isTeacher = userProfile?.role === 'teacher'
  const isStudent = userProfile?.role === 'student'
  const classCode = userProfile?.classCode

  return (
    <div className="sticky top-0 z-50 bg-[#252423]/90 backdrop-blur-xl border-b border-white/5 py-2.5 px-4 md:px-8 mb-6">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/" onClick={handleNav} className="text-sm font-bold tracking-tight text-white hover:opacity-80 transition-opacity whitespace-nowrap">
            {title}
          </Link>
          <nav className="hidden md:flex items-center gap-4 text-sm font-medium">
            {/* 학생 계정: 수업자료 바로가기 */}
            {isStudent ? (
              <>
                <Link href="/mypage" onClick={handleNav} className="text-[#a4a09c] hover:text-white transition-colors">수업자료</Link>
                <span className="text-[10px] px-2 py-0.5 bg-blue-500/15 text-blue-400 rounded-full font-bold border border-blue-500/20">
                  학생
                </span>
              </>
            ) : isTeacher && classCode ? (
              /* 교사 계정: 클래스 대시보드 링크 */
              <>
                <Link href="/mypage" onClick={handleNav} className="text-[#a4a09c] hover:text-white transition-colors">My Page</Link>
                <Link href={`/classroom/${classCode}`} onClick={handleNav} className="text-emerald-400 hover:text-emerald-300 transition-colors font-bold">
                  🏫 내 클래스
                </Link>
                <Link href="/square" onClick={handleNav} className="text-[#a4a09c] hover:text-white transition-colors">Square</Link>
              </>
            ) : (
              /* 일반 계정 */
              <>
                <Link href="/mypage" onClick={handleNav} className="text-[#a4a09c] hover:text-white transition-colors">My Page</Link>
                <Link href="/square" onClick={handleNav} className="text-[#a4a09c] hover:text-white transition-colors">Square</Link>
                {/* 미로그인: 학생/교사 전용 입장 */}
                {!user && (
                  <Link href="/classroom/join" onClick={handleNav} className="text-blue-400 hover:text-blue-300 transition-colors text-xs">
                    📖 학생 입장
                  </Link>
                )}
              </>
            )}
            {user?.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL && (
              <Link href="/admin" onClick={handleNav} className="text-orange-400 hover:text-orange-300 transition-colors">Admin</Link>
            )}
            {/* 교사: 클래스 없으면 개설 유도 */}
            {isTeacher && !classCode && (
              <Link href="/classroom/setup" onClick={handleNav} className="text-emerald-400 hover:text-emerald-300 transition-colors text-xs">
                + 클래스 만들기
              </Link>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-1.5">
          {/* 모바일 */}
          {isStudent ? (
            <Link href="/mypage" onClick={handleNav} className="md:hidden text-[11px] text-blue-400 whitespace-nowrap px-1.5 py-1 rounded-md hover:bg-white/5 transition-colors">수업</Link>
          ) : isTeacher && classCode ? (
            <Link href={`/classroom/${classCode}`} onClick={handleNav} className="md:hidden text-[11px] text-emerald-400 whitespace-nowrap px-1.5 py-1 rounded-md hover:bg-white/5 transition-colors">클래스</Link>
          ) : (
            <>
              <Link href="/mypage" onClick={handleNav} className="md:hidden text-[11px] text-[#a4a09c] hover:text-white whitespace-nowrap px-1.5 py-1 rounded-md hover:bg-white/5 transition-colors">My</Link>
              <Link href="/square" onClick={handleNav} className="md:hidden text-[11px] text-[#a4a09c] hover:text-white whitespace-nowrap px-1.5 py-1 rounded-md hover:bg-white/5 transition-colors">Square</Link>
            </>
          )}

          {user ? (
            <div className="flex items-center gap-1.5 ml-1 pl-1.5 border-l border-white/10 md:border-none md:ml-0 md:pl-0">
              {/* 학생 계정: 메시지 아이콘 숨김 */}
              {!isStudent && (
                <Link href="/messages" onClick={handleNav} className="relative text-[#a4a09c] hover:text-white transition-colors p-1">
                  <span className="text-sm">✉️</span>
                  {unread > 0 && (
                    <span className="absolute top-0 right-0 bg-orange-500 text-white text-[7px] font-bold w-3 h-3 rounded-full flex items-center justify-center">
                      {unread > 9 ? '9+' : unread}
                    </span>
                  )}
                </Link>
              )}
              {/* 학생은 이름 표시, 그 외는 프로필 사진 */}
              {isStudent ? (
                <span className="text-xs text-white font-bold">{userProfile?.studentName || userProfile?.displayName}</span>
              ) : (
                <img src={user.photoURL || ''} alt="Profile" className="w-6 h-6 rounded-full border border-white/10" />
              )}
              <button onClick={signOut} className="text-[11px] text-orange-400 hover:text-orange-300 whitespace-nowrap">
                Logout
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/classroom/login"
                onClick={handleNav}
                className="px-3 py-1.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 text-xs font-bold rounded-full hover:bg-blue-500/20 transition-colors whitespace-nowrap"
              >
                학생 로그인
              </Link>
              <button
                onClick={signInWithGoogle}
                className="px-3 py-1.5 bg-white text-black text-xs font-bold rounded-full hover:bg-zinc-200 transition-colors whitespace-nowrap"
              >
                Login
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
