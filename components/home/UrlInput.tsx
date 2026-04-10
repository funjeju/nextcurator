'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import LoadingSteps from './LoadingSteps'
import RecentHistory from './RecentHistory'
import { useAuth } from '@/providers/AuthProvider'

const CATEGORIES = [
  { id: 'auto',    icon: '✨', label: '자동 분류' },
  { id: 'recipe',  icon: '🍳', label: '요리' },
  { id: 'english', icon: '🔤', label: '영어' },
  { id: 'learning',icon: '📐', label: '학습' },
  { id: 'news',    icon: '🗞️', label: '뉴스' },
  { id: 'selfdev', icon: '💪', label: '자기계발' },
  { id: 'travel',  icon: '🧳', label: '여행' },
  { id: 'story',   icon: '🍿', label: '스토리' },
  { id: 'tips',    icon: '💡', label: '팁' },
]

const GUEST_STORAGE_KEY = 'nextcurator_guest_usage'

function getGuestUsage(): number {
  try { return JSON.parse(localStorage.getItem(GUEST_STORAGE_KEY) || '0') }
  catch { return 0 }
}

function incrementGuestUsage() {
  try { localStorage.setItem(GUEST_STORAGE_KEY, String(getGuestUsage() + 1)) }
  catch {}
}

type ModalType = 'guest_info' | 'guest_limit_duration' | 'guest_limit_count' | null

