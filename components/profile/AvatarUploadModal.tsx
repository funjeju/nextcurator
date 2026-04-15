'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import { updateProfile } from 'firebase/auth'
import { storage, auth } from '@/lib/firebase'
import { updateUserPhotoURL } from '@/lib/db'

const SIZE = 280  // 크롭 캔버스 크기

export default function AvatarUploadModal({
  userId,
  onClose,
  onSuccess,
}: {
  userId: string
  onClose: () => void
  onSuccess: (url: string) => void
}) {
  const [imgSrc, setImgSrc] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const offsetRef = useRef({ x: 0, y: 0 })
  const zoomRef = useRef(1)
  const dragRef = useRef({ active: false, sx: 0, sy: 0, ox: 0, oy: 0 })

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const img = imgRef.current
    if (!canvas || !img) return
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, SIZE, SIZE)

    // 이미지 그리기
    ctx.drawImage(img, offsetRef.current.x, offsetRef.current.y,
      img.naturalWidth * zoomRef.current, img.naturalHeight * zoomRef.current)

    // 원 바깥 어둡게
    ctx.save()
    ctx.fillStyle = 'rgba(0,0,0,0.6)'
    ctx.fillRect(0, 0, SIZE, SIZE)
    ctx.globalCompositeOperation = 'destination-out'
    ctx.beginPath()
    ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2 - 2, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()

    // 원 테두리
    ctx.strokeStyle = 'rgba(249,115,22,0.8)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2 - 2, 0, Math.PI * 2)
    ctx.stroke()
  }, [])

  const initImage = useCallback((img: HTMLImageElement) => {
    const scale = Math.max(SIZE / img.naturalWidth, SIZE / img.naturalHeight)
    zoomRef.current = scale
    setZoom(scale)
    offsetRef.current = {
      x: (SIZE - img.naturalWidth * scale) / 2,
      y: (SIZE - img.naturalHeight * scale) / 2,
    }
    requestAnimationFrame(draw)
  }, [draw])

  useEffect(() => {
    if (!imgSrc) return
    const img = new Image()
    img.onload = () => { imgRef.current = img; initImage(img) }
    img.src = imgSrc
  }, [imgSrc, initImage])

  // 줌 변경
  const handleZoom = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = parseFloat(e.target.value)
    const cx = SIZE / 2 - offsetRef.current.x
    const cy = SIZE / 2 - offsetRef.current.y
    const ratio = next / zoomRef.current
    offsetRef.current = { x: SIZE / 2 - cx * ratio, y: SIZE / 2 - cy * ratio }
    zoomRef.current = next
    setZoom(next)
    requestAnimationFrame(draw)
  }

  // 드래그 (마우스)
  const onMouseDown = (e: React.MouseEvent) => {
    dragRef.current = { active: true, sx: e.clientX, sy: e.clientY, ox: offsetRef.current.x, oy: offsetRef.current.y }
  }
  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragRef.current.active) return
    offsetRef.current = { x: dragRef.current.ox + e.clientX - dragRef.current.sx, y: dragRef.current.oy + e.clientY - dragRef.current.sy }
    requestAnimationFrame(draw)
  }
  const onDragEnd = () => { dragRef.current.active = false }

  // 드래그 (터치)
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0]
    dragRef.current = { active: true, sx: t.clientX, sy: t.clientY, ox: offsetRef.current.x, oy: offsetRef.current.y }
  }
  const onTouchMove = (e: React.TouchEvent) => {
    if (!dragRef.current.active) return
    const t = e.touches[0]
    offsetRef.current = { x: dragRef.current.ox + t.clientX - dragRef.current.sx, y: dragRef.current.oy + t.clientY - dragRef.current.sy }
    requestAnimationFrame(draw)
  }

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 3 * 1024 * 1024) { setError('파일 크기는 3MB 이하여야 합니다.'); return }
    if (!file.type.startsWith('image/')) { setError('이미지 파일만 업로드할 수 있습니다.'); return }
    setError('')
    const reader = new FileReader()
    reader.onload = ev => setImgSrc(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  const handleUpload = async () => {
    const img = imgRef.current
    if (!img) return
    setUploading(true)
    setError('')
    try {
      // 원형 크롭 캔버스 생성
      const out = document.createElement('canvas')
      out.width = SIZE; out.height = SIZE
      const ctx = out.getContext('2d')!
      ctx.beginPath()
      ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2, 0, Math.PI * 2)
      ctx.clip()
      ctx.drawImage(img, offsetRef.current.x, offsetRef.current.y,
        img.naturalWidth * zoomRef.current, img.naturalHeight * zoomRef.current)

      const blob = await new Promise<Blob>((res, rej) =>
        out.toBlob(b => b ? res(b) : rej(new Error('변환 실패')), 'image/jpeg', 0.92))

      // Firebase Storage 업로드
      const sRef = storageRef(storage, `profile-images/${userId}`)
      await uploadBytes(sRef, blob, { contentType: 'image/jpeg' })
      const url = await getDownloadURL(sRef)

      // Firebase Auth + Firestore 업데이트
      if (auth.currentUser) await updateProfile(auth.currentUser, { photoURL: url })
      await updateUserPhotoURL(userId, url)

      onSuccess(url)
    } catch (e: any) {
      setError('업로드 실패: ' + (e.message || '다시 시도해주세요.'))
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#1c1a18] rounded-3xl border border-white/10 shadow-2xl p-6 w-full max-w-sm">
        <button onClick={onClose} className="absolute top-4 right-4 text-[#75716e] hover:text-white text-xl leading-none">✕</button>
        <h2 className="text-lg font-bold text-white mb-5 text-center">📷 프로필 사진 변경</h2>

        {!imgSrc ? (
          <>
            <label className="block cursor-pointer">
              <div className="border-2 border-dashed border-white/20 hover:border-orange-500/50 rounded-2xl p-10 text-center transition-colors">
                <p className="text-5xl mb-3">🖼️</p>
                <p className="text-white font-semibold text-sm">이미지 클릭하여 선택</p>
                <p className="text-[#75716e] text-xs mt-1.5">JPG · PNG · GIF · 최대 3MB</p>
              </div>
              <input type="file" accept="image/*" className="hidden" onChange={handleFile} />
            </label>
            {error && <p className="text-red-400 text-xs text-center mt-3">{error}</p>}
          </>
        ) : (
          <div className="flex flex-col items-center gap-4">
            {/* 원형 크롭 영역 */}
            <canvas
              ref={canvasRef}
              width={SIZE}
              height={SIZE}
              className="cursor-grab active:cursor-grabbing touch-none rounded-full"
              style={{ width: SIZE, height: SIZE }}
              onMouseDown={onMouseDown}
              onMouseMove={onMouseMove}
              onMouseUp={onDragEnd}
              onMouseLeave={onDragEnd}
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onDragEnd}
            />
            <p className="text-[#75716e] text-xs">드래그로 위치 · 슬라이더로 크기 조정</p>

            {/* 줌 슬라이더 */}
            <div className="w-full flex items-center gap-3">
              <span className="text-sm text-[#75716e]">🔍−</span>
              <input
                type="range"
                min={0.3}
                max={4}
                step={0.01}
                value={zoom}
                onChange={handleZoom}
                className="flex-1 accent-orange-500"
              />
              <span className="text-sm text-[#75716e]">🔍+</span>
            </div>

            {error && <p className="text-red-400 text-xs text-center">{error}</p>}

            <div className="flex gap-3 w-full pt-1">
              <button
                onClick={() => { setImgSrc(null); setError('') }}
                className="flex-1 py-3 bg-[#2a2826] hover:bg-[#32302e] text-[#a4a09c] font-semibold rounded-2xl text-sm transition-colors"
              >
                다시 선택
              </button>
              <button
                onClick={handleUpload}
                disabled={uploading}
                className="flex-1 py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-2xl text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {uploading ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    업로드 중...
                  </>
                ) : '완료'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
