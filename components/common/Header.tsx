'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/providers/AuthProvider'
import { getTotalUnread } from '@/lib/db'

export default function Header({ title = '🎬 Next Curator' }: { title?: string }) {
  const { user, signInWithGoogle, signOut } = useAuth()
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    if (!user) { setUnread(0); return }
    getTotalUnread(user.uid).then(setUnread).catch(() => {})
    const interval = setInterval(() => getTotalUnread(user.uid).then(setUnread).catch(() => {}), 30000)
    return () => clearInterval(interval)
  }, [user])

  return (
    <div className="sticky top-0 z-50 bg-[#252423]/90 backdrop-blur-xl border-b border-white/5 py-2.5 px-4 md:px-8 mb-6">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-sm font-bold tracking-tight text-white hover:opacity-80 transition-opacity whitespace-nowrap">
            {title}
          </Link>
          <nav className="hidden md:flex items-center gap-4 text-sm font-medium">
            <Link href="/mypage" className="text-[#a4a09c] hover:text-white transition-colors">My Page</Link>
            <Link href="/square" className="text-[#a4a09c] hover:text-white transition-colors">Square</Link>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex md:hidden items-center gap-3 text-xs">
            <Link href="/mypage" className="text-[#a4a09c] hover:text-white whitespace-nowrap">My</Link>
            <Link href="/square" className="text-[#a4a09c] hover:text-white whitespace-nowrap">Square</Link>
          </div>

          {user ? (
            <div className="flex items-center gap-2">
              {/* 쪽지 아이콘 */}
              <Link href="/messages" className="relative text-[#a4a09c] hover:text-white transition-colors">
                <span className="text-base">✉️</span>
                {unread > 0 && (
                  <span className="absolute -top-1 -right-1 bg-orange-500 text-white text-[8px] font-bold w-3.5 h-3.5 rounded-full flex items-center justify-center">
                    {unread > 9 ? '9+' : unread}
                  </span>
                )}
              </Link>
              <img src={user.photoURL || ''} alt="Profile" className="w-7 h-7 rounded-full border border-white/10" />
              <button onClick={signOut} className="text-xs text-orange-400 hover:text-orange-300 whitespace-nowrap">
                Logout
              </button>
            </div>
          ) : (
            <button
              onClick={signInWithGoogle}
              className="px-3 py-1.5 bg-white text-black text-xs font-bold rounded-full hover:bg-zinc-200 transition-colors whitespace-nowrap"
            >
              Login
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