export default function UrlInput() {
  const { user, signInWithGoogle } = useAuth()
  const [url, setUrl] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('auto')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [step, setStep] = useState(0)
  const [modal, setModal] = useState<ModalType>(null)
  const [checkingDuration, setCheckingDuration] = useState(false)
  const router = useRouter()

  // PDF 업로드 처리
  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    setError('')
    setLoading(true)
    setStep(2)
    try {
      const formData = new FormData()
      formData.append('file', file)
      if (selectedCategory !== 'auto') formData.append('category', selectedCategory)

      setStep(3)
      const res = await fetch('/api/summarize-pdf', { method: 'POST', body: formData })
      setStep(4)
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'PDF 처리 실패') }
      const data = await res.json()
      setStep(5)

      sessionStorage.setItem(`summary_${data.sessionId}`, JSON.stringify(data))
      router.push(`/result/${data.sessionId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'PDF 처리 중 오류가 발생했습니다.')
      setLoading(false)
      setStep(0)
    }
  }

  // 실제 요약 실행
  const runSummarize = async () => {
    setError('')
    setLoading(true)
    setStep(1)
    try {
      setStep(2)
      const res = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, category: selectedCategory === 'auto' ? undefined : selectedCategory }),
      })
      setStep(3)
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || '오류가 발생했습니다.') }
      setStep(4)
      const data = await res.json()
      setStep(5)

      // 비회원이면 사용 횟수 기록
      if (!user) incrementGuestUsage()

      sessionStorage.setItem(`summary_${data.sessionId}`, JSON.stringify(data))
      try {
        const historyJson = localStorage.getItem('nextcurator_history')
        const history = historyJson ? JSON.parse(historyJson) : []
        const filteredHistory = history.filter((item: any) => item.sessionId !== data.sessionId)
        filteredHistory.unshift({ sessionId: data.sessionId, videoId: data.videoId, title: data.title, thumbnail: data.thumbnail, category: data.category, date: new Date().toISOString() })
        localStorage.setItem('nextcurator_history', JSON.stringify(filteredHistory))
      } catch {}

      router.push(`/result/${data.sessionId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다.')
      setLoading(false)
      setStep(0)
    }
  }

  // Start Now 클릭
  const handleSubmit = async () => {
    if (!url.trim()) return

    // 로그인 유저 → 바로 실행
    if (user) { runSummarize(); return }

    // 비회원: 이미 1번 이상 사용했는지 확인
    const usageCount = getGuestUsage()
    if (usageCount >= 1) { setModal('guest_limit_count'); return }

    // 비회원: 영상 길이 확인
    setCheckingDuration(true)
    try {
      const res = await fetch(`/api/video-duration?url=${encodeURIComponent(url)}`)
      const { allowed, durationSeconds } = await res.json()
      if (!allowed && durationSeconds > 600) {
        setModal('guest_limit_duration')
        return
      }
    } catch {
      // duration 확인 실패 시 진행 허용
    } finally {
      setCheckingDuration(false)
    }

    // 비회원 안내 팝업 표시
    setModal('guest_info')
  }

  if (loading) return <LoadingSteps currentStep={step} />

  return (
    <>
      <div className="flex flex-col items-start gap-6 w-full max-w-2xl bg-[#32302e]/80 backdrop-blur-3xl px-4 py-6 md:p-10 rounded-[32px] border border-white/5 shadow-2xl">
        <RecentHistory />

        {/* URL 입력 */}
        <div className="flex flex-col gap-4 w-full">
          <label className="text-[#e8e6e3] text-[15px] font-semibold tracking-wide flex items-center gap-2">
            영상 주소 입력 <span className="text-orange-400">⚡</span>
          </label>
          <div className="relative group flex flex-col md:flex-row gap-3">
            <div className="flex flex-1 gap-2">
              <Input
                placeholder="YouTube, 웹페이지 URL 입력..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                className="flex-1 h-[56px] text-base pl-5 pr-4 bg-[#23211f] border-none text-white placeholder:text-[#75716e] rounded-[20px] focus-visible:ring-1 focus-visible:ring-orange-500/50 shadow-inner transition-all duration-300"
              />
              {/* PDF 업로드 버튼 */}
              <label
                className="shrink-0 h-[56px] w-[56px] flex items-center justify-center rounded-[20px] bg-[#23211f] hover:bg-[#2e2c2a] border border-white/5 hover:border-white/20 cursor-pointer transition-all text-[#75716e] hover:text-white"
                title="PDF 업로드"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <input
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={handlePdfUpload}
                />
              </label>
            </div>
            <Button
              variant="default"
              onClick={handleSubmit}
              disabled={!url.trim() || checkingDuration}
              className="h-[56px] md:w-[140px] text-base font-bold tracking-wide rounded-[20px] transition-all duration-300
                         bg-white text-black hover:bg-[#e2e2e2] hover:scale-[1.02] active:scale-[0.98]
                         disabled:bg-white/10 disabled:text-white/30 disabled:cursor-not-allowed disabled:transform-none"
            >
              {checkingDuration ? '확인 중...' : 'Start Now'}
            </Button>
          </div>
          {error && (
            <div className="flex items-center gap-2 bg-[#2a1d1c] border border-red-500/20 rounded-2xl px-5 py-4">
              <span className="text-red-400 text-sm font-medium">⚠️ {error}</span>
            </div>
          )}
        </div>

        {/* 카테고리 선택 */}
        <div className="flex flex-col gap-3 w-full">
          <div className="flex items-center justify-between w-full">
            <p className="text-[#75716e] text-sm font-medium">분석 모드 선택</p>
            {(() => {
              const auto = CATEGORIES[0]
              const isSelected = selectedCategory === auto.id
              return (
                <Badge variant="outline" onClick={() => setSelectedCategory(auto.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-[14px] text-xs font-medium cursor-pointer transition-all duration-300 group ${
                    isSelected ? 'border-transparent bg-white text-black' : 'border-transparent bg-[#23211f] text-[#a4a09c] hover:bg-[#3d3a38] hover:text-white'
                  }`}
                >
                  <span className={`text-sm transition-transform ${isSelected ? 'scale-110' : 'group-hover:scale-110'}`}>{auto.icon}</span>
                  <span>{auto.label}</span>
                </Badge>
              )
            })()}
          </div>
          <div className="grid grid-cols-3 md:flex md:flex-wrap gap-2 w-full">
            {CATEGORIES.slice(1).map((cat) => {
              const isSelected = selectedCategory === cat.id
              return (
                <Badge key={cat.id} variant="outline" onClick={() => setSelectedCategory(cat.id)}
                  className={`flex items-center justify-center gap-1.5 px-2 py-2 md:px-5 md:py-2.5 rounded-[14px] text-xs md:text-sm font-medium cursor-pointer transition-all duration-300 group ${
                    isSelected ? 'border-transparent bg-white text-black' : 'border-transparent bg-[#23211f] text-[#a4a09c] hover:bg-[#3d3a38] hover:text-white'
                  }`}
                >
                  <span className={`text-sm transition-transform ${isSelected ? 'scale-110' : 'group-hover:scale-110'}`}>{cat.icon}</span>
                  <span className="tracking-wide truncate">{cat.label}</span>
                </Badge>
              )
            })}
          </div>
        </div>
      </div>

      {/* 모달들 */}
      {modal && (
        <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#23211f] border border-white/10 rounded-3xl w-full max-w-sm p-7 flex flex-col gap-5 shadow-2xl">

            {/* 비회원 무료 이용 안내 */}
            {modal === 'guest_info' && (
              <>
                <div className="text-center">
                  <div className="text-4xl mb-3">🎬</div>
                  <h2 className="text-lg font-bold text-white mb-2">비회원 무료 체험</h2>
                  <p className="text-[#a4a09c] text-sm leading-relaxed">
                    비회원은 <span className="text-white font-semibold">10분 미만</span> 영상 <span className="text-white font-semibold">1개</span>를 무료로 요약할 수 있습니다.
                  </p>
                </div>
                <div className="bg-[#32302e] rounded-2xl p-4 text-xs text-[#75716e] space-y-1.5">
                  <p>✅ 10분 미만 영상 1개 무료</p>
                  <p>✅ 모든 카테고리 분석 가능</p>
                  <p>🔒 추가 요약은 회원가입 필요</p>
                  <p>🔒 라이브러리 저장은 회원가입 필요</p>
                </div>
                <div className="flex flex-col gap-2">
                  <Button
                    className="w-full h-12 bg-white text-black font-bold rounded-2xl hover:bg-zinc-200"
                    onClick={() => { setModal(null); runSummarize() }}
                  >
                    무료로 요약하기
                  </Button>
                  <button
                    onClick={() => { setModal(null); signInWithGoogle() }}
                    className="w-full h-12 bg-gradient-to-r from-orange-500 to-pink-500 text-white font-bold rounded-2xl text-sm hover:opacity-90 transition-opacity"
                  >
                    Google로 회원가입 (무제한)
                  </button>
                  <button onClick={() => setModal(null)} className="text-[#75716e] text-sm hover:text-white transition-colors py-1">
                    닫기
                  </button>
                </div>
              </>
            )}

            {/* 10분 초과 제한 */}
            {modal === 'guest_limit_duration' && (
              <>
                <div className="text-center">
                  <div className="text-4xl mb-3">⏱️</div>
                  <h2 className="text-lg font-bold text-white mb-2">10분 이상 영상</h2>
                  <p className="text-[#a4a09c] text-sm leading-relaxed">
                    비회원은 <span className="text-white font-semibold">10분 미만</span> 영상만 요약할 수 있습니다.<br />
                    회원가입하면 길이 제한 없이 이용 가능합니다.
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => { setModal(null); signInWithGoogle() }}
                    className="w-full h-12 bg-gradient-to-r from-orange-500 to-pink-500 text-white font-bold rounded-2xl text-sm hover:opacity-90 transition-opacity"
                  >
                    Google로 회원가입하기
                  </button>
                  <button onClick={() => setModal(null)} className="text-[#75716e] text-sm hover:text-white transition-colors py-1">
                    닫기
                  </button>
                </div>
              </>
            )}

            {/* 사용 횟수 초과 */}
            {modal === 'guest_limit_count' && (
              <>
                <div className="text-center">
                  <div className="text-4xl mb-3">🔒</div>
                  <h2 className="text-lg font-bold text-white mb-2">무료 체험 완료</h2>
                  <p className="text-[#a4a09c] text-sm leading-relaxed">
                    비회원 무료 요약 1회를 이미 사용했습니다.<br />
                    회원가입하면 <span className="text-white font-semibold">무제한</span>으로 이용할 수 있습니다.
                  </p>
                </div>
                <div className="bg-[#32302e] rounded-2xl p-4 text-xs text-[#75716e] space-y-1.5">
                  <p>🎬 영상 길이 제한 없음</p>
                  <p>📚 라이브러리 무제한 저장</p>
                  <p>🌍 광장에 요약 공유</p>
                  <p>✉️ 다른 사용자와 쪽지</p>
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => { setModal(null); signInWithGoogle() }}
                    className="w-full h-12 bg-gradient-to-r from-orange-500 to-pink-500 text-white font-bold rounded-2xl text-sm hover:opacity-90 transition-opacity"
                  >
                    Google로 무료 회원가입
                  </button>
                  <button onClick={() => setModal(null)} className="text-[#75716e] text-sm hover:text-white transition-colors py-1">
                    닫기
                  </button>
                </div>
              </>
            )}

          </div>
        </div>
      )}
    </>
  )
}
