'use client'

import { Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function extractYouTubeUrl(text: string | null, url: string | null, title: string | null): string | null {
  const candidates = [url, text, title].filter(Boolean) as string[]
  for (const c of candidates) {
    const match = c.match(/https?:\/\/(?:www\.youtube\.com\/watch\?v=|youtu\.be\/)[\w-]+/)
    if (match) return match[0]
  }
  return null
}

function ShareHandler() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const url = searchParams.get('url')
    const text = searchParams.get('text')
    const title = searchParams.get('title')

    const ytUrl = extractYouTubeUrl(text, url, title)
    if (ytUrl) {
      router.replace(`/?url=${encodeURIComponent(ytUrl)}`)
    } else {
      router.replace('/')
    }
  }, [router, searchParams])

  return null
}

export default function SharePage() {
  return (
    <div className="min-h-screen bg-[#1a1917] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-[#75716e] text-sm">쏙튜브로 이동 중...</p>
      </div>
      <Suspense>
        <ShareHandler />
      </Suspense>
    </div>
  )
}
