'use client'

import { useState, useEffect } from 'react'
import { auth } from '@/lib/firebase'
import { GoogleAuthProvider, signInWithPopup, onAuthStateChanged } from 'firebase/auth'

export default function ExtensionAuthPage() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [error, setError] = useState('')
  const [extId, setExtId] = useState<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    setExtId(params.get('ext'))

    // 이미 로그인된 경우 바로 토큰 전송
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        await sendToken(user, params.get('ext'))
      }
    })
    return () => unsub()
  }, [])

  async function sendToken(user: any, eid: string | null) {
    if (!eid) {
      setError('확장 프로그램 ID가 없습니다. 쏙튜브 확장에서 다시 시도해주세요.')
      setStatus('error')
      return
    }
    try {
      setStatus('loading')
      const idToken = await user.getIdToken(true)

      await new Promise<void>((resolve, reject) => {
        const w = window as any
        if (typeof w.chrome === 'undefined' || !w.chrome?.runtime) {
          reject(new Error('Chrome 확장 환경이 아닙니다.'))
          return
        }
        w.chrome.runtime.sendMessage(eid, {
          type: 'ssoktube_auth',
          idToken,
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
        }, (response: any) => {
          if (w.chrome.runtime.lastError) {
            reject(new Error(w.chrome.runtime.lastError.message))
          } else {
            resolve()
          }
        })
      })

      setStatus('success')
    } catch (e: any) {
      setError(e.message || '연결 중 오류가 발생했습니다.')
      setStatus('error')
    }
  }

  async function handleLogin() {
    try {
      setStatus('loading')
      const provider = new GoogleAuthProvider()
      const result = await signInWithPopup(auth, provider)
      await sendToken(result.user, extId)
    } catch (e: any) {
      setError(e.message || '로그인 중 오류가 발생했습니다.')
      setStatus('error')
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#1c1a18',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: '-apple-system, sans-serif',
    }}>
      <div style={{
        background: '#26231f',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '16px',
        padding: '36px 32px',
        maxWidth: '360px',
        width: '100%',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: '28px', fontWeight: 900, color: '#fff', marginBottom: '6px' }}>
          쏙<span style={{ color: '#8b5cf6' }}>튜브</span>
        </div>
        <div style={{ fontSize: '13px', color: '#75716e', marginBottom: '28px' }}>
          Chrome 확장 프로그램 로그인
        </div>

        {status === 'success' ? (
          <div>
            <div style={{ fontSize: '36px', marginBottom: '12px' }}>✅</div>
            <div style={{ color: '#a4a09c', fontSize: '14px', marginBottom: '8px' }}>
              로그인 완료!
            </div>
            <div style={{ color: '#75716e', fontSize: '12px' }}>
              이 탭을 닫고 확장 프로그램으로 돌아가세요.
            </div>
          </div>
        ) : status === 'error' ? (
          <div>
            <div style={{ fontSize: '36px', marginBottom: '12px' }}>❌</div>
            <div style={{ color: '#fca5a5', fontSize: '13px', marginBottom: '16px' }}>
              {error}
            </div>
            <button
              onClick={() => setStatus('idle')}
              style={{
                background: '#7c3aed', color: '#fff', border: 'none',
                borderRadius: '8px', padding: '10px 20px', cursor: 'pointer', fontSize: '13px',
              }}
            >
              다시 시도
            </button>
          </div>
        ) : (
          <div>
            <div style={{ color: '#a4a09c', fontSize: '13px', marginBottom: '24px', lineHeight: 1.6 }}>
              쏙튜브 확장 프로그램에서<br />
              유튜브 요약을 저장하고 관리하려면<br />
              로그인이 필요합니다.
            </div>
            <button
              onClick={handleLogin}
              disabled={status === 'loading'}
              style={{
                width: '100%',
                background: status === 'loading' ? 'rgba(124,58,237,0.5)' : '#7c3aed',
                color: '#fff', border: 'none',
                borderRadius: '10px', padding: '12px',
                cursor: status === 'loading' ? 'not-allowed' : 'pointer',
                fontSize: '14px', fontWeight: 700,
              }}
            >
              {status === 'loading' ? '연결 중...' : 'Google로 로그인'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
