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
    default: 'SSOKTUBE — 유튜브를 SSOK쏙 내 지식을 SSUK쑥',
    template: '%s | SSOKTUBE',
  },
  description: '유튜브를 SSOK쏙 내 지식을 SSUK쑥. AI가 영상을 분석해 핵심만 내 라이브러리에 저장해드립니다.',
  keywords: ['유튜브 요약', 'YouTube AI 요약', '영상 요약', 'AI 학습', '유튜브 라이브러리', '요리 레시피', '영어 학습'],
  authors: [{ name: 'SSOKTUBE' }],
  creator: 'SSOKTUBE',
  openGraph: {
    type: 'website',
    locale: 'ko_KR',
    url: 'https://ssoktube.com',
    siteName: 'SSOKTUBE',
    title: 'SSOKTUBE — 유튜브를 SSOK쏙 내 지식을 SSUK쑥',
    description: '유튜브를 SSOK쏙 내 지식을 SSUK쑥. AI가 영상을 분석해 핵심만 내 라이브러리에 저장해드립니다.',
  },
  twitter: {
    card: 'summary_large_image',
    site: '@ssoktube',
    title: 'SSOKTUBE — 유튜브를 SSOK쏙 내 지식을 SSUK쑥',
    description: '유튜브를 SSOK쏙 내 지식을 SSUK쑥. AI가 영상을 분석해 핵심만 내 라이브러리에 저장해드립니다.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-snippet': -1, 'max-image-preview': 'large' },
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
        {ADSENSE_CLIENT && (
          <Script
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`}
            strategy="afterInteractive"
            crossOrigin="anonymous"
          />
        )}
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
