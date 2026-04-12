'use client'

import React, { createContext, useContext, useState, ReactNode } from 'react'
import { UserProfile } from '@/lib/db'

interface ChatState {
  isOpen: boolean
  conversationId: string | null
  otherUser: { uid: string; displayName: string; photoURL: string } | null
}

interface ChatContextType {
  chat: ChatState
  openChat: (cid: string, otherUser: { uid: string; displayName: string; photoURL: string }) => void
  closeChat: () => void
}

const ChatContext = createContext<ChatContextType | undefined>(undefined)

export function ChatProvider({ children }: { children: ReactNode }) {
  const [chat, setChat] = useState<ChatState>({
    isOpen: false,
    conversationId: null,
    otherUser: null,
  })

  const openChat = (cid: string, otherUser: { uid: string; displayName: string; photoURL: string }) => {
    setChat({
      isOpen: true,
      conversationId: cid,
      otherUser,
    })
  }

  const closeChat = () => {
    setChat(prev => ({ ...prev, isOpen: false }))
  }

  return (
    <ChatContext.Provider value={{ chat, openChat, closeChat }}>
      {children}
    </ChatContext.Provider>
  )
}

export function useChat() {
  const context = useContext(ChatContext)
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider')
  }
  return context
}
