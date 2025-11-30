'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Loader2, Square, Folder } from 'lucide-react'
import { LiquidMetal, PulsingBorder } from "@paper-design/shaders-react"
import { motion } from "framer-motion"
import { useSettingsStore } from '@/lib/stores/settings'
import { useChatStore } from '@/lib/stores/chat'
import { useModelTabsStore } from '@/lib/stores/modelTabs'
import { useEnhancementStore } from '@/lib/stores/enhancement'
import { cn } from '@/lib/utils'
import { SimplePromptEnhancer } from './SimplePromptEnhancer'
import { FileUpload } from './FileUpload'
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { FileAttachment } from '@/lib/types'
import { logger } from '@/lib/utils/logger'

interface AnimatedUnifiedInputProps {
  className?: string
}

export function AnimatedUnifiedInput({ className }: AnimatedUnifiedInputProps) {
  const [input, setInput] = useState('')
  const [isFocused, setIsFocused] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<FileAttachment[]>([])
  const { providers } = useSettingsStore()
  const { createSession, activeSessionId, isLoading, setAbortController, stopAllResponses, getActiveSession } = useChatStore()
  const { selectedModels } = useModelTabsStore()
  const { preferences, addToHistory } = useEnhancementStore()
  const activeRequestsRef = useRef<Set<string>>(new Set())
  
  // Get current session for checking message count
  const currentSession = getActiveSession()
  const hasMessages = currentSession?.messages && currentSession.messages.length > 0
  
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
    if (!input.trim() || activeModels.length === 0 || isAnyLoading) return

    // Create session if none exists
    let sessionId = activeSessionId
    if (!sessionId) {
      sessionId = createSession()
    }

    const message = input.trim()
    // Save attachments to variable BEFORE clearing state (critical!)
    const attachments = selectedFiles.length > 0 ? selectedFiles : undefined
    
    setInput('')
    // Clear selected files after saving to variable
    setSelectedFiles([])

    // Add user message with active models tracking and attachments
    const { addMessage } = useChatStore.getState()
    const userMessage = {
      id: crypto.randomUUID(),
      role: 'user' as const,
      content: message,
      timestamp: Date.now(),
      // Track which models are currently active for this message
      activeModels: activeModels.map(sm => `${sm.provider}:${sm.model.id}`),
      attachments: attachments
    }
    addMessage(sessionId, userMessage)

    // Send to each model individually with direct API calls
    const sendPromises = activeModels.map(async (selectedModel) => {
      // Create unique key for this model instance
      const modelKey = `${selectedModel.provider}-${selectedModel.model.id}-${Date.now()}`
      const assistantMessageId = crypto.randomUUID()
      
      // Track active request
      activeRequestsRef.current.add(modelKey)
      
      let fullContent = ''
      
      try {
        logger.debug(`Sending to ${selectedModel.model.name} (${selectedModel.model.id}) via ${selectedModel.provider}`)
        
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
        
        logger.debug(`Set abort controller for ${modelKey}`)
        
        // Get session messages - but use our fresh userMessage with full attachment data
        // instead of potentially persisted message with cleared data
        const storedSession = useChatStore.getState().getActiveSession()
        const previousMessages = storedSession?.messages.slice(0, -1) || []
        
        // Build final user message with system prompt if configured
        let finalUserMessage = { ...userMessage }
        if (selectedModel.settings.systemPrompt.trim()) {
          finalUserMessage = {
            ...finalUserMessage,
            content: `${selectedModel.settings.systemPrompt}\n\nUser: ${finalUserMessage.content}`
          }
        }
        
        // Use previousMessages + our fresh userMessage (with full attachments data)
        const sessionMessages = [...previousMessages, finalUserMessage]
        
        // Build API request payload
        const apiPayload = {
          messages: sessionMessages,
          model: selectedModel.model.id,
          temperature: selectedModel.settings.temperature,
          maxTokens: selectedModel.settings.maxTokens,
          stream: true,
          provider: selectedModel.provider
        }
        
        // Debug: Log the messages being sent
        logger.debug(`Sending ${sessionMessages.length} messages to ${selectedModel.provider}`)
        const lastMessage = sessionMessages[sessionMessages.length - 1]
        if (lastMessage) {
          logger.debug(`Last message:`, {
            role: lastMessage.role,
            contentLength: lastMessage.content?.length,
            hasAttachments: !!lastMessage.attachments,
            attachmentCount: lastMessage.attachments?.length || 0,
            attachmentDataLength: lastMessage.attachments?.[0]?.data?.length || 0
          })
        }
        
        // Make direct API call with specific model
        const response = await fetch('/api/chat', {
          method: 'POST',
          signal: abortController.signal,
          headers: {
            'Content-Type': 'application/json',
            [`x-api-key-${selectedModel.provider}`]: useSettingsStore.getState().getApiKey(selectedModel.provider) || ''
          },
          body: JSON.stringify(apiPayload)
        })
        
        if (response.ok && response.body) {
          const reader = response.body.getReader()
          const decoder = new TextDecoder()
          let buffer = ''
          
          try {
            while (true) {
              // Check if aborted before each read
              if (abortController.signal.aborted) {
                logger.debug(`${modelKey} stream aborted`)
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
                  logger.debug(`${modelKey} stream aborted during processing`)
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
                      logger.debug('Final message stats:', { tokens: parsed.tokens, cost: parsed.cost })
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
            logger.debug('Calculating missing stats for:', selectedModel.model.name)
            
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
        
        // Parse error for user-friendly message
        const { parseError } = await import('@/lib/utils/errorHandler')
        const errorInfo = parseError(error)
        
        // Update message with appropriate error
        useChatStore.getState().updateMessage(sessionId, assistantMessageId, {
          content: errorInfo.message === 'Request cancelled by user' && fullContent 
            ? fullContent 
            : `Error: ${errorInfo.message}`
        })
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

  const handleEnhancedPromptSelect = (enhancedPrompt: string) => {
    setInput(enhancedPrompt)
    
    // Add to enhancement history
    addToHistory(input, null, activeSessionId || undefined)
  }

  const handleFilesSelected = (files: FileAttachment[]) => {
    setSelectedFiles(prev => [...prev, ...files])
  }

  const handleRemoveFile = (fileId: string) => {
    setSelectedFiles(prev => prev.filter(f => f.id !== fileId))
  }
  
  // Handle auto-message from URL hash - placed after handleSend is defined
  useEffect(() => {
    if (typeof window === 'undefined') return
    
    const handleAutoMessage = () => {
      const autoMessage = sessionStorage.getItem('omnimind_auto_message')
      if (!autoMessage) return
      
      // Check if we have active models
      const currentActiveModels = useModelTabsStore.getState().selectedModels.filter(sm => 
        useSettingsStore.getState().providers[sm.provider]?.enabled
      )
      
      if (currentActiveModels.length === 0) {
        // Don't remove the message yet, wait for models to be ready
        return
      }
      
      // Remove from storage and set input
      sessionStorage.removeItem('omnimind_auto_message')
      setInput(autoMessage)
      
      // Small delay to let the input render and state update, then auto-send
      setTimeout(() => {
        // Call handleSend directly - the timeout ensures it's available
        handleSend()
      }, 400)
    }
    
    window.addEventListener('omnimind:auto-message', handleAutoMessage)
    // Check on mount after a brief delay to ensure stores are hydrated
    const timer = setTimeout(handleAutoMessage, 200)
    
    return () => {
      window.removeEventListener('omnimind:auto-message', handleAutoMessage)
      clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Run once on mount

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
    
    return `Type your message here...`
  }

  const getActiveCount = () => {
    return activeModels.length
  }

  return (
    <div className={cn('flex flex-col items-center justify-center p-6', className)}>
      <div className="w-full max-w-4xl relative">
        {/* Ready to chat animation - only show when no messages and active models available */}
        {!hasMessages && activeModels.length > 0 && (
          <div className="flex flex-row items-center mb-4">
            {/* Shader Circle */}
            <motion.div
              id="circle-ball"
              className="relative flex items-center justify-center z-10"
              animate={{
                y: isFocused ? 50 : 0,
                opacity: isFocused ? 0 : 100,
                filter: isFocused ? "blur(4px)" : "blur(0px)",
                rotate: isFocused ? 180 : 0,
              }}
              transition={{
                duration: 0.5,
                type: "spring",
                stiffness: 200,
                damping: 20,
              }}
            >
              <div className="z-10 absolute bg-foreground/5 h-11 w-11 rounded-full backdrop-blur-[3px]">
                <div className="h-[2px] w-[2px] bg-foreground rounded-full absolute top-4 left-4  blur-[1px] opacity-70" />
                <div className="h-[2px] w-[2px] bg-foreground rounded-full absolute top-3 left-7  blur-[0.8px] opacity-80" />
                <div className="h-[2px] w-[2px] bg-foreground rounded-full absolute top-8 left-2  blur-[1px] opacity-70" />
                <div className="h-[2px] w-[2px] bg-foreground rounded-full absolute top-5 left-9 blur-[0.8px] opacity-80" />
                <div className="h-[2px] w-[2px] bg-foreground rounded-full absolute top-7 left-7  blur-[1px] opacity-70" />
              </div>
              <LiquidMetal
                style={{ height: 80, width: 80, filter: "blur(14px)", position: "absolute" }}
                colorBack="hsl(0, 0%, 0%, 0)"
                colorTint="hsl(29, 77%, 49%)"
                repetition={4}
                softness={0.5}
                shiftRed={0.3}
                shiftBlue={0.3}
                distortion={0.1}
                contour={1}
                shape="circle"
                offsetX={0}
                offsetY={0}
                scale={0.58}
                rotation={50}
                speed={5}
              />
              <LiquidMetal
                style={{ height: 80, width: 80 }}
                colorBack="hsl(0, 0%, 0%, 0)"
                colorTint="hsl(29, 77%, 49%)"
                repetition={4}
                softness={0.5}
                shiftRed={0.3}
                shiftBlue={0.3}
                distortion={0.1}
                contour={1}
                shape="circle"
                offsetX={0}
                offsetY={0}
                scale={0.58}
                rotation={50}
                speed={5}
              />
            </motion.div>

            {/* Greeting Text */}
            <motion.p
              className="text-muted-foreground text-sm font-light z-10 ml-4"
              animate={{
                y: isFocused ? 50 : 0,
                opacity: isFocused ? 0 : 100,
                filter: isFocused ? "blur(4px)" : "blur(0px)",
              }}
              transition={{
                duration: 0.5,
                type: "spring",
                stiffness: 200,
                damping: 20,
              }}
            >
              Ready to chat...
            </motion.p>
          </div>
        )}
        <div className="relative">
          <motion.div
            className="absolute w-full h-full z-0 flex items-center justify-center pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: isFocused ? 1 : 0 }}
            transition={{
              duration: 0.8, 
            }}
          >
            <PulsingBorder
              style={{ height: "146.5%", minWidth: "143%" }}
              colorBack="hsl(0, 0%, 0%, 0)"
              roundness={0.18}
              thickness={0}
              softness={0}
              intensity={0.1}
              bloom={1.2}
              spots={2}
              spotSize={0.25}
              pulse={0}
              smoke={0.3}
              smokeSize={0.35}
              scale={0.7}
              rotation={0}
              offsetX={0}
              offsetY={0}
              speed={1}
              colors={[
                "hsl(29, 70%, 55%)",
                "hsl(32, 75%, 65%)",
                "hsl(25, 65%, 60%)",
                "hsl(30, 70%, 65%)",
                "hsl(35, 80%, 60%)",
              ]}
            />
          </motion.div>

          <motion.div
            className="relative bg-background border rounded-3xl p-4 shadow-lg shadow-black/10 z-20 max-w-4xl mx-auto"
            animate={{
              borderColor: isFocused ? "hsl(29, 77%, 49%)" : "hsl(var(--border))",
              boxShadow: isFocused ? "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)" : "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)"
            }}
            transition={{
              duration: 0.6,
              delay: 0.1,
            }}
            style={{
              borderWidth: "1px",
              borderStyle: "solid",
            }}
          >
            {/* Message Input */}
            <div className="relative mb-6">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder={getInputPlaceholder()}
                disabled={activeModels.length === 0 || isAnyLoading}
                className="min-h-[80px] resize-none bg-transparent border-none text-foreground text-base placeholder:text-muted-foreground focus:ring-0 focus:outline-none focus-visible:ring-0 focus-visible:outline-none [&:focus]:ring-0 [&:focus]:outline-none [&:focus-visible]:ring-0 [&:focus-visible]:outline-none disabled:opacity-50"
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
              />
              
            </div>

            {/* Selected Files Display */}
            {selectedFiles.length > 0 && (
              <div className="mb-4 p-3 bg-muted/30 rounded-lg">
                <div className="text-xs text-muted-foreground mb-2">
                  {selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''} attached
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedFiles.map((file) => (
                    <div key={file.id} className="flex items-center gap-1 px-2 py-1 bg-background rounded text-xs">
                      <span>{file.name}</span>
                      <button
                        onClick={() => handleRemoveFile(file.id)}
                        className="text-muted-foreground hover:text-foreground ml-1"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Prompt Enhancement */}
            {input.trim().length > 10 && activeModels.length > 0 && (
              <div className="mb-4 flex justify-center">
                <SimplePromptEnhancer
                  originalPrompt={input}
                  onEnhancedSelect={handleEnhancedPromptSelect}
                  preferredProvider={activeModels[0]?.provider}
                />
              </div>
            )}

            <div className="flex items-center justify-between mt-4">
              {/* Left side - Empty for balance */}
              <div></div>

              {/* Status indicator */}
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
              </div>

              {/* Right side - File Upload, Send and Stop buttons */}
              <div className="flex items-center gap-2">
                <div className="relative">
                  <FileUpload
                    onFilesSelected={handleFilesSelected}
                    selectedFiles={selectedFiles}
                    onRemoveFile={handleRemoveFile}
                    disabled={activeModels.length === 0 || isAnyLoading}
                  />
                </div>
                <Button
                  onClick={handleSend}
                  size="sm"
                  disabled={!input.trim() || activeModels.length === 0 || isAnyLoading}
                  className="flex items-center justify-center w-9 h-9 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 shadow-md hover:shadow-lg transition-all duration-200 p-0 border-0 disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Send message"
                  title="Send message (Enter)"
                >
                  {isAnyLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin text-white" />
                  ) : (
                    <Send className="h-4 w-4 text-white" />
                  )}
                </Button>
                <Button
                  onClick={stopAllResponses}
                  disabled={!isAnyLoading}
                  size="sm"
                  variant={isAnyLoading ? "destructive" : "ghost"}
                  aria-label="Stop all responses"
                  title="Stop generating responses"
                  className={cn(
                    "flex items-center justify-center w-9 h-9 rounded-lg transition-all duration-200",
                    isAnyLoading 
                      ? "bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 text-white shadow-md hover:shadow-lg" 
                      : "bg-muted/50 text-muted-foreground cursor-not-allowed opacity-50 hover:bg-muted/50"
                  )}
                >
                  <Square className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
        
      </div>
    </div>
  )
}