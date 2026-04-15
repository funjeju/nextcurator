'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import {
  User, onAuthStateChanged, GoogleAuthProvider, signInWithPopup,
  signOut as firebaseSignOut, createUserWithEmailAndPassword,
  signInWithEmailAndPassword, sendEmailVerification,
  sendPasswordResetEmail, updateProfile,
} from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { getUserProfile, initNewUserTokens, setInitialUserDoc, UserProfile } from '@/lib/db'
import { getRandomAvatarEmoji } from '@/lib/avatar'

interface AuthContextType {
  user: User | null
  loading: boolean
  userProfile: UserProfile | null
  needsProfile: boolean
  refreshProfile: () => Promise<void>
  signInWithGoogle: () => Promise<void>
  signInStudent: (email: string, password: string) => Promise<void>
  signInWithEmail: (email: string, password: string) => Promise<void>
  signUpWithEmail: (email: string, password: string, displayName: string) => Promise<'verify_email'>
  sendPasswordReset: (email: string) => Promise<void>
  signOut: () => Promise<void>
  // 인증 모달 제어
  authModalOpen: boolean
  authModalView: 'login' | 'signup'
  openAuthModal: (view?: 'login' | 'signup') => void
  closeAuthModal: () => void
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  userProfile: null,
  needsProfile: false,
  refreshProfile: async () => {},
  signInWithGoogle: async () => {},
  signInStudent: async () => {},
  signInWithEmail: async () => {},
  signUpWithEmail: async () => 'verify_email',
  sendPasswordReset: async () => {},
  signOut: async () => {},
  authModalOpen: false,
  authModalView: 'login',
  openAuthModal: () => {},
  closeAuthModal: () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [needsProfile, setNeedsProfile] = useState(false)
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [authModalView, setAuthModalView] = useState<'login' | 'signup'>('login')

  const openAuthModal = (view: 'login' | 'signup' = 'login') => {
    setAuthModalView(view)
    setAuthModalOpen(true)
  }
  const closeAuthModal = () => setAuthModalOpen(false)

  const loadProfile = async (u: User) => {
    try {
      // 신규 유저 초기화 (이미 있으면 내부에서 스킵)
      await initNewUserTokens(u.uid, u.displayName || '', u.photoURL || '', u.email || '')
      const profile = await getUserProfile(u.uid)
      setUserProfile(profile)
      // 프로필 미완성이면 온보딩 모달 띄움
      setNeedsProfile(!profile?.profileCompleted)

      // 학생 계정이면 로그인 로그 기록 (세션당 1회)
      if (profile?.role === 'student' && profile.classCode) {
        const sessionKey = `login_logged_${u.uid}_${new Date().toDateString()}`
        if (!sessionStorage.getItem(sessionKey)) {
          sessionStorage.setItem(sessionKey, '1')
          const isMobile = typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0
          fetch('/api/classroom/activity', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              studentId: u.uid,
              studentName: profile.studentName || profile.displayName || '',
              classCode: profile.classCode,
              type: 'login',
              value: { device: isMobile ? 'mobile' : 'desktop' },
            }),
          }).catch(() => {})
        }
      }
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

  const signInStudent = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password)
  }

  const signInWithEmail = async (email: string, password: string) => {
    const cred = await signInWithEmailAndPassword(auth, email, password)
    if (!cred.user.emailVerified) {
      await firebaseSignOut(auth)
      throw new Error('EMAIL_NOT_VERIFIED')
    }
  }

  const signUpWithEmail = async (email: string, password: string, displayName: string): Promise<'verify_email'> => {
    const cred = await createUserWithEmailAndPassword(auth, email, password)
    await updateProfile(cred.user, { displayName })
    // 랜덤 아바타 이모지 배정 + 초기 Firestore 문서 생성
    const avatarEmoji = getRandomAvatarEmoji()
    await setInitialUserDoc(cred.user.uid, displayName, email, avatarEmoji)
    // 한국어로 인증 메일 발송
    auth.languageCode = 'ko'
    await sendEmailVerification(cred.user, {
      url: `${typeof window !== 'undefined' ? window.location.origin : 'https://ssoktube.com'}/`,
    })
    // 인증 메일 발송 후 즉시 로그아웃 — 이메일 인증 후 다시 로그인하도록
    await firebaseSignOut(auth)
    return 'verify_email'
  }

  const sendPasswordReset = async (email: string) => {
    auth.languageCode = 'ko'
    await sendPasswordResetEmail(auth, email, {
      url: `${typeof window !== 'undefined' ? window.location.origin : 'https://ssoktube.com'}/`,
    })
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

  // 로그인 성공 시 모달 자동 닫기
  useEffect(() => {
    if (user) closeAuthModal()
  }, [user])

  return (
    <AuthContext.Provider value={{
      user, loading, userProfile, needsProfile, refreshProfile,
      signInWithGoogle, signInStudent, signInWithEmail, signUpWithEmail, sendPasswordReset,
      signOut,
      authModalOpen, authModalView, openAuthModal, closeAuthModal,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
