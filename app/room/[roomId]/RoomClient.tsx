'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import YoutubePlayer from '@/components/player/YoutubePlayer'
import { useAuth } from '@/providers/AuthProvider'
import { getLocalUserId } from '@/lib/user'
import {
  getRoom, joinRoom, leaveRoom, closeRoom, syncPlayerState,
  setHandRaised, sendMessage, subscribeRoom, subscribeMessages,
  uploadRoomFile, uploadVoiceChunk, stopVoice,
  createPoll, votePoll, closePoll, subscribePolls,
  WatchRoom, RoomMessage, RoomPoll,
} from '@/lib/room'
import { addComment } from '@/lib/comments'

// ── 유틸 ──────────────────────────────────────────────────────────────────────
function secToTs(sec: number): string {
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

const EMOJIS = ['👍', '❤️', '😂', '😮', '🔥', '👏', '🤔', '💡']

// ── 플로팅 이모지 ──────────────────────────────────────────────────────────────
interface FloatingEmoji { id: string; emoji: string; x: number }
function EmojiOverlay({ items }: { items: FloatingEmoji[] }) {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {items.map(e => (
        <span
          key={e.id}
          className="absolute bottom-8 text-3xl animate-bounce-up select-none"
          style={{ left: `${e.x}%` }}
        >
          {e.emoji}
        </span>
      ))}
    </div>
  )
}

