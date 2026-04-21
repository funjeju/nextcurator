'use client'

/**
 * 카테고리 컨텍스트 광고 배너
 *
 * AdSense는 광고 초기화 시점에 DOM 전체를 스캔해 컨텍스트를 결정한다.
 * 이 컴포넌트는 광고 슬롯 바로 위에 카테고리 관련 visible 텍스트를 배치해
 * 구글이 올바른 카테고리 광고(요리 → 요리, 여행 → 여행)를 서빙하도록 유도한다.
 */

import { useEffect, useRef } from 'react'

const CLIENT   = process.env.NEXT_PUBLIC_ADSENSE_CLIENT
const SLOT_MID = process.env.NEXT_PUBLIC_ADSENSE_SLOT_RESULT_MID    || ''
const SLOT_BOT = process.env.NEXT_PUBLIC_ADSENSE_SLOT_RESULT_BOTTOM || ''

interface CategoryMeta {
  label: string
  emoji: string
  contextText: string   // AdSense가 읽을 visible 카테고리 키워드
}

const CATEGORY_META: Record<string, CategoryMeta> = {
  recipe:  { label: '요리 & 주방',         emoji: '🍳', contextText: '요리 레시피 식재료 조리도구 주방용품 요리법 음식 쿠킹' },
  travel:  { label: '여행 & 숙소',          emoji: '🧳', contextText: '여행 숙소 호텔 항공 관광 투어 여행지 예약 해외여행' },
  selfdev: { label: '자기계발 & 도서',      emoji: '💪', contextText: '자기계발 도서 책 성장 동기부여 생산성 독서 습관 목표' },
  english: { label: '영어학습 & 어학',      emoji: '🔤', contextText: '영어 어학 교재 영어공부 영어회화 토익 영어학습 문법' },
  learning:{ label: '학습 & 교육',          emoji: '📐', contextText: '학습 교육 공부 교재 강의 인터넷강의 과외 수업 학원' },
  news:    { label: '경제 & 시사',          emoji: '🗞️', contextText: '경제 주식 투자 부동산 시사 금융 재테크 주식투자' },
  tips:    { label: '생활정보 & 리뷰',      emoji: '💡', contextText: '생활 꿀팁 리뷰 추천 제품 비교 소비 정보 구매' },
  story:   { label: '영상 & 엔터테인먼트',  emoji: '🍿', contextText: '영화 드라마 OTT 넷플릭스 콘텐츠 스트리밍 애니' },
  report:  { label: '비즈니스 & 분석',      emoji: '📋', contextText: '비즈니스 분석 보고서 마케팅 기업 전략 리서치' },
}

const DEFAULT_META: CategoryMeta = {
  label: '관련 정보', emoji: '✨', contextText: 'AI 요약 유튜브 콘텐츠 정보',
}

interface Props {
  category: string
  position?: 'mid' | 'bottom'
  className?: string
}

export default function ContextualAdBanner({ category, position = 'mid', className = '' }: Props) {
  const adRef   = useRef<HTMLModElement | null>(null)
  const pushed  = useRef(false)
  const slotId  = position === 'mid' ? SLOT_MID : SLOT_BOT
  const meta    = CATEGORY_META[category] ?? DEFAULT_META

  useEffect(() => {
    if (!CLIENT || !slotId || pushed.current) return
    try {
      pushed.current = true
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({})
    } catch { /* 광고 블록 또는 미로드 */ }
  }, [slotId])

  if (!CLIENT || !slotId) return null

  return (
    <div className={`rounded-2xl overflow-hidden border border-white/5 bg-[#1c1a18] ${className}`}>
      {/* 카테고리 라벨 — AdSense가 이 텍스트를 읽어 관련 광고를 선택한다 */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-white/5">
        <span className="text-sm leading-none" aria-hidden="true">{meta.emoji}</span>
        <span className="text-[10px] text-[#3d3a38] select-none">
          {meta.label} · {meta.contextText}
        </span>
        <span className="ml-auto text-[9px] font-bold text-[#3a3836] tracking-widest">AD</span>
      </div>

      {/* 광고 슬롯 */}
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={{ display: 'block', minHeight: position === 'mid' ? '90px' : '60px' }}
        data-ad-client={CLIENT}
        data-ad-slot={slotId}
        data-ad-format={position === 'mid' ? 'auto' : 'horizontal'}
        data-full-width-responsive="true"
      />
    </div>
  )
}
