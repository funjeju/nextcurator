import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { AuthProvider } from '@/providers/AuthProvider'
import { ChatProvider } from '@/providers/ChatProvider'
import ClientRoot from '@/components/auth/ClientRoot'
import FloatingChatWindow from '@/components/chat/FloatingChatWindow'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Next Curator — AI YouTube 요약',
  description: '흘러가던 유튜브, 이제 AI가 내 창고에 쌓아준다',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko" className="dark">
      <body className={inter.className}>
        <AuthProvider>
          <ChatProvider>
            <ClientRoot>{children}</ClientRoot>
            <FloatingChatWindow />
          </ChatProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
