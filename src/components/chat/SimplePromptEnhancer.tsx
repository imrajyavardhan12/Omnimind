'use client'

import React, { useState } from 'react'
import { Sparkles, Loader2, Check, X } from 'lucide-react'
import { ApiPromptEnhancer } from '@/lib/promptEnhancer/apiEnhancer'

interface SimplePromptEnhancerProps {
  originalPrompt: string
  onEnhancedSelect: (enhancedPrompt: string) => void
  preferredProvider?: string
  className?: string
}

export function SimplePromptEnhancer({ 
  originalPrompt, 
  onEnhancedSelect, 
  preferredProvider,
  className = '' 
}: SimplePromptEnhancerProps) {
  const [isEnhancing, setIsEnhancing] = useState(false)
  const [lastEnhancement, setLastEnhancement] = useState<{
    original: string
    enhanced: string
    provider: string
  } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleEnhance = async () => {
    if (!originalPrompt.trim() || isEnhancing) return
    
    setIsEnhancing(true)
    setError(null)
    
    try {
      const result = await ApiPromptEnhancer.enhance({
        originalPrompt,
        preferredProvider
      })
      
      if (result.success) {
        setLastEnhancement({
          original: originalPrompt,
          enhanced: result.enhancedPrompt,
          provider: result.provider
        })
        onEnhancedSelect(result.enhancedPrompt)
      } else {
        setError(result.error || 'Enhancement failed')
      }
    } catch (error) {
      console.error('Enhancement failed:', error)
      setError('Enhancement failed. Please try again.')
    } finally {
      setIsEnhancing(false)
    }
  }

  const handleUndo = () => {
    if (lastEnhancement) {
      onEnhancedSelect(lastEnhancement.original)
      setLastEnhancement(null)
    }
  }

  // Show success state if we just enhanced
  const showSuccess = lastEnhancement?.original === originalPrompt && 
                     lastEnhancement?.enhanced !== originalPrompt

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Main enhance button */}
      <button
        onClick={handleEnhance}
        disabled={!originalPrompt.trim() || isEnhancing || originalPrompt.length < 10}
        className="flex items-center gap-2 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isEnhancing ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Improving...
          </>
        ) : showSuccess ? (
          <>
            <Check className="w-4 h-4" />
            Enhanced!
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4" />
            Improve Prompt
          </>
        )}
      </button>

      {/* Undo button - shows after enhancement */}
      {showSuccess && (
        <button
          onClick={handleUndo}
          className="flex items-center gap-1 px-2 py-1.5 text-xs border border-border rounded-md hover:bg-accent transition-colors"
          title="Restore original prompt"
        >
          <X className="w-3 h-3" />
          Undo
        </button>
      )}

      {/* Success indicator */}
      {showSuccess && lastEnhancement && (
        <span className="text-xs text-muted-foreground">
          Enhanced with {lastEnhancement.provider}
        </span>
      )}

      {/* Error display */}
      {error && (
        <span className="text-xs text-destructive">
          {error}
        </span>
      )}
    </div>
  )
}