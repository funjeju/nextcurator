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
  const { user } = useAuth()
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
      await withTimeout(saveSummary({
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
        summary: data.summary,
        square_meta: data.summary?.square_meta,
        transcript: data.transcript,
        transcriptSource: data.transcriptSource,
        isPublic
      }))
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
      await withTimeout(saveSummary({
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
        summary: data.summary,
        square_meta: data.summary?.square_meta,
        transcript: data.transcript,
        transcriptSource: data.transcriptSource,
        isPublic
      }))
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
        await withTimeout(saveSummary({
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

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#23211f] border border-white/10 rounded-3xl w-full max-w-md p-6 flex flex-col gap-6 shadow-2xl">
        <h2 className="text-xl font-bold text-white text-center">라이브러리에 저장</h2>

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
      </div>
    </div>
  )
}
