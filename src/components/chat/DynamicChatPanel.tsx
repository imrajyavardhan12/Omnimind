'use client'

import { useRef, useEffect, useMemo } from 'react'
import { Bot, User, Loader2, AlertCircle } from 'lucide-react'
import { Message } from '@/lib/types'
import { useChatStore } from '@/lib/stores/chat'
import { useSettingsStore } from '@/lib/stores/settings'
import { useChat } from '@/hooks/useChat'
import { useIsClient } from '@/hooks/useIsClient'
import { MessageStats } from './MessageStats'
import { MessageAttachments } from './MessageAttachments'
import { MessageBranchButton } from './MessageBranchButton'
import { MarkdownRenderer } from './MarkdownRenderer'
import { SelectedModel } from '@/lib/stores/modelTabs'
import { cn } from '@/lib/utils'
import { getProviderIcon } from '@/components/ui/provider-icons'

interface DynamicChatPanelProps {
  selectedModel: SelectedModel
  className?: string
}

export function DynamicChatPanel({ selectedModel, className }: DynamicChatPanelProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const isClient = useIsClient()
  
  const { providers } = useSettingsStore()
  const { 
    getActiveSession, 
    isLoading,
    activeSessionId
  } = useChatStore()
  
  const { sendMessage } = useChat({ 
    provider: selectedModel.provider,
    skipAddingUserMessage: true // For unified input
  })
  
  const providerConfig = providers[selectedModel.provider]
  const session = getActiveSession()
  
  // Filter messages for this specific model
  const messages = useMemo(() => {
    if (!session?.messages) return []
    
    const modelKey = `${selectedModel.provider}:${selectedModel.model.id}`
    
    const filtered = session.messages.filter(msg => {
      // Include assistant messages from this specific model
      if (msg.role === 'assistant') {
        return msg.provider === selectedModel.provider && msg.model === selectedModel.model.id
      }
      
      // Include user messages only if this model was active when the message was sent
      if (msg.role === 'user') {
        // If activeModels is not defined (for backward compatibility), include all user messages
        if (!msg.activeModels) {
          return true
        }
        // Otherwise, only include if this model was active
        return msg.activeModels.includes(modelKey)
      }
      
      return false
    })
    
    return filtered
  }, [session?.messages, selectedModel.provider, selectedModel.model.id])
  
  const loading = isLoading[selectedModel.provider]

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])


  const getProviderColor = (provider: string) => {
    switch (provider) {
      case 'openai': return 'border-green-500'
      case 'anthropic': return 'border-orange-500'
      case 'gemini': return 'border-blue-500'
      case 'openrouter': return 'border-purple-500'
      default: return 'border-gray-500'
    }
  }

  // Safety check for provider config (after all hooks)
  if (!isClient || !providerConfig) {
    return (
      <div className={cn('flex flex-col h-full border border-border rounded-lg bg-background', className)}>
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6">{getProviderIcon(selectedModel.provider, "w-6 h-6")}</div>
            <div>
              <h3 className="font-semibold text-sm">{selectedModel.model.name}</h3>
              <p className="text-xs text-muted-foreground">{selectedModel.provider}</p>
            </div>
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
    <div className={cn('flex flex-col h-full border rounded-lg bg-background', getProviderColor(selectedModel.provider), className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="w-6 h-6 flex-shrink-0">{getProviderIcon(selectedModel.provider, "w-6 h-6")}</div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-sm truncate">{selectedModel.model.name}</h3>
            <p className="text-xs text-muted-foreground">{providerConfig.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className={cn(
            'w-3 h-3 rounded-full',
            providerConfig.enabled ? 'bg-green-500' : 'bg-gray-400'
          )} />
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
              Ready to chat with {selectedModel.model.name}
            </p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                'flex gap-3 group',
                message.role === 'user' ? 'justify-end' : 'justify-start'
              )}
            >
              {message.role === 'assistant' && (
                <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-lg">{getProviderIcon(selectedModel.provider)}</span>
                </div>
              )}
              
              <div
                className={cn(
                  'max-w-[80%] rounded-lg px-3 py-2 text-sm space-y-2 relative',
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground ml-auto'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                {message.attachments && (
                  <MessageAttachments 
                    attachments={message.attachments}
                    className="mb-2"
                  />
                )}
                {message.content && (
                  <>
                    {message.role === 'assistant' ? (
                      <MarkdownRenderer 
                        content={message.content}
                        className="text-sm"
                      />
                    ) : (
                      <div className="whitespace-pre-wrap">{message.content}</div>
                    )}
                  </>
                )}
                <MessageStats message={message} />
                
                {/* Add branch button for user messages */}
                {message.role === 'user' && activeSessionId && (
                  <div className="absolute -left-10 top-2">
                    <MessageBranchButton 
                      message={message} 
                      sessionId={activeSessionId}
                    />
                  </div>
                )}
              </div>
              
              {message.role === 'user' && (
                <div className="w-8 h-8 bg-secondary rounded-full flex items-center justify-center flex-shrink-0">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          ))
        )}
        
        {loading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
              <Loader2 className="w-4 h-4 text-primary animate-spin" />
            </div>
            <div className="bg-muted rounded-lg px-3 py-2 text-sm text-muted-foreground">
              Thinking...
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>
    </div>
  )
}