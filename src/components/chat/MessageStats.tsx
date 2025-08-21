'use client'

import { Clock, Hash } from 'lucide-react'
import { Message } from '@/lib/types'
import { formatCost, formatTokens } from '@/lib/utils/tokenizer'
import { cn } from '@/lib/utils'

interface MessageStatsProps {
  message: Message
  className?: string
}

export function MessageStats({ message, className }: MessageStatsProps) {
  if (message.role !== 'assistant' || !message.provider) {
    return null
  }

  return (
    <div className={cn('flex items-center gap-4 text-xs text-muted-foreground mt-2', className)}>
      {message.tokens && (
        <div className="flex items-center gap-1">
          <Hash className="w-3 h-3" />
          <span>{formatTokens(message.tokens)} tokens</span>
        </div>
      )}
      
      {message.cost && (
        <div className="flex items-center gap-1">
          <span>{formatCost(message.cost)}</span>
        </div>
      )}
      
      {message.model && (
        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          <span className="font-mono text-xs">{message.model}</span>
        </div>
      )}
    </div>
  )
}