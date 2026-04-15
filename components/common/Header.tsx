'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/providers/AuthProvider'
import { getTotalUnread } from '@/lib/db'
import { getAvatarBg } from '@/lib/avatar'
import { useTheme } from './ThemeProvider'
import MessagesModal from '@/components/messages/MessagesModal'

export default function Header({ title = 'SSOKTUBE' }: { title?: string }) {
  const { user, userProfile, signOut, openAuthModal } = useAuth()
  const { theme, toggle } = useTheme()
  const [unread, setUnread] = useState(0)
  const [showMessages, setShowMessages] = useState(false)

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
          <Link href="/" onClick={handleNav} className="text-sm font-black tracking-tight hover:opacity-80 transition-opacity whitespace-nowrap">
            <span className="text-orange-400">SSOK</span><span className="text-white">TUBE</span>
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
              </>
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
          {/* 다크/라이트 모드 토글 */}
          <button
            onClick={toggle}
            className="w-8 h-8 flex items-center justify-center rounded-full text-[#a4a09c] hover:text-white hover:bg-white/8 transition-all"
            title={theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'}
          >
            {theme === 'dark' ? (
              /* 해 아이콘 — 라이트로 전환 */
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="4"/>
                <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
              </svg>
            ) : (
              /* 달 아이콘 — 다크로 전환 */
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
            )}
          </button>

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
                <button
                  onClick={() => setShowMessages(v => !v)}
                  className="relative text-[#a4a09c] hover:text-white transition-colors p-1"
                >
                  <span className="text-sm">✉️</span>
                  {unread > 0 && (
                    <span className="absolute top-0 right-0 bg-orange-500 text-white text-[7px] font-bold w-3 h-3 rounded-full flex items-center justify-center">
                      {unread > 9 ? '9+' : unread}
                    </span>
                  )}
                </button>
              )}
              {/* 학생은 이름 표시, 그 외는 프로필 사진 */}
              {isStudent ? (
                <span className="text-xs text-white font-bold">{userProfile?.studentName || userProfile?.displayName}</span>
              ) : user.photoURL ? (
                <img src={user.photoURL} alt="Profile" className="w-6 h-6 rounded-full border border-white/10" />
              ) : userProfile?.avatarEmoji ? (
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-sm border border-white/10 shrink-0"
                  style={{ backgroundColor: getAvatarBg(userProfile.avatarEmoji) }}
                >
                  {userProfile.avatarEmoji}
                </div>
              ) : (
                <div className="w-6 h-6 rounded-full bg-[#3d3a38] flex items-center justify-center text-xs border border-white/10">👤</div>
              )}
              <button onClick={signOut} className="text-[11px] text-orange-400 hover:text-orange-300 whitespace-nowrap">
                Logout
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => openAuthModal('login')}
                className="px-3 py-1.5 bg-white/10 text-white text-xs font-bold rounded-full hover:bg-white/20 transition-colors whitespace-nowrap border border-white/10"
              >
                로그인
              </button>
              <button
                onClick={() => openAuthModal('signup')}
                className="px-3 py-1.5 bg-orange-500 text-white text-xs font-bold rounded-full hover:bg-orange-600 transition-colors whitespace-nowrap"
              >
                회원가입
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 쪽지함 팝업 */}
      {showMessages && user && (
        <MessagesModal onClose={() => setShowMessages(false)} />
      )}
    </div>
  )
}