// ── 메인 컴포넌트 ──────────────────────────────────────────────────────────────
export default function RoomClient({ roomId, onClose }: { roomId: string; onClose?: () => void }) {
  const router = useRouter()
  const { user } = useAuth()
  const uid = user?.uid || getLocalUserId()
  const displayName = user?.displayName || '익명'
  const photoURL = user?.photoURL || ''

  const [room, setRoom] = useState<WatchRoom | null>(null)
  const [messages, setMessages] = useState<RoomMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [pwInput, setPwInput] = useState('')
  const [pwVerified, setPwVerified] = useState(false)
  const [joined, setJoined] = useState(false)

  const [chatInput, setChatInput] = useState('')
  const [sidebarTab, setSidebarTab] = useState<'chat' | 'participants' | 'polls'>('chat')
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [floatingEmojis, setFloatingEmojis] = useState<FloatingEmoji[]>([])

  // 노트 모달
  const [noteModal, setNoteModal] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [noteTs, setNoteTs] = useState('')
  const [noteSec, setNoteSec] = useState(0)

  // 🎙 음성 (방장)
  const [voiceActive, setVoiceActive] = useState(false)
  const [voiceLoading, setVoiceLoading] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const voiceChunkRef = useRef(0)
  const voiceStreamRef = useRef<MediaStream | null>(null)

  // 📎 파일 공유
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  // 📊 투표
  const [polls, setPolls] = useState<RoomPoll[]>([])
  const [showPollCreate, setShowPollCreate] = useState(false)
  const [pollQuestion, setPollQuestion] = useState('')
  const [pollOptions, setPollOptions] = useState(['', ''])

  const playerRef = useRef<YT.Player | null>(null)
  const chatBottomRef = useRef<HTMLDivElement>(null)
  const mobileChatBottomRef = useRef<HTMLDivElement>(null)
  const isSyncing = useRef(false)  // 참여자 동기화 무한루프 방지

  const isHost = room?.hostUid === uid

  // ── 방 로드 ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    getRoom(roomId).then(r => {
      if (!r) { setError('방을 찾을 수 없습니다.'); setLoading(false); return }
      setRoom(r)
      // 비밀번호 없거나 방장이면 바로 인증
      if (!r.password || r.hostUid === uid) setPwVerified(true)
      setLoading(false)
    }).catch((e) => {
      console.error('[Room] getRoom failed:', e)
      setError(`방 로드에 실패했습니다. (${(e as Error)?.message || String(e)})`)
      setLoading(false)
    })
  }, [roomId, uid])

  // ── 실시간 구독 (입장 후) ────────────────────────────────────────────────────
  useEffect(() => {
    if (!joined) return
    const unsub1 = subscribeRoom(roomId, r => {
      if (!r || (r as any).closed) { alert('방이 종료됐습니다.'); onClose ? onClose() : router.push('/'); return }
      setRoom(r)
      // 참여자: 호스트가 보낸 플레이어 상태 동기화
      if (!isHost && playerRef.current && !isSyncing.current) {
        const ps = r.playerState
        const elapsed = (Date.now() - ps.syncedAt) / 1000
        const target = ps.currentTime + (ps.playing ? elapsed : 0)
        const cur = playerRef.current.getCurrentTime?.() ?? 0
        if (Math.abs(cur - target) > 1.5) {
          isSyncing.current = true
          playerRef.current.seekTo(target, true)
          setTimeout(() => { isSyncing.current = false }, 1000)
        }
        ps.playing ? playerRef.current.playVideo() : playerRef.current.pauseVideo()
        playerRef.current.setPlaybackRate?.(ps.rate)
      }
    })
    const unsub2 = subscribeMessages(roomId, msgs => {
      setMessages(msgs)
      // 이모지 메시지 → 플로팅
      const last = msgs[msgs.length - 1]
      if (last?.type === 'emoji') {
        const fe: FloatingEmoji = { id: last.id, emoji: last.content, x: Math.random() * 80 + 5 }
        setFloatingEmojis(prev => [...prev, fe])
        setTimeout(() => setFloatingEmojis(prev => prev.filter(e => e.id !== fe.id)), 2500)
      }
    })
    const unsub3 = subscribePolls(roomId, setPolls)
    return () => { unsub1(); unsub2(); unsub3() }
  }, [joined, roomId, isHost])

  // ── 채팅 스크롤 ──────────────────────────────────────────────────────────────
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    mobileChatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── 입장 처리 ────────────────────────────────────────────────────────────────
  const handleJoin = async () => {
    if (!room) return
    if (room.password && room.password !== pwInput) { setError('비밀번호가 틀렸습니다.'); return }
    try {
      if (!room.participants?.[uid]) {
        await joinRoom(roomId, { uid, displayName, photoURL })
      }
      setJoined(true)
      setError('')
    } catch { setError('입장에 실패했습니다.') }
  }

  // ── 플레이어 콜백 ────────────────────────────────────────────────────────────
  const handlePlayerReady = useCallback((player: YT.Player) => {
    playerRef.current = player
  }, [])

  // 호스트: 플레이어 상태 변화 → Firestore 동기화
  const pushSync = useCallback(async (playing: boolean) => {
    if (!isHost || !playerRef.current) return
    const currentTime = playerRef.current.getCurrentTime?.() ?? 0
    const rate = playerRef.current.getPlaybackRate?.() ?? 1
    await syncPlayerState(roomId, { playing, currentTime, rate })
  }, [isHost, roomId])

  // ── 채팅 전송 ────────────────────────────────────────────────────────────────
  const handleSendChat = async () => {
    const text = chatInput.trim()
    if (!text) return
    setChatInput('')
    await sendMessage(roomId, { type: 'chat', uid, displayName, photoURL, content: text })
  }

  // ── 이모지 반응 ──────────────────────────────────────────────────────────────
  const handleEmoji = async (emoji: string) => {
    setShowEmojiPicker(false)
    await sendMessage(roomId, { type: 'emoji', uid, displayName, photoURL, content: emoji })
  }

  // ── 손들기 ───────────────────────────────────────────────────────────────────
  const myHandRaised = room?.participants?.[uid]?.handRaised ?? false
  const handleHand = async () => {
    await setHandRaised(roomId, uid, !myHandRaised)
  }

  // ── 🎙 음성 (방장 전용) ──────────────────────────────────────────────────────
  const startVoice = useCallback(async () => {
    if (!isHost) return
    setVoiceLoading(true)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      voiceStreamRef.current = stream
      voiceChunkRef.current = 0

      const rec = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' })
      mediaRecorderRef.current = rec

      rec.ondataavailable = async (e) => {
        if (e.data.size > 0) {
          const idx = voiceChunkRef.current++
          await uploadVoiceChunk(roomId, idx, e.data).catch(console.error)
        }
      }
      rec.start(3000)  // 3초 단위 청크
      setVoiceActive(true)
      await updateDoc_voice(true)
    } catch (err) {
      alert('마이크 접근 권한이 필요합니다.')
    } finally {
      setVoiceLoading(false)
    }
  }, [isHost, roomId])

  // updateDoc_voice는 lib/room에 있는 updateDoc 래퍼 대신 직접 처리
  const updateDoc_voice = async (active: boolean) => {
    const { db } = await import('@/lib/firebase')
    const { doc, updateDoc } = await import('firebase/firestore')
    await updateDoc(doc(db, 'watch_rooms', roomId), { 'voice.active': active })
  }

  const stopVoiceLocal = useCallback(async () => {
    mediaRecorderRef.current?.stop()
    voiceStreamRef.current?.getTracks().forEach(t => t.stop())
    mediaRecorderRef.current = null
    voiceStreamRef.current = null
    setVoiceActive(false)
    await stopVoice(roomId)
  }, [roomId])

  // 참여자: 음성 청크 재생
  const lastPlayedChunk = useRef(-1)
  useEffect(() => {
    if (!room || isHost) return
    const voice = (room as any).voice
    if (!voice?.active || !voice?.chunkUrl) return
    if (voice.chunkIndex <= lastPlayedChunk.current) return
    lastPlayedChunk.current = voice.chunkIndex
    const audio = new Audio(voice.chunkUrl)
    audio.play().catch(() => {})
  }, [room, isHost])

  // ── 📎 파일 공유 ──────────────────────────────────────────────────────────────
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 20 * 1024 * 1024) { alert('20MB 이하 파일만 업로드할 수 있습니다.'); return }
    setUploading(true)
    try {
      await uploadRoomFile(roomId, uid, displayName, photoURL, file)
    } catch { alert('파일 업로드에 실패했습니다.') }
    finally { setUploading(false); if (fileInputRef.current) fileInputRef.current.value = '' }
  }

  // ── 📊 투표 ───────────────────────────────────────────────────────────────────
  const handleCreatePoll = async () => {
    const opts = pollOptions.filter(o => o.trim())
    if (!pollQuestion.trim() || opts.length < 2) {
      alert('질문과 2개 이상의 선택지를 입력해주세요.'); return
    }
    await createPoll(roomId, pollQuestion.trim(), opts)
    setPollQuestion(''); setPollOptions(['', '']); setShowPollCreate(false)
    setSidebarTab('polls')
  }

  const handleVote = async (poll: RoomPoll, optionIdx: number) => {
    const prev = poll.votes[uid]
    if (prev === optionIdx) return  // 이미 동일 선택
    await votePoll(roomId, poll.id, uid, optionIdx, prev !== undefined ? prev : undefined)
  }

  // ── 메모 저장 ────────────────────────────────────────────────────────────────
  const openNoteModal = () => {
    const sec = playerRef.current?.getCurrentTime?.() ?? 0
    setNoteSec(Math.floor(sec))
    setNoteTs(secToTs(sec))
    setNoteText('')
    setNoteModal(true)
  }

  const handleSaveNote = async () => {
    if (!noteText.trim() || !room) return
    // 댓글로 저장 (마이페이지에서 볼 수 있도록)
    try {
      await addComment({
        sessionId: room.sessionId,
        userId: uid,
        userDisplayName: displayName,
        userPhotoURL: photoURL,
        text: `[시청파티 메모 @ ${noteTs}]\n${noteText}`,
        segmentId: `note-${noteSec}`,
        segmentLabel: `${noteTs} 메모`,
        parentId: null,
      })
      await sendMessage(roomId, {
        type: 'note', uid, displayName, photoURL,
        content: noteText, videoTs: noteTs, videoSec: noteSec,
      })
      setNoteModal(false)
      setNoteText('')
    } catch { alert('메모 저장에 실패했습니다.') }
  }

  // ── 나가기 ───────────────────────────────────────────────────────────────────
  const handleLeave = async () => {
    if (isHost) {
      if (!confirm('방을 종료하시겠습니까? 모든 참여자가 퇴장됩니다.')) return
      await closeRoom(roomId)
    } else {
      await leaveRoom(roomId, uid, displayName)
    }
    onClose ? onClose() : router.push('/')
  }

  // ── 렌더: 로딩 / 오류 ────────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen bg-[#1c1a18] flex items-center justify-center">
      <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-orange-500" />
    </div>
  )

  if (error && !room) return (
    <div className="min-h-screen bg-[#1c1a18] flex items-center justify-center text-white">
      <div className="text-center space-y-4">
        <p className="text-3xl">😢</p>
        <p>{error}</p>
        <button onClick={() => router.push('/')} className="text-orange-400 underline text-sm">홈으로</button>
      </div>
    </div>
  )

  // ── 렌더: 비밀번호 입력 ──────────────────────────────────────────────────────
  if (room && !joined) return (
    <div className="min-h-screen bg-[#1c1a18] flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-[#252423] rounded-3xl border border-white/10 p-7 space-y-5">
        <div className="text-center space-y-1">
          <p className="text-2xl">🎬</p>
          <h2 className="text-white font-bold text-lg">{room.title}</h2>
          <p className="text-[#75716e] text-sm">{room.hostName}님의 시청파티</p>
        </div>
        {room.password && (
          <div className="space-y-2">
            <label className="text-[#a4a09c] text-xs font-semibold">비밀번호</label>
            <input
              type="password"
              value={pwInput}
              onChange={e => setPwInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleJoin()}
              placeholder="비밀번호를 입력하세요"
              className="w-full h-10 px-3 bg-[#32302e] border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-orange-500/50"
            />
          </div>
        )}
        {error && <p className="text-red-400 text-xs text-center">{error}</p>}
        <button
          onClick={handleJoin}
          className="w-full h-12 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold transition-colors"
        >
          입장하기 →
        </button>
      </div>
    </div>
  )

  if (!room) return null

  const participants = Object.values(room.participants ?? {})
  const handRaisers = participants.filter(p => p.handRaised)

  // ── 렌더: 메인 룸 ────────────────────────────────────────────────────────────
  return (
    <div className={`${onClose ? 'fixed inset-0 z-[200]' : 'min-h-screen'} bg-[#1c1a18] text-white flex flex-col`}>
      {/* 상단 헤더 */}
      <div className="shrink-0 h-12 flex items-center gap-3 px-4 bg-[#1c1a18] border-b border-white/10 z-30">
        <span className="text-orange-500 font-black text-sm">NC</span>
        <span className="text-white/60 text-sm">|</span>
        <h1 className="text-white text-sm font-semibold truncate flex-1">{room.title}</h1>
        <span className="text-[#75716e] text-xs shrink-0">{participants.length}명 시청 중</span>

        {/* 초대 링크 */}
        <button
          onClick={() => {
            const inviteUrl = `${window.location.origin}/room/${roomId}`
            navigator.clipboard.writeText(inviteUrl)
            alert('초대 링크 복사됨!')
          }}
          className="shrink-0 px-3 h-8 rounded-lg bg-[#32302e] hover:bg-[#3d3a38] text-xs text-[#a4a09c] hover:text-white transition-colors flex items-center gap-1.5"
        >
          🔗 초대
        </button>

        {/* 나가기 */}
        <button
          onClick={handleLeave}
          className="shrink-0 px-3 h-8 rounded-lg bg-red-500/15 hover:bg-red-500/25 text-red-400 text-xs font-semibold transition-colors"
        >
          {isHost ? '방 종료' : '나가기'}
        </button>
      </div>

      {/* 손들기 알림 배너 */}
      {handRaisers.length > 0 && (
        <div className="shrink-0 bg-yellow-500/15 border-b border-yellow-500/20 px-4 py-2 flex items-center gap-2">
          <span className="text-lg">✋</span>
          <p className="text-yellow-300 text-xs">
            {handRaisers.map(p => p.displayName).join(', ')}님이 질문이 있어요
          </p>
        </div>
      )}

      {/* 메인 레이아웃 */}
      <div className="flex-1 flex overflow-hidden">

        {/* ── 왼쪽: 영상 영역 ── */}
        <div className="flex-1 flex flex-col overflow-y-auto">

          {/* 영상 플레이어 */}
          <div className="relative bg-black">
            <YoutubePlayer
              videoId={room.videoId}
              onPlayerReady={handlePlayerReady}
            />
            <EmojiOverlay items={floatingEmojis} />

            {/* 참여자 오버레이: 영상 제어 잠금 표시 */}
            {!isHost && (
              <div className="absolute bottom-2 left-2 px-2 py-1 rounded-md bg-black/60 text-[10px] text-white/50 pointer-events-none select-none">
                🔒 방장이 영상을 제어합니다
              </div>
            )}
          </div>

          {/* 호스트 컨트롤바 */}
          {isHost && (
            <div className="shrink-0 flex items-center gap-2 px-4 py-3 bg-[#252423] border-t border-white/5 flex-wrap">
              <button
                onClick={() => { playerRef.current?.playVideo(); pushSync(true) }}
                className="px-3 h-8 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold transition-colors"
              >▶ 재생</button>
              <button
                onClick={() => { playerRef.current?.pauseVideo(); pushSync(false) }}
                className="px-3 h-8 rounded-lg bg-[#32302e] hover:bg-[#3d3a38] text-white text-xs transition-colors"
              >⏸ 일시정지</button>
              {[0.5, 0.75, 1, 1.25, 1.5].map(r => (
                <button key={r}
                  onClick={() => { playerRef.current?.setPlaybackRate(r); pushSync(room.playerState.playing) }}
                  className="px-2 h-8 rounded-lg bg-[#32302e] hover:bg-[#3d3a38] text-[#a4a09c] hover:text-white text-xs transition-colors"
                >{r}x</button>
              ))}
              <span className="flex-1" />
              <span className="text-[#75716e] text-[10px]">🎙 방장 제어 중</span>
            </div>
          )}

          {/* 하단 액션 버튼 (모든 참여자) */}
          <div className="shrink-0 flex items-center gap-2 px-4 py-3 bg-[#1c1a18] border-t border-white/5 flex-wrap">

            {/* 이모지 반응 */}
            <div className="relative">
              <button
                onClick={() => setShowEmojiPicker(v => !v)}
                className="px-3 h-9 rounded-xl bg-[#32302e] hover:bg-[#3d3a38] text-sm transition-colors"
              >😀 반응</button>
              {showEmojiPicker && (
                <div className="absolute bottom-12 left-0 flex gap-1.5 bg-[#23211f] border border-white/10 rounded-2xl p-2 shadow-2xl z-20">
                  {EMOJIS.map(e => (
                    <button key={e} onClick={() => handleEmoji(e)}
                      className="text-2xl hover:scale-125 transition-transform"
                    >{e}</button>
                  ))}
                </div>
              )}
            </div>

            {/* 메모하기 */}
            <button
              onClick={openNoteModal}
              className="px-3 h-9 rounded-xl bg-[#32302e] hover:bg-[#3d3a38] text-xs text-[#a4a09c] hover:text-white transition-colors flex items-center gap-1.5"
            >
              📝 메모
            </button>

            {/* 파일 공유 */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="px-3 h-9 rounded-xl bg-[#32302e] hover:bg-[#3d3a38] text-xs text-[#a4a09c] hover:text-white transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              {uploading ? '업로드 중...' : '📎 파일'}
            </button>
            <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelect} />

            {/* 투표 생성 (방장만) */}
            {isHost && (
              <button
                onClick={() => setShowPollCreate(true)}
                className="px-3 h-9 rounded-xl bg-[#32302e] hover:bg-[#3d3a38] text-xs text-[#a4a09c] hover:text-white transition-colors flex items-center gap-1.5"
              >
                📊 투표
              </button>
            )}

            {/* 방장 음성 ON/OFF */}
            {isHost && (
              <button
                onClick={voiceActive ? stopVoiceLocal : startVoice}
                disabled={voiceLoading}
                className={`px-3 h-9 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                  voiceActive
                    ? 'bg-red-500/20 text-red-300 border border-red-500/30 animate-pulse'
                    : 'bg-[#32302e] hover:bg-[#3d3a38] text-[#a4a09c] hover:text-white'
                } disabled:opacity-50`}
              >
                🎙 {voiceLoading ? '연결 중...' : voiceActive ? '음성 OFF' : '음성 ON'}
              </button>
            )}

            {/* 참여자: 음성 수신 중 표시 */}
            {!isHost && (room as any)?.voice?.active && (
              <div className="px-3 h-9 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-xs flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                방장 음성 수신 중
              </div>
            )}

            {/* 손들기 */}
            <button
              onClick={handleHand}
              className={`px-3 h-9 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                myHandRaised
                  ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
                  : 'bg-[#32302e] hover:bg-[#3d3a38] text-[#a4a09c] hover:text-white'
              }`}
            >
              ✋ {myHandRaised ? '손 내리기' : '손들기'}
            </button>
          </div>

          {/* ── 모바일 채팅 (md 이상 사이드바로 대체) ── */}
          <div className="md:hidden flex flex-col border-t border-white/10">
            <div className="shrink-0 flex items-center gap-2 px-4 py-2 bg-[#252423] border-b border-white/10">
              <span className="text-xs font-semibold text-[#a4a09c]">💬 채팅</span>
              <span className="text-[10px] text-[#75716e]">{messages.filter(m => m.type === 'chat' || m.type === 'emoji' || m.type === 'note').length}개</span>
            </div>
            <div className="h-52 overflow-y-auto p-3 space-y-2 bg-[#252423]">
              {messages.map(msg => {
                if (msg.type === 'system') return (
                  <p key={msg.id} className="text-center text-[#75716e] text-[10px] py-1">{msg.content}</p>
                )
                if (msg.type === 'emoji') return (
                  <div key={msg.id} className="flex items-center gap-1.5">
                    <span className="text-[#75716e] text-[10px]">{msg.displayName}</span>
                    <span className="text-xl">{msg.content}</span>
                  </div>
                )
                if (msg.type === 'note') return (
                  <div key={msg.id} className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-2 space-y-0.5">
                    <p className="text-yellow-300 text-[10px] font-semibold">{msg.displayName} · 📝 {msg.videoTs} 메모</p>
                    <p className="text-white text-xs">{msg.content}</p>
                  </div>
                )
                if (msg.type === 'file') return (
                  <div key={msg.id} className="space-y-0.5">
                    <p className="text-[#75716e] text-[9px]">{msg.displayName}</p>
                    <a href={msg.fileUrl} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 px-3 py-2 bg-[#32302e] border border-white/10 rounded-xl transition-colors">
                      <span className="text-xl shrink-0">
                        {msg.fileType?.startsWith('image/') ? '🖼️' :
                         msg.fileType?.startsWith('video/') ? '🎬' :
                         msg.fileType === 'application/pdf' ? '📄' : '📎'}
                      </span>
                      <p className="text-white text-xs truncate">{msg.content}</p>
                    </a>
                  </div>
                )
                const isMe = msg.uid === uid
                return (
                  <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} gap-2`}>
                    {!isMe && (
                      <div className="w-6 h-6 rounded-full bg-[#3d3a38] shrink-0 mt-0.5 text-[10px] flex items-center justify-center">👤</div>
                    )}
                    <div className="max-w-[80%]">
                      {!isMe && <p className="text-[#75716e] text-[9px] mb-0.5">{msg.displayName}</p>}
                      <div className={`px-2.5 py-1.5 rounded-2xl text-xs leading-relaxed ${
                        isMe ? 'bg-orange-500 text-white rounded-br-sm' : 'bg-[#32302e] text-[#e8e4e0] rounded-bl-sm'
                      }`}>
                        {msg.content}
                      </div>
                    </div>
                  </div>
                )
              })}
              <div ref={mobileChatBottomRef} />
            </div>
            <div className="shrink-0 p-2 border-t border-white/10 bg-[#252423]">
              <div className="flex gap-2">
                <input
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendChat() } }}
                  placeholder="메시지 입력..."
                  className="flex-1 h-9 px-3 bg-[#32302e] border border-white/10 rounded-xl text-xs text-white placeholder:text-[#75716e] focus:outline-none focus:border-orange-500/50"
                />
                <button
                  onClick={handleSendChat}
                  disabled={!chatInput.trim()}
                  className="w-9 h-9 rounded-xl bg-orange-500 hover:bg-orange-600 text-white flex items-center justify-center disabled:opacity-40 transition-colors shrink-0"
                >
                  <svg className="w-3.5 h-3.5 rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── 오른쪽: 사이드바 ── */}
        <div className="w-72 shrink-0 flex flex-col border-l border-white/10 bg-[#252423] hidden md:flex">

          {/* 탭 */}
          <div className="shrink-0 flex border-b border-white/10">
            {([
              { id: 'chat', label: '💬 채팅' },
              { id: 'participants', label: `👥 ${participants.length}` },
              { id: 'polls', label: `📊 투표${polls.length > 0 ? ` ${polls.length}` : ''}` },
            ] as const).map(tab => (
              <button
                key={tab.id}
                onClick={() => setSidebarTab(tab.id)}
                className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${
                  sidebarTab === tab.id ? 'text-white border-b-2 border-orange-500' : 'text-[#75716e] hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* 채팅 탭 */}
          {sidebarTab === 'chat' && (
            <>
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {messages.map(msg => {
                  if (msg.type === 'system') return (
                    <p key={msg.id} className="text-center text-[#75716e] text-[10px] py-1">{msg.content}</p>
                  )
                  if (msg.type === 'emoji') return (
                    <div key={msg.id} className="flex items-center gap-1.5">
                      <span className="text-[#75716e] text-[10px]">{msg.displayName}</span>
                      <span className="text-xl">{msg.content}</span>
                    </div>
                  )
                  if (msg.type === 'note') return (
                    <div key={msg.id} className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-2 space-y-0.5">
                      <p className="text-yellow-300 text-[10px] font-semibold">{msg.displayName} · 📝 {msg.videoTs} 메모</p>
                      <p className="text-white text-xs">{msg.content}</p>
                    </div>
                  )
                  if (msg.type === 'file') return (
                    <div key={msg.id} className="space-y-0.5">
                      <p className="text-[#75716e] text-[9px]">{msg.displayName}</p>
                      <a
                        href={msg.fileUrl} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 px-3 py-2 bg-[#32302e] border border-white/10 hover:border-orange-500/40 rounded-xl transition-colors group"
                      >
                        <span className="text-xl shrink-0">
                          {msg.fileType?.startsWith('image/') ? '🖼️' :
                           msg.fileType?.startsWith('video/') ? '🎬' :
                           msg.fileType === 'application/pdf' ? '📄' : '📎'}
                        </span>
                        <div className="min-w-0">
                          <p className="text-white text-xs truncate group-hover:text-orange-400">{msg.content}</p>
                          <p className="text-[#75716e] text-[9px]">
                            {msg.fileSize ? `${(msg.fileSize / 1024).toFixed(0)}KB` : ''}
                          </p>
                        </div>
                      </a>
                    </div>
                  )
                  const isMe = msg.uid === uid
                  return (
                    <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} gap-2`}>
                      {!isMe && (
                        msg.photoURL
                          ? <img src={msg.photoURL} className="w-6 h-6 rounded-full shrink-0 mt-0.5" alt="" />
                          : <div className="w-6 h-6 rounded-full bg-[#3d3a38] shrink-0 mt-0.5 text-[10px] flex items-center justify-center">👤</div>
                      )}
                      <div className="max-w-[80%]">
                        {!isMe && <p className="text-[#75716e] text-[9px] mb-0.5">{msg.displayName}</p>}
                        <div className={`px-2.5 py-1.5 rounded-2xl text-xs leading-relaxed ${
                          isMe ? 'bg-orange-500 text-white rounded-br-sm' : 'bg-[#32302e] text-[#e8e4e0] rounded-bl-sm'
                        }`}>
                          {msg.content}
                        </div>
                      </div>
                    </div>
                  )
                })}
                <div ref={chatBottomRef} />
              </div>
              <div className="shrink-0 p-2 border-t border-white/10">
                <div className="flex gap-2">
                  <input
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendChat() } }}
                    placeholder="메시지 입력..."
                    className="flex-1 h-9 px-3 bg-[#32302e] border border-white/10 rounded-xl text-xs text-white placeholder:text-[#75716e] focus:outline-none focus:border-orange-500/50"
                  />
                  <button
                    onClick={handleSendChat}
                    disabled={!chatInput.trim()}
                    className="w-9 h-9 rounded-xl bg-orange-500 hover:bg-orange-600 text-white flex items-center justify-center disabled:opacity-40 transition-colors shrink-0"
                  >
                    <svg className="w-3.5 h-3.5 rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  </button>
                </div>
              </div>
            </>
          )}

          {/* 투표 탭 */}
          {sidebarTab === 'polls' && (
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {polls.length === 0 && (
                <p className="text-[#75716e] text-xs text-center pt-4">
                  {isHost ? '📊 아래 버튼으로 투표를 만들어보세요' : '아직 투표가 없습니다'}
                </p>
              )}
              {polls.map(poll => {
                const total = poll.results.reduce((a, b) => a + b, 0)
                const myVote = poll.votes[uid]
                return (
                  <div key={poll.id} className={`rounded-2xl border p-3 space-y-2 ${poll.closed ? 'border-white/5 bg-[#1c1a18]' : 'border-orange-500/20 bg-orange-500/5'}`}>
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-white text-xs font-semibold leading-snug">{poll.question}</p>
                      {isHost && !poll.closed && (
                        <button onClick={() => closePoll(roomId, poll.id)}
                          className="shrink-0 text-[10px] text-[#75716e] hover:text-red-400 transition-colors">
                          종료
                        </button>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      {poll.options.map((opt, i) => {
                        const pct = total > 0 ? Math.round((poll.results[i] / total) * 100) : 0
                        const isMyVote = myVote === i
                        return (
                          <button key={i}
                            onClick={() => !poll.closed && handleVote(poll, i)}
                            disabled={poll.closed}
                            className={`w-full text-left rounded-xl overflow-hidden transition-colors relative ${
                              isMyVote ? 'ring-1 ring-orange-500' : ''
                            } ${poll.closed ? 'cursor-default' : 'hover:ring-1 hover:ring-white/20'}`}
                          >
                            <div className="absolute inset-0 bg-orange-500/20 transition-all"
                              style={{ width: `${pct}%` }} />
                            <div className="relative flex items-center justify-between px-2.5 py-1.5">
                              <span className="text-xs text-white">{opt} {isMyVote && '✓'}</span>
                              <span className="text-[10px] text-[#a4a09c]">{pct}% ({poll.results[i]})</span>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                    <p className="text-[#75716e] text-[9px]">
                      {poll.closed ? '✅ 종료됨' : `총 ${total}표`}
                    </p>
                  </div>
                )
              })}
            </div>
          )}

          {/* 참여자 탭 */}
          {sidebarTab === 'participants' && (
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {participants
                .sort((a, b) => (b.uid === room.hostUid ? 1 : 0) - (a.uid === room.hostUid ? 1 : 0))
                .map(p => (
                  <div key={p.uid} className="flex items-center gap-2.5 px-2 py-2 rounded-xl hover:bg-[#32302e] transition-colors">
                    {p.photoURL
                      ? <img src={p.photoURL} className="w-8 h-8 rounded-full" alt="" />
                      : <div className="w-8 h-8 rounded-full bg-[#3d3a38] flex items-center justify-center text-sm">👤</div>
                    }
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-xs font-medium truncate">{p.displayName}</p>
                      {p.uid === room.hostUid && <span className="text-orange-400 text-[9px]">👑 방장</span>}
                    </div>
                    {p.handRaised && <span className="text-yellow-400 text-base animate-bounce" title="손 든 상태">✋</span>}
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* 투표 생성 모달 (방장) */}
      {showPollCreate && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#252423] border border-white/10 rounded-3xl w-full max-w-sm p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-white font-bold">📊 투표 만들기</h3>
              <button onClick={() => setShowPollCreate(false)} className="text-[#75716e] hover:text-white">✕</button>
            </div>
            <input
              value={pollQuestion}
              onChange={e => setPollQuestion(e.target.value)}
              placeholder="투표 질문을 입력하세요"
              className="w-full h-10 px-3 bg-[#32302e] border border-white/10 rounded-xl text-sm text-white placeholder:text-[#75716e] focus:outline-none focus:border-orange-500/50"
            />
            <div className="space-y-2">
              <p className="text-[#75716e] text-xs">선택지 (최소 2개)</p>
              {pollOptions.map((opt, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    value={opt}
                    onChange={e => setPollOptions(prev => prev.map((o, j) => j === i ? e.target.value : o))}
                    placeholder={`선택지 ${i + 1}`}
                    className="flex-1 h-9 px-3 bg-[#32302e] border border-white/10 rounded-xl text-sm text-white placeholder:text-[#75716e] focus:outline-none focus:border-orange-500/50"
                  />
                  {pollOptions.length > 2 && (
                    <button onClick={() => setPollOptions(prev => prev.filter((_, j) => j !== i))}
                      className="text-[#75716e] hover:text-red-400 px-2 transition-colors">✕</button>
                  )}
                </div>
              ))}
              {pollOptions.length < 5 && (
                <button onClick={() => setPollOptions(prev => [...prev, ''])}
                  className="text-orange-400 text-xs hover:text-orange-300 transition-colors">
                  + 선택지 추가
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowPollCreate(false)}
                className="flex-1 h-11 rounded-xl bg-[#32302e] text-[#a4a09c] text-sm hover:text-white transition-colors">
                취소
              </button>
              <button onClick={handleCreatePoll}
                disabled={!pollQuestion.trim() || pollOptions.filter(o => o.trim()).length < 2}
                className="flex-1 h-11 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm disabled:opacity-50 transition-colors">
                투표 시작
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 메모 모달 */}
      {noteModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#252423] border border-white/10 rounded-3xl w-full max-w-sm p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-white font-bold">📝 타임스탬프 메모</h3>
              <button onClick={() => setNoteModal(false)} className="text-[#75716e] hover:text-white">✕</button>
            </div>
            <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl px-3 py-2">
              <p className="text-orange-400 text-xs font-semibold">⏱ {noteTs} 시점</p>
              <p className="text-[#75716e] text-[10px] mt-0.5">내 마이페이지에도 저장됩니다</p>
            </div>
            <textarea
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              placeholder="이 구간에 대한 메모를 입력하세요..."
              rows={4}
              className="w-full bg-[#32302e] border border-white/10 rounded-xl p-3 text-sm text-white placeholder:text-[#75716e] focus:outline-none focus:border-orange-500/50 resize-none"
            />
            <div className="flex gap-2">
              <button onClick={() => setNoteModal(false)}
                className="flex-1 h-11 rounded-xl bg-[#32302e] text-[#a4a09c] text-sm hover:text-white transition-colors">
                취소
              </button>
              <button onClick={handleSaveNote} disabled={!noteText.trim()}
                className="flex-1 h-11 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm disabled:opacity-50 transition-colors">
                저장하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
