'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

const NAV = [
  {
    label: '시작하기',
    href: '/guide',
    icon: '🚀',
  },
  {
    label: '영상 요약',
    icon: '✨',
    children: [
      { label: '요리 레시피 정리', href: '/guide/summary/recipe', icon: '🍳' },
      { label: '영어 학습 정리', href: '/guide/summary/english', icon: '🔤' },
      { label: '뉴스 & 경제', href: '/guide/summary/news', icon: '🗞️' },
      { label: '여행 스팟 추출', href: '/guide/summary/travel', icon: '🧳' },
    ],
  },
  { label: '재생목록 가져오기', href: '/guide/import', icon: '📋' },
  { label: '블로그 초안 생성', href: '/guide/blog', icon: '✍️' },
  { label: '숏폼 스크립트', href: '/guide/shorts', icon: '🎬' },
  { label: 'AI 대화 검색', href: '/guide/search', icon: '🔍' },
  { label: '스퀘어 활용법', href: '/guide/square', icon: '🌐' },
  { label: '클래스룸', href: '/guide/classroom', icon: '🎓' },
  { label: '요금제 안내', href: '/guide/pricing', icon: '💳' },
]

export default function GuideNav() {
  const pathname = usePathname()
  const [openGroup, setOpenGroup] = useState<string | null>('영상 요약')

  return (
    <nav className="sticky top-6">
      <p className="text-[10px] text-[#4a4745] uppercase tracking-widest mb-3 font-semibold">사용설명서</p>
      <ul className="flex flex-col gap-0.5">
        {NAV.map((item) => {
          if (item.children) {
            const isOpen = openGroup === item.label
            const isActive = item.children.some(c => pathname === c.href)
            return (
              <li key={item.label}>
                <button
                  onClick={() => setOpenGroup(isOpen ? null : item.label)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-colors text-left ${
                    isActive ? 'text-white font-semibold' : 'text-[#75716e] hover:text-white'
                  }`}
                >
                  <span className="text-base">{item.icon}</span>
                  <span className="flex-1">{item.label}</span>
                  <svg className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
                {isOpen && (
                  <ul className="ml-5 mt-0.5 flex flex-col gap-0.5 border-l border-white/5 pl-3">
                    {item.children.map(child => (
                      <li key={child.href}>
                        <Link
                          href={child.href}
                          className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-colors ${
                            pathname === child.href
                              ? 'text-white font-semibold bg-white/5'
                              : 'text-[#75716e] hover:text-white'
                          }`}
                        >
                          <span>{child.icon}</span>
                          <span>{child.label}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            )
          }

          return (
            <li key={item.href}>
              <Link
                href={item.href!}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-colors ${
                  pathname === item.href
                    ? 'text-white font-semibold bg-white/5'
                    : 'text-[#75716e] hover:text-white'
                }`}
              >
                <span className="text-base">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
