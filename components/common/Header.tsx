'use client'

import React, { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/providers/AuthProvider'
import { getTotalUnread } from '@/lib/db'
import { getAvatarBg } from '@/lib/avatar'
import MessagesModal from '@/components/messages/MessagesModal'
import ReviewBanner from '@/components/classroom/ReviewBanner'
import ContactModal from '@/components/common/ContactModal'

export default function Header({ title = 'SSOKTUBE' }: { title?: string }) {
  const { user, userProfile, signOut, openAuthModal } = useAuth()
  const [unread, setUnread] = useState(0)
  const [showMessages, setShowMessages] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [showContact, setShowContact] = useState(false)
  const mobileMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!mobileMenuOpen) return
    const handler = (e: MouseEvent) => {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(e.target as Node)) {
        setMobileMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [mobileMenuOpen])

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

  const pathname = usePathname()
  const isOnSquare = pathname === '/square'

  const isTeacher = userProfile?.role === 'teacher'
  const isStudent = userProfile?.role === 'student'
  const classCode = userProfile?.classCode

  return (
    <>
    {/* 학생 복습 알림 배너 */}
    {isStudent && user && <ReviewBanner studentId={user.uid} />}
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
                {isOnSquare
                  ? <Link href="/" onClick={handleNav} className="text-orange-400 hover:text-orange-300 transition-colors font-bold">✦ 요약하기</Link>
                  : <Link href="/square" onClick={handleNav} className="text-[#a4a09c] hover:text-white transition-colors">SQUARE K</Link>
                }
                <Link href="/magazine" onClick={handleNav} className="text-[#a4a09c] hover:text-white transition-colors">매거진</Link>
              </>
            ) : (
              /* 일반 계정 */
              <>
                <Link href="/mypage" onClick={handleNav} className="text-[#a4a09c] hover:text-white transition-colors">My Page</Link>
                {isOnSquare
                  ? <Link href="/" onClick={handleNav} className="text-orange-400 hover:text-orange-300 transition-colors font-bold">✦ 요약하기</Link>
                  : <Link href="/square" onClick={handleNav} className="text-[#a4a09c] hover:text-white transition-colors">SQUARE K</Link>
                }
                <Link href="/magazine" onClick={handleNav} className="text-[#a4a09c] hover:text-white transition-colors">매거진</Link>
              </>
            )}
            {/* 교사: 클래스 없으면 개설 유도 */}
            {isTeacher && !classCode && (
              <Link href="/classroom/setup" onClick={handleNav} className="text-emerald-400 hover:text-emerald-300 transition-colors text-xs">
                + 클래스 만들기
              </Link>
            )}
            {/* 문의·제안 */}
            <button
              onClick={() => setShowContact(true)}
              className="text-[#a4a09c] hover:text-white transition-colors text-xs"
            >
              문의 · 제안
            </button>
          </nav>
        </div>

        <div className="flex items-center gap-1.5">

          {/* 모바일: 현재 페이지에 따라 버튼 전환 */}
          {isOnSquare ? (
            <Link
              href="/"
              onClick={handleNav}
              className="md:hidden flex items-center px-2.5 py-1 rounded-lg text-xs font-black text-orange-400 hover:bg-orange-500/10 transition-colors border border-orange-500/20 whitespace-nowrap"
            >
              ✦ 요약하기
            </Link>
          ) : (
            <Link
              href="/square"
              onClick={handleNav}
              className="md:hidden flex items-center px-2.5 py-1 rounded-lg text-xs font-black text-orange-400 hover:bg-orange-500/10 transition-colors border border-orange-500/20 whitespace-nowrap"
            >
              SQUARE K
            </Link>
          )}

          {/* 모바일 햄버거 */}
          <div className="md:hidden relative" ref={mobileMenuRef}>
            <button
              onClick={() => setMobileMenuOpen(v => !v)}
              className="w-8 h-8 flex items-center justify-center rounded-full text-[#a4a09c] hover:text-white hover:bg-white/8 transition-all"
              aria-label="메뉴"
            >
              {mobileMenuOpen ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M3 12h18M3 6h18M3 18h18"/></svg>
              )}
            </button>
            {mobileMenuOpen && (
              <div className="absolute right-0 top-10 w-44 bg-[#1c1a18] border border-white/10 rounded-2xl shadow-2xl py-2 z-50">
                {isStudent ? (
                  <Link href="/mypage" onClick={() => { handleNav; setMobileMenuOpen(false) }} className="flex items-center gap-2 px-4 py-2.5 text-sm text-blue-400 hover:bg-white/5 transition-colors">
                    <span>📚</span> 수업자료
                  </Link>
                ) : (
                  <>
                    <Link href="/mypage" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2 px-4 py-2.5 text-sm text-[#a4a09c] hover:text-white hover:bg-white/5 transition-colors">
                      <span>👤</span> My Page
                    </Link>
                    {isTeacher && classCode && (
                      <Link href={`/classroom/${classCode}`} onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2 px-4 py-2.5 text-sm text-emerald-400 hover:text-emerald-300 hover:bg-white/5 transition-colors font-bold">
                        <span>🏫</span> 내 클래스
                      </Link>
                    )}
                    {isTeacher && !classCode && (
                      <Link href="/classroom/setup" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2 px-4 py-2.5 text-sm text-emerald-400 hover:bg-white/5 transition-colors">
                        <span>➕</span> 클래스 만들기
                      </Link>
                    )}
                  </>
                )}
                <div className="border-t border-white/5 mt-1 pt-1">
                  <Link href="/magazine" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-2 px-4 py-2.5 text-sm text-[#a4a09c] hover:text-white hover:bg-white/5 transition-colors">
                    <span>✍️</span> 매거진
                  </Link>
                  <button
                    onClick={() => { setShowContact(true); setMobileMenuOpen(false) }}
                    className="w-full text-left flex items-center gap-2 px-4 py-2.5 text-sm text-[#a4a09c] hover:text-white hover:bg-white/5 transition-colors"
                  >
                    <span>📬</span> 문의 · 제안
                  </button>
                  <div className="border-t border-white/5 my-1" />
                  {user ? (
                    <button onClick={() => { signOut(); setMobileMenuOpen(false) }} className="w-full text-left flex items-center gap-2 px-4 py-2.5 text-sm text-orange-400 hover:bg-white/5 transition-colors">
                      <span>🚪</span> 로그아웃
                    </button>
                  ) : (
                    <>
                      <button onClick={() => { openAuthModal('login'); setMobileMenuOpen(false) }} className="w-full text-left flex items-center gap-2 px-4 py-2.5 text-sm text-[#a4a09c] hover:text-white hover:bg-white/5 transition-colors">
                        <span>🔑</span> 로그인
                      </button>
                      <button onClick={() => { openAuthModal('signup'); setMobileMenuOpen(false) }} className="w-full text-left flex items-center gap-2 px-4 py-2.5 text-sm text-orange-400 hover:bg-white/5 transition-colors">
                        <span>✨</span> 회원가입
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          {user ? (
            <div className="flex items-center gap-1.5">
              {/* 메시지 아이콘 (학생 제외) */}
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
              {/* 프로필 아바타 (모바일: 항상 표시) */}
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
              {/* Logout: 데스크탑만 */}
              <button onClick={signOut} className="hidden md:inline text-[11px] text-orange-400 hover:text-orange-300 whitespace-nowrap">
                Logout
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <Link
                href="/classroom/login"
                className="px-2.5 py-1.5 text-blue-400 text-xs font-bold rounded-full hover:bg-blue-500/10 transition-colors whitespace-nowrap border border-blue-500/20 hidden md:flex items-center gap-1"
              >
                📖 학생 로그인
              </Link>
              {/* 로그인/가입: 데스크탑만 (모바일은 햄버거에서) */}
              <button
                onClick={() => openAuthModal('login')}
                className="hidden md:inline-flex px-3 py-1.5 bg-white/10 text-white text-xs font-bold rounded-full hover:bg-white/20 transition-colors whitespace-nowrap border border-white/10"
              >
                로그인
              </button>
              <button
                onClick={() => openAuthModal('signup')}
                className="hidden md:inline-flex px-3 py-1.5 bg-orange-500 text-white text-xs font-bold rounded-full hover:bg-orange-600 transition-colors whitespace-nowrap"
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

    {/* 문의 모달 */}
    {showContact && (
      <ContactModal onClose={() => setShowContact(false)} />
    )}
    </>
  )
}
