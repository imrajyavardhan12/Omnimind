'use client'

import { useState, useMemo, useRef } from 'react'
import { Send, Loader2, Square } from 'lucide-react'
import { useSettingsStore } from '@/lib/stores/settings'
import { useChatStore } from '@/lib/stores/chat'
import { useModelTabsStore } from '@/lib/stores/modelTabs'
import { useChat } from '@/hooks/useChat'
import { ProviderName, FileAttachment } from '@/lib/types'
import { cn } from '@/lib/utils'
import { FileUpload } from './FileUpload'

interface TabifiedUnifiedInputProps {
  className?: string
}

export function TabifiedUnifiedInput({ className }: TabifiedUnifiedInputProps) {
  const [input, setInput] = useState('')
  const [attachments, setAttachments] = useState<FileAttachment[]>([])
  const { providers } = useSettingsStore()
  const { createSession, activeSessionId, isLoading, setAbortController, stopAllResponses } = useChatStore()
  const { selectedModels } = useModelTabsStore()
  const activeRequestsRef = useRef<Set<string>>(new Set())
  
  // Get active models (both enabled providers AND selected in tabs)
  const activeModels = selectedModels.filter(sm => 
    providers[sm.provider]?.enabled
  )
  
  // Check if any model is loading
  const isAnyLoading = activeRequestsRef.current.size > 0 || 
    activeModels.some(model => {
      const key = `${model.provider}-${model.model.id}`
      return isLoading[key] || isLoading[model.provider]
    })

  const handleSend = async () => {
    if ((!input.trim() && attachments.length === 0) || activeModels.length === 0 || isAnyLoading) return

    // Create session if none exists
    let sessionId = activeSessionId
    if (!sessionId) {
      sessionId = createSession()
    }

    const message = input.trim()
    setInput('')
    setAttachments([])

    // Add user message with active models tracking
    const { addMessage } = useChatStore.getState()
    const userMessage = {
      id: crypto.randomUUID(),
      role: 'user' as const,
      content: message,
      timestamp: Date.now(),
      // Track which models are currently active for this message
      activeModels: activeModels.map(sm => `${sm.provider}:${sm.model.id}`),
      attachments: attachments.length > 0 ? attachments : undefined
    }
    addMessage(sessionId, userMessage)

    // Send to each model individually with direct API calls to avoid hook conflicts
    const sendPromises = activeModels.map(async (selectedModel) => {
      // Create unique key for this model instance
      const modelKey = `${selectedModel.provider}-${selectedModel.model.id}-${Date.now()}`
      const assistantMessageId = crypto.randomUUID()
      
      // Track active request
      activeRequestsRef.current.add(modelKey)
      
      try {
        console.log(`Sending to ${selectedModel.model.name} (${selectedModel.model.id}) via ${selectedModel.provider} with key ${modelKey}`)
        
        // Add system prompt to message if it exists
        let messageToSend = message
        if (selectedModel.settings.systemPrompt.trim()) {
          messageToSend = `${selectedModel.settings.systemPrompt}\n\nUser: ${message}`
        }
        
        const assistantMessage = {
          id: assistantMessageId,
          role: 'assistant' as const,
          content: '',
          timestamp: Date.now(),
          provider: selectedModel.provider,
          model: selectedModel.model.id
        }
        useChatStore.getState().addMessage(sessionId, assistantMessage)
        
        // Set loading for this specific model
        useChatStore.getState().setLoading(modelKey, true)
        
        // Create abort controller for this specific request
        const abortController = new AbortController()
        useChatStore.getState().setAbortController(modelKey, abortController)
        
        console.log(`Set abort controller for ${modelKey}`)
        
        // Make direct API call with specific model
        const response = await fetch('/api/chat', {
          method: 'POST',
          signal: abortController.signal,
          headers: {
            'Content-Type': 'application/json',
            [`x-api-key-${selectedModel.provider}`]: useSettingsStore.getState().getApiKey(selectedModel.provider) || ''
          },
          body: JSON.stringify({
            messages: [...useChatStore.getState().getActiveSession()?.messages || [], {
              id: crypto.randomUUID(),
              role: 'user',
              content: messageToSend,
              timestamp: Date.now()
            }],
            model: selectedModel.model.id,
            temperature: selectedModel.settings.temperature,
            maxTokens: selectedModel.settings.maxTokens,
            stream: true,
            provider: selectedModel.provider
          })
        })
        
        if (response.ok && response.body) {
          const reader = response.body.getReader()
          const decoder = new TextDecoder()
          let buffer = ''
          let fullContent = ''
          
          try {
            while (true) {
              // Check if aborted before each read
              if (abortController.signal.aborted) {
                console.log(`${modelKey} stream aborted`)
                reader.cancel()
                break
              }
              
              const { done, value } = await reader.read()
              if (done) break
              
              buffer += decoder.decode(value, { stream: true })
              const lines = buffer.split('\n')
              buffer = lines.pop() || ''
              
              for (const line of lines) {
                // Check if aborted during processing
                if (abortController.signal.aborted) {
                  console.log(`${modelKey} stream aborted during processing`)
                  reader.cancel()
                  break
                }
                
                if (line.startsWith('data: ')) {
                  const data = line.slice(6)
                  if (data === '[DONE]') break
                  
                  try {
                    const parsed = JSON.parse(data)
                    if (parsed.content) {
                      fullContent += parsed.content
                      // Update message with content and any available metadata
                      const updateData: any = { content: fullContent }
                      if (parsed.tokens) updateData.tokens = parsed.tokens
                      if (parsed.cost) updateData.cost = parsed.cost
                      
                      useChatStore.getState().updateMessage(sessionId, assistantMessageId, updateData)
                    }
                    
                    // Handle final message with complete stats
                    if (parsed.done || parsed.finish_reason) {
                      console.log('Final message stats:', { tokens: parsed.tokens, cost: parsed.cost })
                      const updateData: any = { content: fullContent }
                      if (parsed.tokens) updateData.tokens = parsed.tokens
                      if (parsed.cost) updateData.cost = parsed.cost
                      
                      useChatStore.getState().updateMessage(sessionId, assistantMessageId, updateData)
                    }
                  } catch (e) {
                    console.error('Error parsing stream data:', e, 'Raw data:', data)
                  }
                }
              }
            }
          } finally {
            reader.releaseLock()
          }
        } else {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }
        
        // After streaming is complete, calculate tokens/cost if not provided
        setTimeout(() => {
          const finalMessage = useChatStore.getState().getActiveSession()?.messages.find(m => m.id === assistantMessageId)
          if (finalMessage && (!finalMessage.tokens || !finalMessage.cost)) {
            console.log('Calculating missing stats for:', selectedModel.model.name)
            
            // Import tokenizer functions dynamically
            import('@/lib/utils/tokenizer').then(({ estimateTokens, calculateCost }) => {
              const inputTokens = estimateTokens(messageToSend)
              const outputTokens = estimateTokens(finalMessage.content)
              const totalTokens = inputTokens + outputTokens
              const cost = calculateCost(inputTokens, outputTokens, selectedModel.model.id)
              
              useChatStore.getState().updateMessage(sessionId, assistantMessageId, {
                tokens: totalTokens,
                cost: cost
              })
            })
          }
        }, 1000) // Wait 1 second after completion
        
      } catch (error) {
        console.error(`Error sending to ${selectedModel.provider} (${selectedModel.model.name}):`, error)
        
        // Check if error is due to abort
        if (error instanceof Error && error.name === 'AbortError') {
          useChatStore.getState().updateMessage(sessionId, assistantMessageId, {
            content: fullContent || 'Response stopped by user'
          })
        } else {
          useChatStore.getState().updateMessage(sessionId, assistantMessageId, {
            content: 'Error: Failed to get response'
          })
        }
      } finally {
        // Clean up for this specific model
        useChatStore.getState().setLoading(modelKey, false)
        useChatStore.getState().setAbortController(modelKey, null)
        activeRequestsRef.current.delete(modelKey)
      }
    })

    // Wait for all models to complete
    await Promise.allSettled(sendPromises)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const getInputPlaceholder = () => {
    if (activeModels.length === 0) {
      const hasSelectedButDisabled = selectedModels.some(sm => 
        !providers[sm.provider]?.enabled
      )
      
      if (hasSelectedButDisabled) {
        return 'Configure API keys in Settings for selected models...'
      }
      
      if (selectedModels.length === 0) {
        return 'Add models above to start comparing...'
      }
      
      return 'Configure API keys in Settings...'
    }
    
    const modelNames = activeModels
      .map(sm => sm.model.name)
      .join(', ')
    return `Type a message or attach files to send to ${modelNames}...`
  }

  const getActiveCount = () => {
    return activeModels.length
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
            disabled={activeModels.length === 0 || isAnyLoading}
            className="w-full h-32 p-3 border border-input rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-ring bg-background placeholder:text-muted-foreground disabled:opacity-50"
            rows={4}
          />
          
          {/* Character count */}
          <div className="absolute bottom-2 right-2 text-xs text-muted-foreground">
            {input.length} characters
          </div>
        </div>

        {/* File Upload */}
        <FileUpload
          onFilesSelected={(files) => setAttachments(prev => [...prev, ...files])}
          selectedFiles={attachments}
          onRemoveFile={(fileId) => setAttachments(prev => prev.filter(f => f.id !== fileId))}
          disabled={activeModels.length === 0 || isAnyLoading}
        />

        {/* Action Bar */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className={cn(
                'w-2 h-2 rounded-full',
                activeModels.length > 0 ? 'bg-green-500' : 'bg-gray-400'
              )} />
              <span>
                {getActiveCount()} / {selectedModels.length} model{getActiveCount() !== 1 ? 's' : ''} active
              </span>
            </div>
            
            {activeModels.length > 0 && (
              <div className="text-xs">
                Active: {activeModels.map(sm => sm.model.name).join(', ')}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={stopAllResponses}
              disabled={!isAnyLoading}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-md transition-colors",
                isAnyLoading 
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" 
                  : "bg-muted text-muted-foreground cursor-not-allowed opacity-50"
              )}
            >
              <Square className="w-4 h-4" />
              Stop All
            </button>
            
            <button
              onClick={handleSend}
              disabled={(!input.trim() && attachments.length === 0) || activeModels.length === 0 || isAnyLoading}
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
                  Send
                </>
              )}
            </button>
          </div>
        </div>

        {/* Quick Actions */}
        {activeModels.length === 0 && (
          <div className="text-center py-4 border border-dashed border-border rounded-lg">
            <p className="text-sm text-muted-foreground mb-2">
              No active models
            </p>
            <p className="text-xs text-muted-foreground">
              {selectedModels.length === 0 
                ? 'Add models using the tab bar above'
                : 'Configure API keys in Settings for your selected models'
              }
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
