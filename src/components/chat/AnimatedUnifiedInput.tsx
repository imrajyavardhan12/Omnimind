'use client'

import { useState, useRef } from 'react'
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

interface AnimatedUnifiedInputProps {
  className?: string
}

export function AnimatedUnifiedInput({ className }: AnimatedUnifiedInputProps) {
  const [input, setInput] = useState('')
  const [isFocused, setIsFocused] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<FileAttachment[]>([])
  const { providers } = useSettingsStore()
  const { createSession, activeSessionId, isLoading, setAbortController, stopAllResponses } = useChatStore()
  const { selectedModels } = useModelTabsStore()
  const { preferences, addToHistory } = useEnhancementStore()
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
    if (!input.trim() || activeModels.length === 0 || isAnyLoading) return

    // Create session if none exists
    let sessionId = activeSessionId
    if (!sessionId) {
      sessionId = createSession()
    }

    const message = input.trim()
    setInput('')

    // Add user message with active models tracking and attachments
    const { addMessage } = useChatStore.getState()
    const userMessage = {
      id: crypto.randomUUID(),
      role: 'user' as const,
      content: message,
      timestamp: Date.now(),
      // Track which models are currently active for this message
      activeModels: activeModels.map(sm => `${sm.provider}:${sm.model.id}`),
      attachments: selectedFiles.length > 0 ? selectedFiles : undefined
    }
    addMessage(sessionId, userMessage)
    
    // Clear selected files after sending
    setSelectedFiles([])

    // Send to each model individually with direct API calls
    const sendPromises = activeModels.map(async (selectedModel) => {
      // Create unique key for this model instance
      const modelKey = `${selectedModel.provider}-${selectedModel.model.id}-${Date.now()}`
      const assistantMessageId = crypto.randomUUID()
      
      // Track active request
      activeRequestsRef.current.add(modelKey)
      
      let fullContent = ''
      
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
    <div className={cn('flex flex-col items-center justify-center p-4', className)}>
      <div className="w-full max-w-4xl relative">
        <div className="flex flex-row items-center mb-2">
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
            {activeModels.length > 0 
              ? `Ready to compare ${activeModels.length} model${activeModels.length !== 1 ? 's' : ''}...`
              : 'Add models above to start comparing AI responses'
            }
          </motion.p>
        </div>

        <div className="relative">
          <motion.div
            className="absolute w-full h-full z-0 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: isFocused ? 1 : 0 }}
            transition={{
              duration: 0.8, 
            }}
          >
            <PulsingBorder
              style={{ height: "146.5%", minWidth: "143%" }}
              colorBack="hsl(var(--background))"
              roundness={0.18}
              thickness={0}
              softness={0}
              intensity={0.2}
              bloom={1.8}
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
            className="relative bg-background border rounded-2xl p-4 z-10"
            animate={{
              borderColor: isFocused ? "hsl(29, 77%, 49%)" : "hsl(var(--border))",
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