'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/providers/AuthProvider'
import { getLocalUserId } from '@/lib/user'
import { createRoom } from '@/lib/room'

interface Props {
  sessionId: string
  videoId: string
  title: string
  thumbnail: string
  onClose: () => void
}

export default function CreateRoomModal({ sessionId, videoId, title, thumbnail, onClose }: Props) {
  const router = useRouter()
  const { user } = useAuth()
  const [password, setPassword] = useState('')
  const [usePassword, setUsePassword] = useState(false)
  const [creating, setCreating] = useState(false)

  const handleCreate = async () => {
    setCreating(true)
    try {
      const uid = user?.uid || getLocalUserId()
      const name = user?.displayName || '익명'
      const photo = user?.photoURL || ''
      const roomId = await createRoom({
        sessionId, videoId, title, thumbnail,
        hostUid: uid,
        hostName: name,
        hostPhotoURL: photo,
        password: usePassword ? password : '',
      })
      onClose()
      router.push(`/room/${roomId}`)
    } catch {
      alert('방 생성에 실패했습니다.')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#252423] border border-white/10 rounded-3xl w-full max-w-md p-6 space-y-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-white font-bold text-lg">🎬 시청파티 만들기</h2>
          <button onClick={onClose} className="text-[#75716e] hover:text-white text-xl">✕</button>
        </div>

        {/* 영상 미리보기 */}
        <div className="flex items-center gap-3 bg-[#32302e] rounded-2xl p-3 border border-white/5">
          {thumbnail && (
            <img src={thumbnail} alt="" className="w-20 h-12 object-cover rounded-lg shrink-0" />
          )}
          <p className="text-white text-sm font-medium line-clamp-2">{title}</p>
        </div>

        {/* 비밀번호 설정 */}
        <div className="space-y-3">
          <label className="flex items-center gap-2.5 cursor-pointer">
            <div
              onClick={() => setUsePassword(v => !v)}
              className={`w-10 h-5 rounded-full transition-colors relative ${usePassword ? 'bg-orange-500' : 'bg-[#3d3a38]'}`}
            >
              <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${usePassword ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </div>
            <span className="text-[#a4a09c] text-sm">비밀번호로 방 잠금</span>
          </label>

          {usePassword && (
            <input
              type="text"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="비밀번호 입력 (숫자/문자 조합)"
              className="w-full h-10 px-3 bg-[#32302e] border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-orange-500/50"
            />
          )}
        </div>

        <div className="bg-[#1c1a18] rounded-2xl px-4 py-3 space-y-1 text-[11px] text-[#75716e]">
          <p>👑 방장만 영상 재생/일시정지/탐색 가능</p>
          <p>💬 실시간 채팅 + 이모지 반응</p>
          <p>📝 타임스탬프 메모 → 내 마이페이지 저장</p>
          <p>✋ 손들기로 질문 표시</p>
        </div>

        <div className="flex gap-2">
          <button onClick={onClose}
            className="flex-1 h-12 rounded-xl bg-[#32302e] text-[#a4a09c] hover:text-white text-sm transition-colors">
            취소
          </button>
          <button
            onClick={handleCreate}
            disabled={creating || (usePassword && !password.trim())}
            className="flex-1 h-12 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {creating ? (
              <><div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />생성 중...</>
            ) : '방 개설하기 🎬'}
          </button>
        </div>
      </div>
    </div>
  )
}
