'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { User, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut as firebaseSignOut } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { getUserProfile, initNewUserTokens, UserProfile } from '@/lib/db'

interface AuthContextType {
  user: User | null
  loading: boolean
  userProfile: UserProfile | null
  needsProfile: boolean          // 온보딩 모달 표시 여부
  refreshProfile: () => Promise<void>
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  userProfile: null,
  needsProfile: false,
  refreshProfile: async () => {},
  signInWithGoogle: async () => {},
  signOut: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [needsProfile, setNeedsProfile] = useState(false)

  const loadProfile = async (u: User) => {
    try {
      // 신규 유저 초기화 (이미 있으면 내부에서 스킵)
      await initNewUserTokens(u.uid, u.displayName || '', u.photoURL || '', u.email || '')
      const profile = await getUserProfile(u.uid)
      setUserProfile(profile)
      // 프로필 미완성이면 온보딩 모달 띄움
      setNeedsProfile(!profile?.profileCompleted)
    } catch (e) {
      console.error('Failed to load user profile:', e)
    }
  }

  const refreshProfile = async () => {
    if (!user) return
    const profile = await getUserProfile(user.uid)
    setUserProfile(profile)
    setNeedsProfile(!profile?.profileCompleted)
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser)
      if (currentUser) {
        await loadProfile(currentUser)
      } else {
        setUserProfile(null)
        setNeedsProfile(false)
      }
      setLoading(false)
    })
    return () => unsubscribe()
  }, [])

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider()
    try {
      await signInWithPopup(auth, provider)
      // 프로필 로드는 onAuthStateChanged에서 처리됨
    } catch (error) {
      console.error('Google sign in error:', error)
      alert('로그인 중 오류가 발생했습니다.')
    }
  }

  const signOut = async () => {
    try {
      await firebaseSignOut(auth)
      setUserProfile(null)
      setNeedsProfile(false)
    } catch (error) {
      console.error('Sign out error:', error)
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, userProfile, needsProfile, refreshProfile, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
