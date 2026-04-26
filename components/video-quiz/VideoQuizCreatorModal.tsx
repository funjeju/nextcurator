'use client'

import { useState, useRef } from 'react'
import { VideoQuizType, addVideoQuiz, uploadQuizImage, secsToLabel } from '@/lib/videoQuiz'

interface Props {
  userId: string
  sessionId: string
  videoId: string
  videoTitle: string
  thumbnail: string
  channel: string
  timestampSec: number
  onClose: () => void
  onSaved: () => void
}

const TYPE_TABS: { id: VideoQuizType; label: string; emoji: string }[] = [
  { id: 'ox', label: 'OX 퀴즈', emoji: '⭕' },
  { id: 'multiple_choice', label: '객관식', emoji: '📋' },
  { id: 'short_answer', label: '주관식', emoji: '✏️' },
]

export default function VideoQuizCreatorModal({
  userId, sessionId, videoId, videoTitle, thumbnail, channel,
  timestampSec, onClose, onSaved,
}: Props) {
  const [quizType, setQuizType] = useState<VideoQuizType>('ox')
  const [question, setQuestion] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  // OX
  const [oxAnswer, setOxAnswer] = useState<'O' | 'X' | null>(null)
  const [oxExplanation, setOxExplanation] = useState('')
  // 객관식
  const [options, setOptions] = useState(['', '', '', ''])
  const [correctOptionIndex, setCorrectOptionIndex] = useState<number | null>(null)
  // 주관식
  const [sampleAnswer, setSampleAnswer] = useState('')

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { setError('이미지는 5MB 이하만 가능합니다.'); return }
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
    setError('')
  }

  const handleOptionChange = (i: number, val: string) => {
    setOptions(prev => prev.map((o, idx) => idx === i ? val : o))
  }

  const validate = (): boolean => {
    if (!question.trim()) { setError('문제를 입력해주세요.'); return false }
    if (quizType === 'ox' && !oxAnswer) { setError('정답(O/X)을 선택해주세요.'); return false }
    if (quizType === 'multiple_choice') {
      const filled = options.filter(o => o.trim())
      if (filled.length < 2) { setError('보기를 최소 2개 이상 입력해주세요.'); return false }
      if (correctOptionIndex === null) { setError('정답 번호를 선택해주세요.'); return false }
      if (!options[correctOptionIndex]?.trim()) { setError('선택한 정답 번호의 보기가 비어있습니다.'); return false }
    }
    return true
  }

  const handleSave = async () => {
    if (!validate()) return
    setSaving(true)
    setError('')
    try {
      let imageUrl: string | undefined
      if (imageFile) {
        console.log('[QuizSave] 이미지 업로드 시작', { userId, fileName: imageFile.name, size: imageFile.size })
        imageUrl = await uploadQuizImage(userId, imageFile)
        console.log('[QuizSave] 이미지 업로드 완료', imageUrl)
      }

      const base = {
        videoId, sessionId, videoTitle, thumbnail, channel,
        timestampSec,
        timestampLabel: secsToLabel(timestampSec),
        quizType,
        question: question.trim(),
        imageUrl,
      }

      console.log('[QuizSave] Firestore 저장 시작', { quizType, userId })
      if (quizType === 'ox') {
        await addVideoQuiz(userId, {
          ...base,
          oxAnswer: oxAnswer!,
          oxExplanation: oxExplanation.trim() || undefined,
        })
      } else if (quizType === 'multiple_choice') {
        const filteredOptions = options.map(o => o.trim())
        await addVideoQuiz(userId, {
          ...base,
          options: filteredOptions,
          correctOptionIndex: correctOptionIndex!,
        })
      } else {
        await addVideoQuiz(userId, {
          ...base,
          sampleAnswer: sampleAnswer.trim() || undefined,
        })
      }
      console.log('[QuizSave] Firestore 저장 완료')

      onSaved()
      onClose()
    } catch (e) {
      console.error('[QuizSave] 저장 실패:', e)
      setError('저장에 실패했습니다. 다시 시도해주세요.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-[#23211f] border border-white/10 rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md flex flex-col shadow-2xl max-h-[90vh] overflow-hidden">

        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 shrink-0">
          <div>
            <p className="text-white font-bold text-base">퀴즈 추가</p>
            <p className="text-[#75716e] text-xs mt-0.5">📍 {secsToLabel(timestampSec)} 지점</p>
          </div>
          <button onClick={onClose} className="text-[#75716e] hover:text-white transition-colors text-xl leading-none">✕</button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 flex flex-col gap-4">

          {/* 퀴즈 타입 선택 */}
          <div className="flex gap-2">
            {TYPE_TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => { setQuizType(tab.id); setError('') }}
                className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${
                  quizType === tab.id
                    ? 'bg-orange-500/20 border-orange-500/50 text-orange-300'
                    : 'bg-[#32302e] border-white/10 text-[#75716e] hover:text-white'
                }`}
              >
                <span className="block text-base mb-0.5">{tab.emoji}</span>
                {tab.label}
              </button>
            ))}
          </div>

          {/* 문제 입력 */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-[#75716e] font-medium">문제</label>
            <textarea
              value={question}
              onChange={e => setQuestion(e.target.value)}
              placeholder="문제를 입력하세요"
              rows={3}
              className="w-full bg-[#32302e] border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder:text-[#4a4845] focus:outline-none focus:border-orange-500/50 resize-none"
            />
          </div>

          {/* 이미지 첨부 */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-[#75716e] font-medium">이미지 첨부 (선택)</label>
            {imagePreview ? (
              <div className="relative">
                <img src={imagePreview} alt="미리보기" className="w-full max-h-40 object-cover rounded-xl border border-white/10" />
                <button
                  onClick={() => { setImageFile(null); setImagePreview(null) }}
                  className="absolute top-2 right-2 bg-black/60 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-black/80 transition-colors"
                >✕</button>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-3 bg-[#32302e] border border-dashed border-white/20 rounded-xl text-[#75716e] text-sm hover:border-orange-500/40 hover:text-orange-400 transition-colors"
              >
                📷 이미지 선택
              </button>
            )}
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleImageChange} />
          </div>

          {/* OX 퀴즈 */}
          {quizType === 'ox' && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-[#75716e] font-medium">정답</label>
                <div className="flex gap-3">
                  {(['O', 'X'] as const).map(v => (
                    <button
                      key={v}
                      onClick={() => setOxAnswer(v)}
                      className={`flex-1 py-4 rounded-2xl text-3xl font-black border-2 transition-all ${
                        oxAnswer === v
                          ? v === 'O'
                            ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                            : 'bg-red-500/20 border-red-500 text-red-300'
                          : 'bg-[#32302e] border-white/10 text-[#75716e] hover:border-white/30'
                      }`}
                    >{v}</button>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-[#75716e] font-medium">해설 (선택)</label>
                <textarea
                  value={oxExplanation}
                  onChange={e => setOxExplanation(e.target.value)}
                  placeholder="정답 해설을 입력하세요"
                  rows={2}
                  className="w-full bg-[#32302e] border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder:text-[#4a4845] focus:outline-none focus:border-orange-500/50 resize-none"
                />
              </div>
            </div>
          )}

          {/* 객관식 */}
          {quizType === 'multiple_choice' && (
            <div className="flex flex-col gap-3">
              <label className="text-xs text-[#75716e] font-medium">보기 입력 (최소 2개)</label>
              {options.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <button
                    onClick={() => setCorrectOptionIndex(i)}
                    className={`w-8 h-8 rounded-full border-2 text-xs font-black shrink-0 transition-all ${
                      correctOptionIndex === i
                        ? 'bg-orange-500 border-orange-500 text-white'
                        : 'bg-[#32302e] border-white/20 text-[#75716e] hover:border-orange-500/50'
                    }`}
                  >{['①', '②', '③', '④'][i]}</button>
                  <input
                    value={opt}
                    onChange={e => handleOptionChange(i, e.target.value)}
                    placeholder={`보기 ${i + 1}${i < 2 ? ' (필수)' : ' (선택)'}`}
                    className="flex-1 bg-[#32302e] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-[#4a4845] focus:outline-none focus:border-orange-500/50"
                  />
                </div>
              ))}
              {correctOptionIndex !== null && (
                <p className="text-xs text-orange-400">✓ {['①', '②', '③', '④'][correctOptionIndex]} 번이 정답으로 설정됨</p>
              )}
            </div>
          )}

          {/* 주관식 */}
          {quizType === 'short_answer' && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-[#75716e] font-medium">모범 답안 (선택)</label>
              <textarea
                value={sampleAnswer}
                onChange={e => setSampleAnswer(e.target.value)}
                placeholder="모범 답안을 입력하면 학습자에게 참고로 보여집니다"
                rows={3}
                className="w-full bg-[#32302e] border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder:text-[#4a4845] focus:outline-none focus:border-orange-500/50 resize-none"
              />
            </div>
          )}

          {error && <p className="text-red-400 text-xs">{error}</p>}
        </div>

        {/* 저장 버튼 */}
        <div className="px-5 py-4 border-t border-white/5 shrink-0">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-3 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-bold rounded-2xl text-sm transition-colors"
          >
            {saving ? '저장 중...' : '퀴즈 저장하기'}
          </button>
        </div>
      </div>
    </div>
  )
}
