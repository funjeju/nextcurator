'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getLocalUserId } from '@/lib/user'
import { getUserFolders, createFolder, saveSummary, upsertUserProfile, Folder } from '@/lib/db'
import { useAuth } from '@/providers/AuthProvider'

function withTimeout<T>(promise: Promise<T>, ms = 8000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('시간 초과: DB 연결에 실패했습니다.')), ms)
    )
  ])
}

export default function SaveModal({ data, onClose }: { data: any, onClose: () => void }) {
  const { user, signInWithGoogle } = useAuth()
  const [signingIn, setSigningIn] = useState(false)
  const [folders, setFolders] = useState<Folder[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [classifying, setClassifying] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [isPublic, setIsPublic] = useState(false)

  useEffect(() => {
    const fetchFolders = async () => {
      try {
        const uid = getLocalUserId()
        const list = await withTimeout(getUserFolders(uid), 6000)
        setFolders(list)
      } catch (e) {
        console.error('Failed to load folders:', e)
      } finally {
        setLoading(false)
      }
    }
    fetchFolders()
  }, [])

  const handleSaveToFolder = async (folderId: string) => {
    setSaving(true)
    try {
      const uid = getLocalUserId()
      if (user) await upsertUserProfile({ uid: user.uid, displayName: user.displayName || '', photoURL: user.photoURL || '' })
      const docId = await withTimeout(saveSummary({
        userId: uid,
        userDisplayName: user?.displayName || '',
        userPhotoURL: user?.photoURL || '',
        folderId,
        sessionId: data.sessionId,
        videoId: data.videoId,
        title: data.title,
        channel: data.channel,
        thumbnail: data.thumbnail,
        category: data.category,
        summary: data.summary ?? null,
        square_meta: data.summary?.square_meta,
        transcript: data.transcript,
        transcriptSource: data.transcriptSource,
        isPublic
      }))
      // 임베딩 생성 (비동기, 실패해도 저장에 영향 없음)
      fetch('/api/embed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ docId, title: data.title, category: data.category, summary: data.summary, contextSummary: data.contextSummary }),
      }).catch(() => {})
      alert('저장되었습니다!')
      onClose()
    } catch (e) {
      console.error('Save error:', e)
      alert((e as Error).message || '저장에 실패했습니다. DB 연결을 확인해주세요.')
    } finally {
      setSaving(false)
    }
  }

  const handleCreateAndSave = async () => {
    if (!newFolderName.trim()) return
    setSaving(true)
    try {
      const uid = getLocalUserId()
      const newFolder = await withTimeout(createFolder(uid, newFolderName.trim()))
      
      if (user) await upsertUserProfile({ uid: user.uid, displayName: user.displayName || '', photoURL: user.photoURL || '' })
      const docId2 = await withTimeout(saveSummary({
        userId: uid,
        userDisplayName: user?.displayName || '',
        userPhotoURL: user?.photoURL || '',
        folderId: newFolder.id,
        sessionId: data.sessionId,
        videoId: data.videoId,
        title: data.title,
        channel: data.channel,
        thumbnail: data.thumbnail,
        category: data.category,
        summary: data.summary ?? null,
        square_meta: data.summary?.square_meta,
        transcript: data.transcript,
        transcriptSource: data.transcriptSource,
        isPublic
      }))
      fetch('/api/embed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ docId: docId2, title: data.title, category: data.category, summary: data.summary, contextSummary: data.contextSummary }),
      }).catch(() => {})
      alert('저장되었습니다!')
      onClose()
    } catch (e) {
      console.error('Create and save error:', e)
      alert((e as Error).message || '저장에 실패했습니다. DB 연결을 확인해주세요.')
    } finally {
      setSaving(false)
    }
  }

  const handleAutoClassify = async () => {
    setClassifying(true)
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 10000)
      const res = await fetch('/api/folder-classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoTitle: data.title,
          tags: data.summary?.square_meta?.tags || [],
          existingFolders: folders.map(f => f.name)
        }),
        signal: controller.signal
      })
      clearTimeout(timeout)
      const result = await res.json()
      
      let targetFolderId = ''
      if (result.isNew || !folders.find(f => f.name === result.suggestedFolder)) {
        const uid = getLocalUserId()
        const newFolder = await withTimeout(createFolder(uid, result.suggestedFolder || '기타'))
        targetFolderId = newFolder.id
      } else {
        const existing = folders.find(f => f.name === result.suggestedFolder)
        if (existing) targetFolderId = existing.id
      }

      if (targetFolderId) {
        const uid = getLocalUserId()
        if (user) await upsertUserProfile({ uid: user.uid, displayName: user.displayName || '', photoURL: user.photoURL || '' })
        const docId3 = await withTimeout(saveSummary({
          userId: uid,
          userDisplayName: user?.displayName || '',
          userPhotoURL: user?.photoURL || '',
          folderId: targetFolderId,
          sessionId: data.sessionId,
          videoId: data.videoId,
          title: data.title,
          thumbnail: data.thumbnail,
          category: data.category,
          square_meta: data.summary?.square_meta,
          transcript: data.transcript,
          isPublic
        }))
        fetch('/api/embed', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ docId: docId3, title: data.title, category: data.category, summary: data.summary, contextSummary: data.contextSummary }),
        }).catch(() => {})
        alert('저장되었습니다!')
        onClose()
      }
    } catch (e) {
      console.error('Auto classify error:', e)
      alert((e as Error).message || '자동 분류 실패. 잠시 후 다시 시도해 주세요.')
    } finally {
      setClassifying(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setSigningIn(true)
    try {
      await signInWithGoogle()
      // sign-in popup closes; AuthProvider will update user state, modal stays open
    } catch {
      // user closed popup — stay on modal
    } finally {
      setSigningIn(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#23211f] border border-white/10 rounded-3xl w-full max-w-md p-6 flex flex-col gap-6 shadow-2xl">
        <h2 className="text-xl font-bold text-white text-center">라이브러리에 저장</h2>

        {/* 비회원: 로그인 유도 */}
        {!user && (
          <div className="flex flex-col items-center gap-5 py-4">
            <div className="text-5xl">📚</div>
            <div className="text-center space-y-1.5">
              <p className="text-white font-semibold">로그인 후 저장할 수 있어요</p>
              <p className="text-[#a4a09c] text-sm leading-relaxed">라이브러리에 저장하면 언제든지<br />다시 꺼내볼 수 있습니다.</p>
            </div>
            <button
              onClick={handleGoogleSignIn}
              disabled={signingIn}
              className="flex items-center gap-3 px-6 py-3 bg-white hover:bg-zinc-100 text-zinc-900 font-bold rounded-2xl transition-all disabled:opacity-50 w-full justify-center"
            >
              <svg width="20" height="20" viewBox="0 0 48 48" fill="none">
                <path d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.7 1.1 7.8 2.9L37.4 10C34.2 7.1 29.3 5 24 5 12.4 5 3 14.4 3 26s9.4 21 21 21c10.8 0 20-8.2 20-21 0-1.2-.1-2.4-.4-3.5z" fill="#FFC107"/>
                <path d="M6.3 15.7l6.6 4.8C14.7 17 19.1 14 24 14c3 0 5.7 1.1 7.8 2.9L37.4 12C34.2 9.1 29.3 7 24 7c-7.7 0-14.4 4-18.1 9.8l.4-.1z" fill="#FF3D00"/>
                <path d="M24 47c5.2 0 9.9-1.9 13.5-5L31 36.4C29 38 26.6 39 24 39c-5.3 0-9.7-3.3-11.3-8l-6.5 5.1C9.6 43.1 16.4 47 24 47z" fill="#4CAF50"/>
                <path d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.5l.1-.1 6.4 5.1c-.4.4 6.3-4.6 6.3-13.5 0-1.2-.1-2.4-.4-3.5z" fill="#1976D2"/>
              </svg>
              {signingIn ? '로그인 중...' : 'Google로 로그인'}
            </button>
            <Button variant="ghost" className="w-full text-zinc-500 hover:text-zinc-300 text-sm" onClick={onClose}>
              취소
            </Button>
          </div>
        )}

        {/* 로그인된 경우: 기존 저장 UI */}
        {user && (<>

        <div className="flex bg-[#32302e] rounded-xl p-1 relative border border-white/5">
          <button
            onClick={() => setIsPublic(false)}
            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${!isPublic ? 'bg-[#23211f] text-white shadow' : 'text-[#75716e] hover:text-white'}`}
          >
            🔒 비공개 (나만 보기)
          </button>
          <button
            onClick={() => setIsPublic(true)}
            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${isPublic ? 'bg-gradient-to-r from-orange-500 to-pink-500 text-white shadow' : 'text-[#75716e] hover:text-white'}`}
          >
            🌍 공개 (광장에 공유)
          </button>
        </div>

        <div className="space-y-4">
          <Button 
            className="w-full h-12 bg-white hover:bg-zinc-200 text-black font-bold rounded-xl flex items-center justify-center gap-2"
            onClick={handleAutoClassify}
            disabled={classifying || saving}
          >
            {classifying ? '분석 중...' : '✨ AI 자동 분류해서 저장'}
          </Button>
          
          <div className="relative">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-white/10"></span></div>
            <div className="relative flex justify-center text-xs uppercase"><span className="bg-[#23211f] px-2 text-[#75716e]">또는 수동 선택</span></div>
          </div>

          <div className="max-h-48 overflow-y-auto space-y-2">
            {loading ? (
              <p className="text-center text-sm text-[#75716e]">폴더 불러오는 중...</p>
            ) : folders.length > 0 ? (
              folders.map(f => (
                <Button 
                  key={f.id} 
                  variant="outline" 
                  className="w-full h-12 justify-start px-4 border-white/5 bg-[#32302e] hover:bg-[#3d3a38] hover:text-white text-[#a4a09c]"
                  onClick={() => handleSaveToFolder(f.id)}
                  disabled={saving}
                >
                  📁 {f.name}
                </Button>
              ))
            ) : (
              <p className="text-center text-sm text-[#75716e]">생성된 폴더가 없습니다.</p>
            )}
          </div>

          <div className="flex gap-2">
            <Input 
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="새 폴더 이름" 
              className="bg-[#32302e] border-none text-white h-12"
            />
            <Button 
              className="h-12 bg-zinc-700 text-white hover:bg-zinc-600"
              onClick={handleCreateAndSave}
              disabled={saving || !newFolderName.trim()}
            >
              만들고 저장
            </Button>
          </div>
        </div>

        <Button variant="ghost" className="w-full text-zinc-500 hover:text-zinc-300" onClick={onClose} disabled={saving}>
          취소
        </Button>
        </>)}
      </div>
    </div>
  )
}
