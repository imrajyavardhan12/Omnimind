'use client'

import { BarChart3, DollarSign, Hash, MessageSquare } from 'lucide-react'
import { useChatStore } from '@/lib/stores/chat'
import { formatCost, formatTokens } from '@/lib/utils/tokenizer'
import { useIsClient } from '@/hooks/useIsClient'
import { cn } from '@/lib/utils'

interface SessionStatsProps {
  className?: string
}

export function SessionStats({ className }: SessionStatsProps) {
  const { getActiveSession } = useChatStore()
  const isClient = useIsClient()
  const session = getActiveSession()

  if (!isClient || !session || session.messages.length === 0) {
    return null
  }

  const stats = session.messages.reduce(
    (acc, message) => {
      if (message.role === 'assistant' && message.provider) {
        acc.totalMessages++
        acc.totalTokens += message.tokens || 0
        acc.totalCost += message.cost || 0
        
        const provider = message.provider
        if (!acc.byProvider[provider]) {
          acc.byProvider[provider] = { messages: 0, tokens: 0, cost: 0 }
        }
        acc.byProvider[provider].messages++
        acc.byProvider[provider].tokens += message.tokens || 0
        acc.byProvider[provider].cost += message.cost || 0
      }
      return acc
    },
    {
      totalMessages: 0,
      totalTokens: 0,
      totalCost: 0,
      byProvider: {} as Record<string, { messages: number; tokens: number; cost: number }>
    }
  )

  return (
    <div className={cn('bg-muted/50 rounded-lg p-4 space-y-3', className)}>
      <div className="flex items-center gap-2 text-sm font-medium">
        <BarChart3 className="w-4 h-4" />
        Session Statistics
      </div>
      
      <div className="grid grid-cols-3 gap-4 text-sm">
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
            <MessageSquare className="w-3 h-3" />
            <span>Messages</span>
          </div>
          <div className="font-semibold">{stats.totalMessages}</div>
        </div>
        
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
            <Hash className="w-3 h-3" />
            <span>Tokens</span>
          </div>
          <div className="font-semibold">{formatTokens(stats.totalTokens)}</div>
        </div>
        
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
            <DollarSign className="w-3 h-3" />
            <span>Cost</span>
          </div>
          <div className="font-semibold">{formatCost(stats.totalCost)}</div>
        </div>
      </div>
      
      {Object.keys(stats.byProvider).length > 1 && (
        <div className="border-t border-border pt-3 space-y-2">
          <div className="text-xs font-medium text-muted-foreground">By Provider:</div>
          {Object.entries(stats.byProvider).map(([provider, providerStats]) => (
            <div key={provider} className="flex justify-between items-center text-xs">
              <span className="capitalize font-medium">{provider}</span>
              <div className="flex gap-3 text-muted-foreground">
                <span>{formatTokens(providerStats.tokens)}</span>
                <span>{formatCost(providerStats.cost)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}