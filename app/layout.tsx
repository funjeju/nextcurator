import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import Script from 'next/script'
import './globals.css'
import { AuthProvider } from '@/providers/AuthProvider'
import { ChatProvider } from '@/providers/ChatProvider'
import ClientRoot from '@/components/auth/ClientRoot'
import FloatingChatWindow from '@/components/chat/FloatingChatWindow'
import ThemeProvider from '@/components/common/ThemeProvider'

const ADSENSE_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  metadataBase: new URL('https://ssoktube.com'),
  title: {
    default: '유튜브 AI 요약 | SSOKTUBE — 영상 핵심만 내 라이브러리에',
    template: '%s | SSOKTUBE 유튜브 AI 요약',
  },
  description: 'AI가 유튜브 영상을 자동 요약·분석해 핵심만 저장해드립니다. 요리 레시피, 영어 학습, 경제·재테크, 뉴스 등 모든 영상을 내 라이브러리에 쏙.',
  keywords: ['유튜브 요약', '유튜브 AI 요약', '영상 요약 저장', 'AI 영상 분석', '유튜브 정리', '유튜브 라이브러리', '유튜브 핵심 정리', '요리 레시피 요약', '영어 학습 유튜브', '경제 유튜브 요약'],
  authors: [{ name: 'SSOKTUBE' }],
  creator: 'SSOKTUBE',
  openGraph: {
    type: 'website',
    locale: 'ko_KR',
    url: 'https://ssoktube.com',
    siteName: 'SSOKTUBE',
    title: '유튜브 AI 요약 | SSOKTUBE — 영상 핵심만 내 라이브러리에',
    description: 'AI가 유튜브 영상을 자동 요약·분석해 핵심만 저장해드립니다. 요리 레시피, 영어 학습, 경제·재테크, 뉴스 등 모든 영상을 내 라이브러리에 쏙.',
  },
  twitter: {
    card: 'summary_large_image',
    site: '@ssoktube',
    title: '유튜브 AI 요약 | SSOKTUBE — 영상 핵심만 내 라이브러리에',
    description: 'AI가 유튜브 영상을 자동 요약·분석해 핵심만 저장해드립니다. 요리 레시피, 영어 학습, 경제·재테크, 뉴스 등 모든 영상을 내 라이브러리에 쏙.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-snippet': -1, 'max-image-preview': 'large' },
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION ?? '',
    other: {
      'naver-site-verification': ['aaf6d83f723d68faddb24283da6de1c8400d7b12'],
    },
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko" className="dark">
      <head>
        {/* FOUC 방지: 렌더 전에 저장된 테마 클래스 즉시 적용 */}
        <script dangerouslySetInnerHTML={{ __html: `
          (function(){
            var t = localStorage.getItem('theme') || 'dark';
            document.documentElement.classList.toggle('dark', t === 'dark');
            document.documentElement.classList.toggle('light', t === 'light');
          })()
        `}} />
        {/* Naver Analytics */}
        <Script
          id="naver-analytics"
          src="//wcs.pstatic.net/wcslog.js"
          strategy="afterInteractive"
        />
        <Script
          id="naver-analytics-init"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{ __html: `
            if(!wcs_add) var wcs_add = {};
            wcs_add["wa"] = "194425f5b7da7a0";
            if(window.wcs) { wcs_do(); }
          `}}
        />
        {/* Google Tag Manager */}
        <Script
          id="gtm-head"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{ __html: `
            (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
            new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
            j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
            'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
            })(window,document,'script','dataLayer','GTM-5FKKZPSB');
          `}}
        />
      </head>
      <body className={inter.className}>
        {/* Google Tag Manager (noscript) */}
        <noscript>
          <iframe
            src="https://www.googletagmanager.com/ns.html?id=GTM-5FKKZPSB"
            height="0" width="0"
            style={{ display: 'none', visibility: 'hidden' }}
          />
        </noscript>
        <Script
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-3976821769415958"
          strategy="afterInteractive"
          crossOrigin="anonymous"
        />
        <ThemeProvider>
          <AuthProvider>
            <ChatProvider>
              <ClientRoot>{children}</ClientRoot>
              <FloatingChatWindow />
            </ChatProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
