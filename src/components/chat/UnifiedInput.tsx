'use client'

import { useState } from 'react'
import { Send, Loader2 } from 'lucide-react'
import { useSettingsStore } from '@/lib/stores/settings'
import { useChatStore } from '@/lib/stores/chat'
import { useChat } from '@/hooks/useChat'
import { ProviderName } from '@/lib/types'
import { cn } from '@/lib/utils'

interface UnifiedInputProps {
  className?: string
}

export function UnifiedInput({ className }: UnifiedInputProps) {
  const [input, setInput] = useState('')
  const { providers } = useSettingsStore()
  const { createSession, activeSessionId, isLoading, visibleProviders } = useChatStore()
  
  // Get active providers (both enabled AND visible)
  const activeProviders = Object.entries(providers)
    .filter(([provider, config]) => config.enabled && visibleProviders[provider as ProviderName])
    .map(([provider]) => provider as ProviderName)
  
  // Set up chat hooks for each active provider (skip adding user message since we add it once)
  const chatHooks = {
    openai: useChat({ provider: 'openai', skipAddingUserMessage: true }),
    anthropic: useChat({ provider: 'anthropic', skipAddingUserMessage: true }),
    gemini: useChat({ provider: 'gemini', skipAddingUserMessage: true }),
    'google-ai-studio': useChat({ provider: 'google-ai-studio', skipAddingUserMessage: true }),
    openrouter: useChat({ provider: 'openrouter', skipAddingUserMessage: true })
  }

  const isAnyLoading = Object.values(isLoading).some(loading => loading)

  const handleSend = async () => {
    if (!input.trim() || activeProviders.length === 0 || isAnyLoading) return

    // Create session if none exists
    let sessionId = activeSessionId
    if (!sessionId) {
      sessionId = createSession()
    }

    const message = input.trim()
    setInput('')

    // Add user message only once to avoid duplicates
    const { addMessage } = useChatStore.getState()
    const userMessage = {
      id: crypto.randomUUID(),
      role: 'user' as const,
      content: message,
      timestamp: Date.now()
    }
    addMessage(sessionId, userMessage)

    // Send to all active providers simultaneously (they'll only add assistant responses)
    const sendPromises = activeProviders.map(async (provider) => {
      try {
        await chatHooks[provider].sendMessage(message)
      } catch (error) {
        console.error(`Error sending to ${provider}:`, error)
      }
    })

    // Wait for all providers to start processing
    await Promise.allSettled(sendPromises)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const getInputPlaceholder = () => {
    if (activeProviders.length === 0) {
      const hasEnabledButHidden = Object.entries(providers).some(([provider, config]) => 
        config.enabled && !visibleProviders[provider as ProviderName]
      )
      
      if (hasEnabledButHidden) {
        return 'Show providers above or configure API keys in Settings...'
      }
      return 'Configure API keys in Settings to start comparing...'
    }
    const providerNames = activeProviders
      .map(p => providers[p].name)
      .join(', ')
    return `Send to ${providerNames}...`
  }

  const getActiveCount = () => {
    return activeProviders.length
  }

  return (
    <div className={cn('border border-border rounded-lg p-4 bg-background', className)}>
      <div className="space-y-4">
        {/* Input Area */}
        <div className="relative">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder={getInputPlaceholder()}
            disabled={activeProviders.length === 0 || isAnyLoading}
            className="w-full h-32 p-3 border border-input rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-ring bg-background placeholder:text-muted-foreground disabled:opacity-50"
            rows={4}
          />
          
          {/* Character count */}
          <div className="absolute bottom-2 right-2 text-xs text-muted-foreground">
            {input.length} characters
          </div>
        </div>

        {/* Action Bar */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className={cn(
                'w-2 h-2 rounded-full',
                activeProviders.length > 0 ? 'bg-green-500' : 'bg-gray-400'
              )} />
              <span>
                {getActiveCount()} / 4 provider{getActiveCount() !== 1 ? 's' : ''} active
              </span>
            </div>
            
            {activeProviders.length > 0 && (
              <div className="text-xs">
                Active: {activeProviders.map(p => providers[p].name).join(', ')}
              </div>
            )}
          </div>

          <button
            onClick={handleSend}
            disabled={!input.trim() || activeProviders.length === 0 || isAnyLoading}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isAnyLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Send to All
              </>
            )}
          </button>
        </div>

        {/* Quick Actions */}
        {activeProviders.length === 0 && (
          <div className="text-center py-4 border border-dashed border-border rounded-lg">
            <p className="text-sm text-muted-foreground mb-2">
              No providers active
            </p>
            <p className="text-xs text-muted-foreground">
              Show hidden providers above or configure API keys in Settings
            </p>
          </div>
        )}
      </div>
    </div>
  )
}