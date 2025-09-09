'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { Send, Settings, RotateCcw, Loader2, Square, ChevronUp, ChevronDown } from 'lucide-react'
import { LiquidMetal, PulsingBorder } from "@paper-design/shaders-react"
import { motion } from "framer-motion"
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { MarkdownRenderer } from './MarkdownRenderer'
import { SimplePromptEnhancer } from './SimplePromptEnhancer'
import { SessionStats } from './SessionStats'
import { SingleModelSelector } from './SingleModelSelector'
import { useViewModeStore } from '@/lib/stores/viewMode'
import { useModelTabsStore } from '@/lib/stores/modelTabs'
import { useSettingsStore } from '@/lib/stores/settings'
import { useChatStore } from '@/lib/stores/chat'
import { useChat } from '@/hooks/useChat'
import { useIsClient } from '@/hooks/useIsClient'
import { Message } from '@/lib/types'
import { cn } from '@/lib/utils'

interface SingleChatInterfaceProps {
  className?: string
}

export function SingleChatInterface({ className }: SingleChatInterfaceProps) {
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const isClient = useIsClient()

  const { selectedSingleModel, setSelectedSingleModel, incrementModelUsage, viewMode, isHeaderVisible, setIsHeaderVisible, toggleHeaderVisibility } = useViewModeStore()
  const { getAllAvailableModels } = useModelTabsStore()
  const { providers, getApiKey } = useSettingsStore()
  const { getActiveSession, createSession, activeSessionId, stopAllResponses } = useChatStore()

  // Get available models from enabled providers
  const availableModels = getAllAvailableModels().filter(model => {
    const provider = providers[model.provider as keyof typeof providers]
    return provider?.enabled && getApiKey(model.provider as any)
  })

  // Auto-select most used model on first load
  useEffect(() => {
    if (!selectedSingleModel && availableModels.length > 0) {
      // For now, just select the first available model
      // Later we can implement most-used logic
      setSelectedSingleModel(availableModels[0])
    }
  }, [selectedSingleModel, availableModels, setSelectedSingleModel])

  // Get current session messages
  const currentSession = getActiveSession()
  const messages = useMemo(() => currentSession?.messages || [], [currentSession?.messages])

  // Set up chat hook
  const { sendMessage, isStreaming } = useChat({
    provider: selectedSingleModel?.provider as any,
    modelIdOverride: selectedSingleModel?.id,
    skipAddingUserMessage: false,
    onMessage: (message: Message) => {
      setIsTyping(false)
    },
    onError: (error: Error) => {
      setIsTyping(false)
    }
  })

  // Auto-scroll to bottom - only scroll within messages container, prevent page scroll
  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      // Find the scrollable messages container
      const scrollContainer = messagesEndRef.current.closest('.overflow-y-auto')
      if (scrollContainer) {
        // Scroll only within the container, not the page
        scrollContainer.scrollTo({
          top: scrollContainer.scrollHeight,
          behavior: 'smooth'
        })
      }
    }
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, isTyping])

  // Auto-hide header during response generation
  useEffect(() => {
    if (isStreaming && messages.length > 0) {
      setIsHeaderVisible(false)
    }
  }, [isStreaming, messages.length, setIsHeaderVisible])

  // Use the shared toggle function from the store
  const toggleHeader = toggleHeaderVisibility

  // Handle send message
  const handleSend = async () => {
    if (!input.trim() || !selectedSingleModel || isStreaming) return

    const userInput = input.trim()
    setInput('')
    setIsTyping(true)

    // Create session if none exists
    if (!activeSessionId) {
      createSession()
    }

    try {
      await sendMessage(userInput)
      incrementModelUsage(selectedSingleModel.id)
    } catch (error) {
      console.error('Failed to send message:', error)
      setIsTyping(false)
    }
  }

  // Handle key press
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Handle enhanced prompt selection
  const handleEnhancedPromptSelect = (enhancedPrompt: string) => {
    setInput(enhancedPrompt)
  }

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px'
    }
  }, [input])

  // Show loading state until client hydration is complete
  if (!isClient) {
    return (
      <div className={cn("flex flex-col h-full", className)}>
        {/* Session Stats */}
        <div className="px-6 py-4">
          <div className="h-8 bg-muted/20 rounded animate-pulse" />
        </div>

        {/* Model Selection Bar */}
        <div className="h-16 bg-muted/10 animate-pulse" />

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <div className="flex items-center justify-center h-full text-center">
            <div className="space-y-4 max-w-md">
              <div className="text-6xl">💭</div>
              <div>
                <h3 className="text-xl font-medium text-foreground mb-2">
                  How can I help you today?
                </h3>
                <p className="text-muted-foreground text-sm">
                  Ask me anything - I&apos;m powered by AI
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Input Area Placeholder */}
        <div className="p-6">
          <div className="w-full max-w-4xl mx-auto">
            <div className="h-32 bg-muted/20 rounded-2xl animate-pulse" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={cn("relative h-full", className)}>
      {/* Collapsible Header */}
      <motion.div
        initial={false}
        animate={{
          maxHeight: (viewMode === 'single' && isHeaderVisible) ? "300px" : "0px",
          opacity: (viewMode === 'single' && isHeaderVisible) ? 1 : 0
        }}
        transition={{
          duration: 0.2,
          ease: [0.4, 0, 0.2, 1]
        }}
        className="relative z-10 overflow-hidden bg-background"
      >
        {/* Session Stats */}
        <div className="px-6 py-4">
          <SessionStats />
        </div>

        {/* Model Selection Bar */}
        <SingleModelSelector />
      </motion.div>

      {/* Header Toggle Button - Always visible */}
      <div className="relative z-10 flex justify-center py-2 border-b border-border/20 bg-background">
        <button
          onClick={toggleHeader}
          className="flex items-center gap-2 px-3 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-muted/50"
        >
          {isHeaderVisible ? (
            <>
              <ChevronUp className="w-3 h-3" />
              Hide Controls
            </>
          ) : (
            <>
              <ChevronDown className="w-3 h-3" />
              Show Controls
            </>
          )}
        </button>
      </div>

      {/* Messages area - Full height with bottom padding for input */}
      <div 
        className="absolute inset-0 overflow-y-auto"
        style={{
          paddingTop: isHeaderVisible ? '120px' : '48px',
          paddingBottom: '200px'
        }}
      >
        <div className="p-4 space-y-6 min-h-full">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-center">
              <div className="space-y-4 max-w-md">
                <div className="text-6xl">💭</div>
                <div>
                  <h3 className="text-xl font-medium text-foreground mb-2">
                    How can I help you today?
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    Ask me anything - I&apos;m powered by AI
                  </p>
                </div>
              </div>
            </div>
        ) : (
          <>
            {messages.map((message) => (
              <div
                key={message.id}
                className="py-6 px-4 flex justify-center"
              >
                <div className={cn(
                  "max-w-4xl w-full rounded-2xl p-6 shadow-sm",
                  message.role === 'user' 
                    ? "bg-muted/30 border border-border/50" 
                    : "bg-background border border-border/30"
                )}>
                  {message.role === 'user' ? (
                    <div className="text-foreground whitespace-pre-wrap leading-relaxed">
                      {message.content}
                    </div>
                  ) : (
                    <MarkdownRenderer content={message.content} />
                  )}
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {isTyping && (
              <div className="py-6 px-4 flex justify-center">
                <div className="max-w-4xl w-full rounded-2xl p-6 shadow-sm bg-background border border-border/30">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{animationDelay: '0s'}}></div>
                      <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                      <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                    </div>
                    <span className="text-sm ml-2">Thinking...</span>
                  </div>
                </div>
              </div>
            )}
          </>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Animated Input Area - Absolutely positioned at bottom */}
      <div className="absolute bottom-0 left-0 right-0 z-20 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-3xl relative">
          {messages.length === 0 && (
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
                borderColor: isFocused ? "hsl(29, 77%, 49%)" : "hsl(214, 13%, 12%)",
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
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder={
                    selectedSingleModel 
                      ? `Message ${selectedSingleModel.name}...`
                      : "Configure an API key to start chatting..."
                  }
                  disabled={!selectedSingleModel || isStreaming}
                  className="min-h-[80px] resize-none bg-transparent border-none text-foreground text-base placeholder:text-muted-foreground focus:ring-0 focus:outline-none focus-visible:ring-0 focus-visible:outline-none [&:focus]:ring-0 [&:focus]:outline-none [&:focus-visible]:ring-0 [&:focus-visible]:outline-none disabled:opacity-50"
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                />
              </div>

              {/* Prompt Enhancement */}
              {input.trim().length > 10 && selectedSingleModel && (
                <div className="mb-4 flex justify-center">
                  <SimplePromptEnhancer
                    originalPrompt={input}
                    onEnhancedSelect={handleEnhancedPromptSelect}
                    preferredProvider={selectedSingleModel.provider}
                  />
                </div>
              )}

              <div className="flex items-center justify-between mt-4">
                {/* Left side - Model info */}
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  {selectedSingleModel && (
                    <>
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                      <span>{selectedSingleModel.name} ready</span>
                    </>
                  )}
                </div>

                {/* Help text */}
                <div className="text-xs text-muted-foreground">
                  {selectedSingleModel && "Press Enter to send, Shift+Enter for new line"}
                </div>

                {/* Right side - Send and Stop buttons */}
                <div className="flex items-center gap-2">
                  <Button
                    onClick={handleSend}
                    size="sm"
                    disabled={!input.trim() || !selectedSingleModel || isStreaming}
                    className="flex items-center justify-center w-9 h-9 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 shadow-md hover:shadow-lg transition-all duration-200 p-0 border-0 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isStreaming ? (
                      <Loader2 className="h-4 w-4 animate-spin text-white" />
                    ) : (
                      <Send className="h-4 w-4 text-white" />
                    )}
                  </Button>
                  <Button
                    onClick={stopAllResponses}
                    disabled={!isStreaming}
                    size="sm"
                    variant={isStreaming ? "destructive" : "ghost"}
                    className={cn(
                      "flex items-center justify-center w-9 h-9 rounded-lg transition-all duration-200",
                      isStreaming 
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
    </div>
  )
}