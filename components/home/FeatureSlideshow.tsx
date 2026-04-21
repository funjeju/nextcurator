'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

const FEATURES = [
  {
    emoji: '🍳',
    headline: '요리 중에 손 안 대고 "다음 단계"만 외치세요',
    subline: '요리 영상을 레시피 카드로 자동 정리',
    href: '/guide/summary/recipe',
    color: 'from-orange-500/20 to-amber-500/10',
    accent: 'text-orange-400',
  },
  {
    emoji: '📋',
    headline: 'Watch Later 500개, 하룻밤에 다 정리',
    subline: 'YouTube 재생목록 AI 일괄 요약',
    href: '/guide/import',
    color: 'from-red-500/20 to-rose-500/10',
    accent: 'text-red-400',
  },
  {
    emoji: '✍️',
    headline: '유튜브 본 걸 블로그 글로 10분 만에',
    subline: '영상 → SEO 최적화 블로그 초안 자동 생성',
    href: '/guide/blog',
    color: 'from-violet-500/20 to-purple-500/10',
    accent: 'text-violet-400',
  },
  {
    emoji: '🔤',
    headline: '영어 영상, 레벨별 워크시트로 자동 변환',
    subline: '영어 유튜브를 CEFR 기반 학습 자료로',
    href: '/guide/summary/english',
    color: 'from-blue-500/20 to-sky-500/10',
    accent: 'text-blue-400',
  },
  {
    emoji: '🗞️',
    headline: '뉴스 10개, 5분 안에 핵심만 브리핑',
    subline: '뉴스·경제 영상을 5W1H로 정리',
    href: '/guide/summary/news',
    color: 'from-slate-500/20 to-zinc-500/10',
    accent: 'text-slate-300',
  },
  {
    emoji: '🎬',
    headline: '롱폼에서 바이럴 포인트 뽑아 숏츠 대본으로',
    subline: '유튜브 영상 → 숏폼 스크립트 자동 추출',
    href: '/guide/shorts',
    color: 'from-pink-500/20 to-fuchsia-500/10',
    accent: 'text-pink-400',
  },
  {
    emoji: '🧳',
    headline: '여행 vlog 속 스팟을 AI가 일정표로',
    subline: '여행 영상에서 장소·팁·일정 자동 추출',
    href: '/guide/summary/travel',
    color: 'from-emerald-500/20 to-teal-500/10',
    accent: 'text-emerald-400',
  },
  {
    emoji: '🔍',
    headline: '"저번에 본 동치미 영상 어디 갔지?"',
    subline: 'AI 대화로 내 라이브러리 검색',
    href: '/guide/search',
    color: 'from-cyan-500/20 to-sky-500/10',
    accent: 'text-cyan-400',
  },
  {
    emoji: '🌐',
    headline: '같은 영상, 다른 시청자의 해석까지 한눈에',
    subline: '스퀘어에서 요약 공유 · 발견',
    href: '/guide/square',
    color: 'from-amber-500/20 to-yellow-500/10',
    accent: 'text-amber-400',
  },
  {
    emoji: '🎓',
    headline: '선생님, 유튜브 영상이 워크시트가 됩니다',
    subline: '클래스룸으로 학생 학습 관리',
    href: '/guide/classroom',
    color: 'from-lime-500/20 to-green-500/10',
    accent: 'text-lime-400',
  },
]

export default function FeatureSlideshow() {
  const [current, setCurrent] = useState(0)
  const [animating, setAnimating] = useState(false)

  const goTo = useCallback((idx: number) => {
    if (animating) return
    setAnimating(true)
    setTimeout(() => {
      setCurrent(idx)
      setAnimating(false)
    }, 200)
  }, [animating])

  const next = useCallback(() => goTo((current + 1) % FEATURES.length), [current, goTo])
  const prev = useCallback(() => goTo((current - 1 + FEATURES.length) % FEATURES.length), [current, goTo])

  useEffect(() => {
    const t = setInterval(next, 4000)
    return () => clearInterval(t)
  }, [next])

  const f = FEATURES[current]

  return (
    <div className="w-full flex flex-col items-center gap-3">
      {/* 슬라이드 카드 */}
      <Link
        href={f.href}
        className={`w-full max-w-2xl bg-gradient-to-br ${f.color} border border-white/8 rounded-2xl px-6 py-5 flex items-center gap-4 transition-all duration-300 hover:border-white/20 hover:scale-[1.01] group ${animating ? 'opacity-0 translate-y-1' : 'opacity-100 translate-y-0'}`}
        style={{ transition: 'opacity 0.2s, transform 0.2s' }}
      >
        <span className="text-3xl shrink-0">{f.emoji}</span>
        <div className="flex-1 min-w-0">
          <p className={`font-bold text-sm md:text-base text-white leading-snug group-hover:${f.accent} transition-colors`}>
            {f.headline}
          </p>
          <p className="text-[#75716e] text-xs mt-0.5 truncate">{f.subline}</p>
        </div>
        <svg className={`w-4 h-4 shrink-0 ${f.accent} opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </Link>

      {/* 컨트롤 */}
      <div className="flex items-center gap-3">
        <button onClick={prev} className="text-[#4a4745] hover:text-white transition-colors p-1">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex items-center gap-1.5">
          {FEATURES.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className={`rounded-full transition-all ${i === current ? 'w-4 h-1.5 bg-white' : 'w-1.5 h-1.5 bg-white/20 hover:bg-white/40'}`}
            />
          ))}
        </div>
        <button onClick={next} className="text-[#4a4745] hover:text-white transition-colors p-1">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
        <Link href="/guide" className="text-[10px] text-[#4a4745] hover:text-white transition-colors ml-1">
          전체 기능 →
        </Link>
      </div>
    </div>
  )
}
