'use client'

import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Send, Square, Loader2, Users, RotateCcw, ChevronUp, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { CouncilModelSelector } from './CouncilModelSelector'
import { CouncilStage1 } from './CouncilStage1'
import { CouncilStage2 } from './CouncilStage2'
import { CouncilStage3 } from './CouncilStage3'
import { useCouncil } from '@/hooks/useCouncil'
import { useCouncilStore } from '@/lib/stores/council'
import { useViewModeStore } from '@/lib/stores/viewMode'
import { useIsClient } from '@/hooks/useIsClient'
import { cn } from '@/lib/utils'

interface CouncilInterfaceProps {
  className?: string
}

export function CouncilInterface({ className }: CouncilInterfaceProps) {
  const [input, setInput] = useState('')
  const [isFocused, setIsFocused] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const stagesRef = useRef<HTMLDivElement>(null)
  const isClient = useIsClient()

  const { councilModels, chairmanModel, currentSession, runCouncil, stopAllResponses, isReady } = useCouncil()
  const { resetSession } = useCouncilStore()
  const { isHeaderVisible, toggleHeaderVisibility } = useViewModeStore()

  const isRunning = currentSession !== null && currentSession.stage !== 'idle' && currentSession.stage !== 'complete'

  // Auto-scroll to latest stage
  useEffect(() => {
    if (stagesRef.current && currentSession) {
      stagesRef.current.scrollTo({
        top: stagesRef.current.scrollHeight,
        behavior: 'smooth'
      })
    }
  }, [currentSession, currentSession?.stage])

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px'
    }
  }, [input])

  const handleSubmit = async () => {
    if (!input.trim() || !isReady || isRunning) return
    
    setError(null)
    const query = input.trim()
    setInput('')
    
    try {
      await runCouncil(query)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleReset = () => {
    resetSession()
    setError(null)
  }

  if (!isClient) {
    return (
      <div className={cn("flex flex-col h-full", className)}>
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-pulse text-muted-foreground">Loading Council...</div>
        </div>
      </div>
    )
  }

  return (
    <div className={cn("relative h-full flex flex-col", className)}>
      {/* Collapsible Header */}
      <motion.div
        initial={false}
        animate={{
          maxHeight: isHeaderVisible ? "300px" : "0px",
          opacity: isHeaderVisible ? 1 : 0
        }}
        transition={{
          duration: 0.2,
          ease: [0.4, 0, 0.2, 1]
        }}
        className="relative z-10 overflow-hidden bg-background border-b border-border"
      >
        <div className="px-6 py-4">
          {/* Header Info */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center">
              <Users className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">LLM Council</h2>
              <p className="text-sm text-muted-foreground">
                Multiple AI models debate and synthesize the best answer
              </p>
            </div>
          </div>

          {/* Model Selector */}
          <CouncilModelSelector />
        </div>
      </motion.div>

      {/* Header Toggle Button */}
      <div className="relative z-10 flex justify-center py-2 border-b border-border/20 bg-background">
        <button
          onClick={toggleHeaderVisibility}
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

      {/* Main Content Area */}
      <div 
        ref={stagesRef}
        className="flex-1 overflow-y-auto pb-48"
        style={{
          paddingTop: '1rem'
        }}
      >
        <div className="max-w-4xl mx-auto px-4 space-y-6">
          {/* Empty State */}
          {!currentSession && (
            <div className="flex items-center justify-center min-h-[300px]">
              <div className="text-center space-y-4 max-w-md">
                <div className="text-6xl">🏛️</div>
                <h3 className="text-xl font-medium text-foreground">
                  Convene the Council
                </h3>
                <p className="text-muted-foreground text-sm">
                  Select at least 2 AI models above, then ask a question. 
                  The council will debate and synthesize the best answer.
                </p>
                {!isReady && (
                  <p className="text-amber-500 text-sm">
                    {councilModels.length < 2 
                      ? `Add ${2 - councilModels.length} more model${councilModels.length === 1 ? '' : 's'} to start`
                      : !chairmanModel 
                        ? 'Select a chairman model'
                        : ''}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Session Content */}
          {currentSession && (
            <div className="space-y-6">
              {/* Query Display */}
              <div className="p-4 bg-muted/30 rounded-lg border border-border">
                <div className="text-xs text-muted-foreground mb-1">Question</div>
                <div className="font-medium">{currentSession.query}</div>
              </div>

              {/* Stage 1 */}
              {currentSession.stage1Responses.length > 0 && (
                <CouncilStage1 
                  responses={currentSession.stage1Responses}
                  isActive={currentSession.stage === 'stage1'}
                />
              )}

              {/* Stage 2 */}
              {(currentSession.stage === 'stage2' || 
                currentSession.stage === 'stage3' || 
                currentSession.stage === 'complete') && (
                <CouncilStage2
                  rankings={currentSession.stage2Rankings}
                  aggregateRankings={currentSession.aggregateRankings}
                  isActive={currentSession.stage === 'stage2'}
                  totalModels={currentSession.councilModels.length}
                />
              )}

              {/* Stage 3 */}
              {(currentSession.stage === 'stage3' || currentSession.stage === 'complete') && (
                <CouncilStage3
                  synthesis={currentSession.stage3Synthesis}
                  isLoading={currentSession.stage3Loading}
                  chairmanModel={currentSession.chairmanModel}
                  isActive={currentSession.stage === 'stage3'}
                />
              )}
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-500 text-sm">
              {error}
            </div>
          )}
        </div>
      </div>

      {/* Input Area - Fixed at bottom */}
      <div className="absolute bottom-0 left-0 right-0 z-20 p-6 bg-gradient-to-t from-background via-background to-transparent">
        <div className="max-w-3xl mx-auto">
          <div
            className={cn(
              "relative bg-background border rounded-2xl p-4 shadow-lg transition-colors duration-200",
              isFocused ? "border-purple-500" : "border-border"
            )}
          >
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyPress}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder={
                !isReady 
                  ? "Configure council members above to start..."
                  : isRunning 
                    ? "Council is deliberating..."
                    : "Ask the council a question..."
              }
              disabled={!isReady || isRunning}
              className="min-h-[60px] max-h-[120px] resize-none bg-transparent border-none text-foreground text-base placeholder:text-muted-foreground focus:ring-0 focus:outline-none focus-visible:ring-0 disabled:opacity-50"
            />

            <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50">
              {/* Left side info */}
              <div className="text-xs text-muted-foreground">
                {isReady ? (
                  <span>{councilModels.length} models • {chairmanModel?.name} as chairman</span>
                ) : (
                  <span className="text-amber-500">Configure council above</span>
                )}
              </div>

              {/* Right side buttons */}
              <div className="flex items-center gap-2">
                {currentSession && (
                  <Button
                    onClick={handleReset}
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <RotateCcw className="w-4 h-4 mr-1" />
                    Reset
                  </Button>
                )}
                
                {isRunning ? (
                  <Button
                    onClick={stopAllResponses}
                    size="sm"
                    className="bg-red-500 hover:bg-red-600 text-white"
                  >
                    <Square className="w-4 h-4 mr-1" />
                    Stop
                  </Button>
                ) : (
                  <Button
                    onClick={handleSubmit}
                    size="sm"
                    disabled={!input.trim() || !isReady}
                    className="bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white"
                  >
                    {isRunning ? (
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4 mr-1" />
                    )}
                    Consult Council
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
