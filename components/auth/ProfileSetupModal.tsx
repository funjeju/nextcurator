'use client'

import { useState } from 'react'
import { useAuth } from '@/providers/AuthProvider'
import { completeUserProfile, PROFILE_COMPLETE_TOKENS, AgeGroup, Gender } from '@/lib/db'

const AGE_GROUPS: { value: AgeGroup; label: string; emoji: string }[] = [
  { value: '10s',  label: '10대', emoji: '🎒' },
  { value: '20s',  label: '20대', emoji: '🎓' },
  { value: '30s',  label: '30대', emoji: '💼' },
  { value: '40s',  label: '40대', emoji: '🏡' },
  { value: '50s',  label: '50대', emoji: '⚡' },
  { value: '60s+', label: '60대 이상', emoji: '🌿' },
]

const GENDERS: { value: Gender; label: string; emoji: string }[] = [
  { value: 'male',         label: '남성',      emoji: '👨' },
  { value: 'female',       label: '여성',      emoji: '👩' },
  { value: 'other',        label: '기타',      emoji: '🌈' },
  { value: 'prefer_not',   label: '공개 안 함', emoji: '🔒' },
]

const INTEREST_CATS = [
  { id: 'recipe',  label: '🍳 요리',    desc: '레시피·음식' },
  { id: 'english', label: '🔤 영어',    desc: '영어 학습' },
  { id: 'learning',label: '📐 학습',    desc: '강의·지식' },
  { id: 'news',    label: '🗞️ 뉴스',   desc: '시사·정보' },
  { id: 'selfdev', label: '💪 자기계발', desc: '동기·심리' },
  { id: 'travel',  label: '🧳 여행',    desc: '여행·장소' },
  { id: 'story',   label: '🍿 스토리',  desc: '드라마·예능' },
  { id: 'tips',    label: '💡 팁',      desc: '생활꿀팁' },
]

type Step = 'age' | 'gender' | 'interests' | 'done'

