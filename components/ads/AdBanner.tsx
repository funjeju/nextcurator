'use client'

import { useEffect, useRef } from 'react'

interface Props {
  adSlot: string
  adFormat?: 'auto' | 'rectangle' | 'horizontal'
  className?: string
  responsive?: boolean
}

const CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT

// AdSense를 사용하지 않는 환경이면 아무것도 렌더링하지 않음
export default function AdBanner({ adSlot, adFormat = 'auto', className = '', responsive = true }: Props) {
  const adRef = useRef<HTMLModElement | null>(null)
  const pushed = useRef(false)

  useEffect(() => {
    if (!CLIENT || pushed.current) return
    try {
      pushed.current = true
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({})
    } catch {
      // AdSense 아직 로드 안 됐거나 블록된 경우 — 무시
    }
  }, [])

  if (!CLIENT) return null

  return (
    <div className={`overflow-hidden ${className}`}>
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client={CLIENT}
        data-ad-slot={adSlot}
        data-ad-format={adFormat}
        data-full-width-responsive={responsive ? 'true' : 'false'}
      />
    </div>
  )
}
