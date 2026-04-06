'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

interface CopyButtonProps {
  text: string
}

export default function CopyButton({ text }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleCopy}
      className="text-zinc-400 hover:text-zinc-100"
    >
      {copied ? '✅ 복사됨' : '📋 복사'}
    </Button>
  )
}
