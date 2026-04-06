'use client'

import React from 'react'
import Link from 'next/link'
import { useAuth } from '@/providers/AuthProvider'

export default function Header({ title = '🎬 Next Curator' }: { title?: string }) {
  const { user, signInWithGoogle, signOut } = useAuth()

  return (
    <div className="sticky top-0 z-50 bg-[#252423]/90 backdrop-blur-xl border-b border-white/5 py-3 px-6 md:px-8 mb-6">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-xl font-bold tracking-tight text-white hover:opacity-80 transition-opacity">
            {title}
          </Link>
          <nav className="hidden md:flex items-center gap-4 text-sm font-medium">
            <Link href="/mypage" className="text-[#a4a09c] hover:text-white transition-colors">마이페이지</Link>
            <Link href="/square" className="text-[#a4a09c] hover:text-white transition-colors">스퀘어</Link>
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex md:hidden items-center gap-3 text-xs mr-2">
            <Link href="/mypage" className="text-[#a4a09c] hover:text-white">마이</Link>
            <Link href="/square" className="text-[#a4a09c] hover:text-white">스퀘어</Link>
          </div>
          
          {user ? (
            <div className="flex items-center gap-3">
              <span className="text-xs text-[#a4a09c] hidden sm:block">{user.displayName}</span>
              <img src={user.photoURL || ''} alt="Profile" className="w-8 h-8 rounded-full border border-white/10" />
              <button onClick={signOut} className="text-xs text-orange-400 hover:text-orange-300">
                로그아웃
              </button>
            </div>
          ) : (
            <button 
              onClick={signInWithGoogle}
              className="px-4 py-1.5 bg-white text-black text-sm font-bold rounded-full hover:bg-zinc-200 transition-colors"
            >
              로그인
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