export default function ProfileSetupModal() {
  const { user, userProfile, needsProfile, refreshProfile } = useAuth()
  const [step, setStep]           = useState<Step>('age')
  const [dismissed, setDismissed] = useState(false)
  const [ageGroup, setAgeGroup]   = useState<AgeGroup | null>(null)
  const [gender, setGender]       = useState<Gender | null>(null)
  const [interests, setInterests] = useState<string[]>([])
  const [saving, setSaving]       = useState(false)
  const [tokensEarned, setTokensEarned] = useState(0)

  if (!user || !needsProfile || dismissed) return null

  const stepIndex = step === 'age' ? 0 : step === 'gender' ? 1 : step === 'interests' ? 2 : 3
  const totalSteps = 3

  const toggleInterest = (id: string) => {
    setInterests(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  const handleComplete = async () => {
    if (!ageGroup || !gender) return
    setSaving(true)
    try {
      const { tokensAwarded } = await completeUserProfile(user.uid, {
        ageGroup,
        gender,
        interests,
      })
      setTokensEarned(tokensAwarded)
      setStep('done')
      await refreshProfile()
    } catch (e) {
      console.error('Profile save failed:', e)
      alert('저장에 실패했습니다. 다시 시도해주세요.')
    } finally {
      setSaving(false)
    }
  }

  const handleSkip = () => {
    setDismissed(true)
  }

  return (
    <div className="fixed inset-0 z-[300] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#23211f] border border-white/10 rounded-[28px] w-full max-w-md shadow-2xl overflow-hidden">

        {/* 진행 바 */}
        {step !== 'done' && (
          <div className="h-1 bg-[#32302e]">
            <div
              className="h-full bg-gradient-to-r from-orange-500 to-pink-500 transition-all duration-500"
              style={{ width: `${((stepIndex) / totalSteps) * 100}%` }}
            />
          </div>
        )}

        <div className="p-7">

          {/* ── Step 1: 연령대 ── */}
          {step === 'age' && (
            <>
              <div className="mb-6">
                <p className="text-[#75716e] text-xs font-medium mb-1">STEP 1 / {totalSteps}</p>
                <h2 className="text-xl font-bold text-white mb-1">
                  안녕하세요, {user.displayName?.split(' ')[0]}님! 👋
                </h2>
                <p className="text-[#a4a09c] text-sm leading-relaxed">
                  맞춤 콘텐츠 추천을 위해 연령대를 알려주세요.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-6">
                {AGE_GROUPS.map(ag => (
                  <button
                    key={ag.value}
                    onClick={() => setAgeGroup(ag.value)}
                    className={`flex flex-col items-center gap-1.5 py-3 rounded-2xl border transition-all ${
                      ageGroup === ag.value
                        ? 'border-orange-500 bg-orange-500/15 text-white'
                        : 'border-white/10 bg-[#32302e] text-[#a4a09c] hover:border-white/20 hover:text-white'
                    }`}
                  >
                    <span className="text-xl">{ag.emoji}</span>
                    <span className="text-xs font-semibold">{ag.label}</span>
                  </button>
                ))}
              </div>

              <div className="flex flex-col gap-2">
                <button
                  onClick={() => ageGroup && setStep('gender')}
                  disabled={!ageGroup}
                  className="w-full h-12 bg-white text-black font-bold rounded-2xl hover:bg-zinc-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  다음
                </button>
                <button onClick={handleSkip} className="text-[#75716e] text-sm hover:text-white transition-colors py-1">
                  나중에 하기
                </button>
              </div>
            </>
          )}

          {/* ── Step 2: 성별 ── */}
          {step === 'gender' && (
            <>
              <div className="mb-6">
                <p className="text-[#75716e] text-xs font-medium mb-1">STEP 2 / {totalSteps}</p>
                <h2 className="text-xl font-bold text-white mb-1">성별을 선택해주세요</h2>
                <p className="text-[#a4a09c] text-sm">광고 및 콘텐츠 추천에 활용됩니다.</p>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-6">
                {GENDERS.map(g => (
                  <button
                    key={g.value}
                    onClick={() => setGender(g.value)}
                    className={`flex items-center gap-3 px-4 py-4 rounded-2xl border transition-all ${
                      gender === g.value
                        ? 'border-orange-500 bg-orange-500/15 text-white'
                        : 'border-white/10 bg-[#32302e] text-[#a4a09c] hover:border-white/20 hover:text-white'
                    }`}
                  >
                    <span className="text-2xl">{g.emoji}</span>
                    <span className="text-sm font-semibold">{g.label}</span>
                  </button>
                ))}
              </div>

              <div className="flex flex-col gap-2">
                <button
                  onClick={() => gender && setStep('interests')}
                  disabled={!gender}
                  className="w-full h-12 bg-white text-black font-bold rounded-2xl hover:bg-zinc-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  다음
                </button>
                <button onClick={() => setStep('age')} className="text-[#75716e] text-sm hover:text-white transition-colors py-1">
                  이전으로
                </button>
              </div>
            </>
          )}

          {/* ── Step 3: 관심 카테고리 ── */}
          {step === 'interests' && (
            <>
              <div className="mb-6">
                <p className="text-[#75716e] text-xs font-medium mb-1">STEP 3 / {totalSteps}</p>
                <h2 className="text-xl font-bold text-white mb-1">관심 있는 분야를 골라주세요</h2>
                <p className="text-[#a4a09c] text-sm">여러 개 선택 가능 · 언제든 변경할 수 있어요</p>
              </div>

              <div className="grid grid-cols-2 gap-2 mb-3">
                {INTEREST_CATS.map(cat => {
                  const selected = interests.includes(cat.id)
                  return (
                    <button
                      key={cat.id}
                      onClick={() => toggleInterest(cat.id)}
                      className={`flex items-center gap-2.5 px-3 py-3 rounded-xl border transition-all text-left ${
                        selected
                          ? 'border-orange-500 bg-orange-500/15 text-white'
                          : 'border-white/10 bg-[#32302e] text-[#a4a09c] hover:border-white/20 hover:text-white'
                      }`}
                    >
                      <span className="text-lg">{cat.label.split(' ')[0]}</span>
                      <div>
                        <p className="text-xs font-semibold leading-tight">{cat.label.split(' ').slice(1).join(' ')}</p>
                        <p className="text-[10px] text-[#75716e] leading-tight">{cat.desc}</p>
                      </div>
                      {selected && (
                        <span className="ml-auto text-orange-400 text-xs">✓</span>
                      )}
                    </button>
                  )
                })}
              </div>

              {/* 보상 예고 */}
              <div className="bg-gradient-to-r from-orange-500/10 to-pink-500/10 border border-orange-500/20 rounded-2xl px-4 py-3 mb-4 flex items-center gap-3">
                <span className="text-2xl">🎁</span>
                <div>
                  <p className="text-white text-xs font-bold">완성하면 {PROFILE_COMPLETE_TOKENS} 토큰 지급!</p>
                  <p className="text-[#a4a09c] text-[10px]">향후 프리미엄 기능에 사용 가능</p>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <button
                  onClick={handleComplete}
                  disabled={saving}
                  className="w-full h-12 bg-gradient-to-r from-orange-500 to-pink-500 text-white font-bold rounded-2xl hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                      저장 중...
                    </>
                  ) : (
                    '프로필 완성하기'
                  )}
                </button>
                <button onClick={() => setStep('gender')} className="text-[#75716e] text-sm hover:text-white transition-colors py-1">
                  이전으로
                </button>
              </div>
            </>
          )}

          {/* ── Done: 보상 화면 ── */}
          {step === 'done' && (
            <div className="text-center py-2">
              <div className="text-6xl mb-4 animate-bounce">🎉</div>
              <h2 className="text-2xl font-bold text-white mb-2">프로필 완성!</h2>
              <p className="text-[#a4a09c] text-sm mb-6 leading-relaxed">
                Next Curator를 더 스마트하게 쓸 수 있게 됐어요.
              </p>

              {/* 토큰 지급 카드 */}
              <div className="bg-gradient-to-br from-orange-500/20 to-pink-500/20 border border-orange-500/30 rounded-2xl p-5 mb-6">
                <p className="text-[#a4a09c] text-xs mb-1">지급된 보상</p>
                <div className="flex items-center justify-center gap-2">
                  <span className="text-3xl">🪙</span>
                  <span className="text-4xl font-black text-white">+{tokensEarned}</span>
                  <span className="text-xl text-[#a4a09c] font-bold">토큰</span>
                </div>
                <p className="text-[#75716e] text-xs mt-2">
                  현재 잔액: {(userProfile?.tokens ?? 0) + tokensEarned}개
                </p>
              </div>

              <div className="bg-[#32302e] rounded-2xl p-4 mb-6 text-left space-y-2">
                <p className="text-white text-xs font-bold mb-2">🚀 토큰으로 이용할 수 있는 기능 (출시 예정)</p>
                <p className="text-[#75716e] text-xs flex items-center gap-2">
                  <span className="text-orange-400">⚡</span> 30분 이상 영상 요약
                </p>
                <p className="text-[#75716e] text-xs flex items-center gap-2">
                  <span className="text-orange-400">⚡</span> AI 챗봇 무제한 대화
                </p>
                <p className="text-[#75716e] text-xs flex items-center gap-2">
                  <span className="text-orange-400">⚡</span> 요약 카드 PDF 내보내기
                </p>
              </div>

              <button
                onClick={() => setDismissed(true)}
                className="w-full h-12 bg-white text-black font-bold rounded-2xl hover:bg-zinc-200 transition-colors"
              >
                시작하기
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
