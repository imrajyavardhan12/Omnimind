import { useState, useCallback } from 'react'
import { ProviderName, Message, ChatRequest } from '@/lib/types'
import { useChatStore } from '@/lib/stores/chat'
import { useSettingsStore } from '@/lib/stores/settings'
import { estimateTokens, calculateCost } from '@/lib/utils/tokenizer'
import { logger } from '@/lib/utils/logger'

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
    activeSessionId,
    setAbortController 
  } = useChatStore()
  
  const { getApiKey, selectedModels, temperature, maxTokens, messagesInContext, responseLanguage, providers } = useSettingsStore()

  const sendMessage = useCallback(async (content: string, attachments?: import('@/lib/types').FileAttachment[]) => {
    const apiKey = getApiKey(provider)
    const providerConfig = providers[provider]
    
    // For free tier providers (like google-ai-studio), API key is handled server-side
    // So we allow empty API key and let the backend use its server key
    if (!apiKey && !providerConfig?.isFree) {
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
        timestamp: Date.now(),
        attachments: attachments
      }
      addMessage(sessionId, userMessage)
    } else {
      // For unified input, find the existing user message with matching content
      userMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content,
        timestamp: Date.now(),
        attachments: attachments
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

    // Create unique key for this request
    const requestKey = `${provider}-${modelIdOverride || selectedModels[provider]}-${Date.now()}`
    
    // Create abort controller for this request
    const abortController = new AbortController()
    setAbortController(requestKey, abortController)
    
    setLoading(requestKey, true)
    setIsStreaming(true)
    
    let fullContent = ''

    try {
      // Limit messages in context if configured
      const allMessages = [...session.messages, {
        ...userMessage,
        attachments: attachments
      }]
      
      let messagesToSend = allMessages
      // Safety check: ensure messagesInContext is a valid number
      const contextLimit = typeof messagesInContext === 'number' ? messagesInContext : 0
      if (contextLimit > 0 && allMessages.length > contextLimit) {
        // Keep the most recent messages
        messagesToSend = allMessages.slice(-contextLimit)
        logger.debug(`Limited context to ${contextLimit} messages (from ${allMessages.length})`)
      }
      
      // Add response language instruction if specified
      // Instead of system message, prepend to first user message for better compatibility
      const languageInstruction = responseLanguage && typeof responseLanguage === 'string' && responseLanguage.trim() && responseLanguage !== 'none'
        ? responseLanguage.trim()
        : null
      
      if (languageInstruction && messagesToSend.length > 0) {
        // Find the last user message and prepend language instruction
        const lastUserMessageIndex = messagesToSend.length - 1
        const lastMessage = messagesToSend[lastUserMessageIndex]
        
        if (lastMessage && lastMessage.role === 'user') {
          messagesToSend = [
            ...messagesToSend.slice(0, lastUserMessageIndex),
            {
              ...lastMessage,
              content: `[Note: Please respond in ${languageInstruction}]\n\n${lastMessage.content}`
            }
          ]
        }
      }

      const chatRequest: ChatRequest = {
        messages: messagesToSend,
        model: modelIdOverride || selectedModels[provider],
        temperature,
        maxTokens,
        stream: true
      }

      const response = await fetch('/api/chat', {
        method: 'POST',
        signal: abortController.signal,
        headers: {
          'Content-Type': 'application/json',
          // Only send API key header if we have one (free tier providers don't need it)
          ...(apiKey ? { [`x-api-key-${provider}`]: apiKey } : {})
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

      while (true) {
        // Check if aborted before each read
        if (abortController.signal.aborted) {
          logger.debug(`${requestKey} stream aborted`)
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
            logger.debug(`${requestKey} stream aborted during processing`)
            reader.cancel()
            break
          }
          
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
      // Check if error is due to abort (user stopped the request)
      if (error instanceof Error && (error.name === 'AbortError' || error.message.includes('aborted'))) {
        logger.debug(`Request aborted by user for ${provider}`)
        // Update message with what we have so far, or a stopped message
        updateMessage(sessionId, assistantMessageId, {
          content: fullContent || 'Response stopped by user'
        })
        // Don't show error for user-initiated stops
      } else {
        // Real error - log and show to user
        console.error(`Chat error for ${provider}:`, error)
        updateMessage(sessionId, assistantMessageId, {
          content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
        })
        onError?.(error instanceof Error ? error : new Error('Unknown error'))
      }
    } finally {
      // Always clean up abort controller and loading state
      setAbortController(requestKey, null)
      setLoading(requestKey, false)
      setIsStreaming(false)
    }
  }, [
    provider,
    getApiKey,
    providers,
    selectedModels,
    temperature,
    maxTokens,
    messagesInContext,
    responseLanguage,
    activeSessionId,
    getActiveSession,
    addMessage,
    updateMessage,
    setLoading,
    createSession,
    onMessage,
    onError,
    modelIdOverride,
    skipAddingUserMessage,
    setAbortController
  ])

  return {
    sendMessage,
    isStreaming
  }
}