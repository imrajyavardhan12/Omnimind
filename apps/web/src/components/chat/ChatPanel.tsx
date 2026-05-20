'use client'

import { useRef, useEffect, useMemo } from 'react'
import { Bot, User, Loader2, AlertCircle, X } from 'lucide-react'
import { ProviderName, Message } from '@/lib/types'
import { useChatStore } from '@/lib/stores/chat'
import { useSettingsStore } from '@/lib/stores/settings'
import { useChat } from '@/hooks/useChat'
import { useIsClient } from '@/hooks/useIsClient'
import { MessageStats } from './MessageStats'
import { ModelSelector } from './ModelSelector'
import { cn } from '@/lib/utils'

interface ChatPanelProps {
  provider: ProviderName
  className?: string
}

export function ChatPanel({ provider, className }: ChatPanelProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const isClient = useIsClient()
  
  const { providers } = useSettingsStore()
  const { 
    getActiveSession, 
    isLoading,
    activeSessionId,
    toggleProviderVisibility
  } = useChatStore()
  
  const { sendMessage } = useChat({ provider })
  
  const providerConfig = providers[provider]
  const session = getActiveSession()
  const messages = useMemo(() => 
    session?.messages.filter(msg => msg.provider === provider || msg.role === 'user') || [],
    [session?.messages, provider]
  )
  const loading = isLoading[provider]

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Safety check for provider config (after all hooks)
  if (!isClient || !providerConfig) {
    return (
      <div className={cn('flex flex-col h-full border border-border rounded-lg bg-background', className)}>
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5" />
            <h3 className="font-semibold">{provider.charAt(0).toUpperCase() + provider.slice(1)}</h3>
          </div>
          <div className="w-3 h-3 rounded-full bg-gray-400" />
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-sm text-muted-foreground">Loading...</div>
        </div>
      </div>
    )
  }


  return (
    <div className={cn('flex flex-col h-full border border-border rounded-lg bg-background', className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Bot className="w-5 h-5 flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-sm">{providerConfig.name}</h3>
            <ModelSelector provider={provider} />
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className={cn(
            'w-3 h-3 rounded-full',
            providerConfig.enabled ? 'bg-green-500' : 'bg-gray-400'
          )} />
          <button
            onClick={() => toggleProviderVisibility(provider)}
            className="p-1 hover:bg-accent rounded-md text-muted-foreground hover:text-foreground transition-colors"
            title={`Hide ${providerConfig.name}`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {!providerConfig.enabled ? (
          <div className="flex items-center justify-center h-full text-center">
            <div className="space-y-2">
              <AlertCircle className="w-8 h-8 mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Configure API key to enable {providerConfig.name}
              </p>
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-center">
            <p className="text-sm text-muted-foreground">
              Ready to chat with {providerConfig.name}
            </p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                'w-full',
                message.role === 'user' ? 'flex justify-end' : 'flex justify-start'
              )}
            >
              <div
                className={cn(
                  'max-w-[85%] rounded-xl px-4 py-3 text-sm leading-relaxed',
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted/70 text-foreground'
                )}
              >
                {message.content}
                <MessageStats message={message} />
              </div>
            </div>
          ))
        )}
        
        {loading && (
          <div className="flex justify-start">
            <div className="bg-muted/70 rounded-xl px-4 py-3 text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="w-4 h-4 text-primary animate-spin" />
              Thinking...
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

    </div>
  )
}