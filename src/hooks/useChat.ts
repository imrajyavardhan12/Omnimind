import { useState, useCallback } from 'react'
import { ProviderName, Message, ChatRequest } from '@/lib/types'
import { useChatStore } from '@/lib/stores/chat'
import { useSettingsStore } from '@/lib/stores/settings'
import { estimateTokens, calculateCost } from '@/lib/utils/tokenizer'

interface UseChatOptions {
  provider: ProviderName
  onMessage?: (message: Message) => void
  onError?: (error: Error) => void
  skipAddingUserMessage?: boolean
  modelIdOverride?: string // Allow overriding the model ID for multi-model providers
}

export function useChat({ provider, onMessage, onError, skipAddingUserMessage, modelIdOverride }: UseChatOptions) {
  const [isStreaming, setIsStreaming] = useState(false)
  
  const { 
    getActiveSession, 
    addMessage, 
    updateMessage, 
    setLoading,
    createSession,
    activeSessionId 
  } = useChatStore()
  
  const { getApiKey, selectedModels, temperature, maxTokens } = useSettingsStore()

  const sendMessage = useCallback(async (content: string) => {
    const apiKey = getApiKey(provider)
    if (!apiKey) {
      throw new Error(`No API key configured for ${provider}`)
    }

    let sessionId = activeSessionId
    if (!sessionId) {
      sessionId = createSession()
    }

    const session = getActiveSession()
    if (!session) {
      throw new Error('No active session')
    }

    // Add user message (only if not skipped - for unified input)
    let userMessage: Message
    if (!skipAddingUserMessage) {
      userMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content,
        timestamp: Date.now()
      }
      addMessage(sessionId, userMessage)
    } else {
      // For unified input, find the existing user message with matching content
      userMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content,
        timestamp: Date.now()
      }
    }

    // Prepare assistant message
    const assistantMessageId = crypto.randomUUID()
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      provider,
      model: modelIdOverride || selectedModels[provider]
    }
    addMessage(sessionId, assistantMessage)

    setLoading(provider, true)
    setIsStreaming(true)

    try {
      const chatRequest: ChatRequest = {
        messages: [...session.messages, userMessage],
        model: modelIdOverride || selectedModels[provider],
        temperature,
        maxTokens,
        stream: true
      }

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          [`x-api-key-${provider}`]: apiKey
        },
        body: JSON.stringify({
          ...chatRequest,
          provider
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to get response')
      }

      if (!response.body) {
        throw new Error('No response body')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let fullContent = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') {
              break
            }

            try {
              const chunk = JSON.parse(data)
              if (chunk.content) {
                fullContent += chunk.content
                updateMessage(sessionId, assistantMessageId, {
                  content: fullContent
                })
                
                onMessage?.(assistantMessage)
              }
            } catch (error) {
              console.error('Failed to parse SSE data:', error)
            }
          }
        }
      }

      // Calculate token estimates for streaming (actual counts come from API response)
      const estimatedInputTokens = estimateTokens(
        session.messages.map(m => m.content).join(' ')
      )
      const estimatedOutputTokens = estimateTokens(fullContent)
      const estimatedCost = calculateCost(
        estimatedInputTokens, 
        estimatedOutputTokens, 
        selectedModels[provider]
      )

      // Final update with complete message and estimates
      const finalMessage = {
        ...assistantMessage,
        content: fullContent,
        timestamp: Date.now(),
        tokens: estimatedOutputTokens,
        cost: estimatedCost
      }
      updateMessage(sessionId, assistantMessageId, finalMessage)
      onMessage?.(finalMessage)

    } catch (error) {
      console.error(`Chat error for ${provider}:`, error)
      
      // Update message with error
      updateMessage(sessionId, assistantMessageId, {
        content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      })
      
      onError?.(error instanceof Error ? error : new Error('Unknown error'))
    } finally {
      setLoading(provider, false)
      setIsStreaming(false)
    }
  }, [
    provider,
    getApiKey,
    selectedModels,
    temperature,
    maxTokens,
    activeSessionId,
    getActiveSession,
    addMessage,
    updateMessage,
    setLoading,
    createSession,
    onMessage,
    onError,
    modelIdOverride,
    skipAddingUserMessage
  ])

  return {
    sendMessage,
    isStreaming
  }
}