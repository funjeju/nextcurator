'use client'

import { useState } from 'react'

interface ContactModalProps {
  onClose: () => void
}

const TYPE_OPTIONS = [
  { id: 'bug',        label: '🐛 버그 신고',  desc: '오류나 이상 동작을 알려주세요' },
  { id: 'suggestion', label: '💡 제안',        desc: '기능 개선 아이디어가 있으신가요?' },
  { id: 'partnership',label: '🤝 제휴 문의',  desc: '비즈니스 협업 제안' },
]

export default function ContactModal({ onClose }: ContactModalProps) {
  const [type, setType] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!type || !message.trim()) { setError('유형과 내용을 입력해주세요.'); return }
    setSending(true)
    setError('')
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, email: email.trim(), message: message.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '전송 실패')
      setDone(true)
    } catch (err: any) {
      setError(err.message || '전송에 실패했습니다. 다시 시도해주세요.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-[#1c1a18] rounded-3xl border border-white/10 shadow-2xl p-6">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[#75716e] hover:text-white transition-colors text-xl leading-none"
        >✕</button>

        {done ? (
          /* 전송 완료 */
          <div className="text-center py-6">
            <div className="text-5xl mb-4">✅</div>
            <h2 className="text-lg font-bold text-white mb-2">전송 완료!</h2>
            <p className="text-[#a4a09c] text-sm leading-relaxed">
              소중한 의견 감사합니다.<br/>확인 후 빠르게 답변드리겠습니다.
            </p>
            <button
              onClick={onClose}
              className="mt-6 px-6 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold rounded-xl transition-colors"
            >
              닫기
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="mb-5">
              <h2 className="text-lg font-bold text-white mb-0.5">문의하기</h2>
              <p className="text-[#75716e] text-xs">버그 신고, 제안, 제휴 문의를 보내주세요.</p>
            </div>

            {/* 유형 선택 */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              {TYPE_OPTIONS.map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setType(opt.id)}
                  className={`flex flex-col items-center gap-1 px-2 py-3 rounded-2xl border text-center transition-all ${
                    type === opt.id
                      ? 'border-orange-500/60 bg-orange-500/10 text-white'
                      : 'border-white/10 bg-[#2a2826] text-[#a4a09c] hover:border-white/20 hover:text-white'
                  }`}
                >
                  <span className="text-lg leading-none">{opt.label.split(' ')[0]}</span>
                  <span className="text-[11px] font-semibold leading-tight">{opt.label.split(' ').slice(1).join(' ')}</span>
                </button>
              ))}
            </div>
            {type && (
              <p className="text-[#75716e] text-xs mb-4 -mt-2 px-1">
                {TYPE_OPTIONS.find(o => o.id === type)?.desc}
              </p>
            )}

            {/* 이메일 */}
            <div className="mb-3">
              <label className="block text-xs text-[#75716e] mb-1.5">
                이메일 <span className="text-[#4a4745]">(답변 받으실 경우 입력)</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="example@email.com"
                className="w-full bg-[#2a2826] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-[#4a4745] focus:outline-none focus:border-orange-500/50 transition-colors"
              />
            </div>

            {/* 내용 */}
            <div className="mb-4">
              <label className="block text-xs text-[#75716e] mb-1.5">
                내용 <span className="text-orange-400">*</span>
              </label>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="자세히 적어주실수록 빠른 처리가 가능합니다."
                rows={4}
                className="w-full bg-[#2a2826] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-[#4a4745] focus:outline-none focus:border-orange-500/50 transition-colors resize-none"
              />
            </div>

            {error && <p className="text-red-400 text-xs mb-3">{error}</p>}

            <button
              type="submit"
              disabled={sending || !type || !message.trim()}
              className="w-full py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-[#3a3836] disabled:text-[#75716e] text-white font-bold rounded-2xl text-sm transition-colors flex items-center justify-center gap-2"
            >
              {sending ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  전송 중...
                </>
              ) : '보내기'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
