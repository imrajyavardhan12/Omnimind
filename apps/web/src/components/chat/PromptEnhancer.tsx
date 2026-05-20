'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Sparkles, ChevronDown, ChevronUp, Copy, Check, Wand2, TrendingUp } from 'lucide-react'
import { PromptEnhancer } from '@/lib/promptEnhancer'
import { PromptEnhancementResponse, EnhancedPrompt } from '@/lib/promptEnhancer/types'

interface PromptEnhancerProps {
  originalPrompt: string
  onEnhancedSelect: (enhancedPrompt: string) => void
  targetProviders?: string[]
  className?: string
}

export function PromptEnhancerComponent({ 
  originalPrompt, 
  onEnhancedSelect, 
  targetProviders = [],
  className = '' 
}: PromptEnhancerProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [enhancement, setEnhancement] = useState<PromptEnhancementResponse | null>(null)
  const [selectedEnhancement, setSelectedEnhancement] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [isEnhancing, setIsEnhancing] = useState(false)

  const handleEnhance = useCallback(async () => {
    if (!originalPrompt.trim()) return
    
    setIsEnhancing(true)
    try {
      const result = PromptEnhancer.enhance({
        originalPrompt,
        targetProviders
      })
      setEnhancement(result)
      
      // Auto-expand if prompt quality is low
      if (result.analysis.qualityScore < 60) {
        setIsExpanded(true)
      }
    } catch (error) {
      console.error('Enhancement failed:', error)
    } finally {
      setIsEnhancing(false)
    }
  }, [originalPrompt, targetProviders])

  // Auto-enhance when component is first shown
  useEffect(() => {
    if (originalPrompt.trim() && originalPrompt.length > 10) {
      handleEnhance()
      setIsExpanded(true) // Always expand when manually opened
    } else {
      setEnhancement(null)
    }
  }, [originalPrompt, targetProviders, handleEnhance])

  const handleSelectEnhancement = (enhanced: EnhancedPrompt) => {
    setSelectedEnhancement(enhanced.id)
    onEnhancedSelect(enhanced.content)
    setIsExpanded(false)
  }

  const handleCopyToClipboard = async (content: string, id: string) => {
    try {
      await navigator.clipboard.writeText(content)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch (error) {
      console.error('Copy failed:', error)
    }
  }

  const getQualityColor = (score: number) => {
    if (score >= 80) return 'text-green-600'
    if (score >= 60) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getQualityBadge = (score: number) => {
    if (score >= 80) return { label: 'Excellent', color: 'bg-green-100 text-green-800' }
    if (score >= 60) return { label: 'Good', color: 'bg-yellow-100 text-yellow-800' }
    return { label: 'Needs Work', color: 'bg-red-100 text-red-800' }
  }

  if (!enhancement) {
    return (
      <div className={`border rounded-lg p-3 bg-muted/30 ${className}`}>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Sparkles className="w-4 h-4" />
          <span>Type a prompt to get enhancement suggestions...</span>
        </div>
      </div>
    )
  }

  const qualityBadge = getQualityBadge(enhancement.analysis.qualityScore)

  return (
    <div className={`border rounded-lg bg-background ${className}`}>
      {/* Header */}
      <div className="p-3 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Wand2 className="w-4 h-4 text-purple-600" />
              <span className="font-medium text-sm">Prompt Enhancement</span>
            </div>
            
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${qualityBadge.color}`}>
                {qualityBadge.label}
              </span>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <TrendingUp className="w-3 h-3" />
                <span>{enhancement.analysis.qualityScore}/100</span>
              </div>
            </div>
          </div>
          
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1 px-2 py-1 text-xs border rounded hover:bg-accent"
            disabled={isEnhancing}
          >
            {isEnhancing ? (
              'Enhancing...'
            ) : isExpanded ? (
              <>Hide <ChevronUp className="w-3 h-3" /></>
            ) : (
              <>Show {enhancement.enhancements.length} suggestions <ChevronDown className="w-3 h-3" /></>
            )}
          </button>
        </div>

        {/* Quick Analysis Summary */}
        {enhancement.analysis.issues.length > 0 && (
          <div className="mt-2 text-xs text-muted-foreground">
            <span className="font-medium">Detected issues:</span> {enhancement.analysis.issues.slice(0, 2).join(', ')}
            {enhancement.analysis.issues.length > 2 && '...'}
          </div>
        )}
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="p-3 space-y-3">
          {/* Analysis Details */}
          <div className="bg-muted/50 rounded-lg p-3 text-sm">
            <div className="font-medium mb-2">Analysis</div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-muted-foreground">Type:</span> {enhancement.analysis.type}
              </div>
              <div>
                <span className="text-muted-foreground">Words:</span> {enhancement.analysis.wordCount}
              </div>
              <div>
                <span className="text-muted-foreground">Context:</span> {enhancement.analysis.hasContext ? 'Yes' : 'No'}
              </div>
              <div>
                <span className="text-muted-foreground">Constraints:</span> {enhancement.analysis.hasConstraints ? 'Yes' : 'No'}
              </div>
            </div>
          </div>

          {/* Enhancement Options */}
          <div className="space-y-3">
            <div className="text-sm font-medium text-foreground mb-3">
              📝 Choose an enhanced version to improve your prompt:
            </div>
            {enhancement.enhancements.map((enhanced) => (
              <div 
                key={enhanced.id} 
                className={`border rounded-lg p-3 transition-colors ${
                  selectedEnhancement === enhanced.id 
                    ? 'border-primary bg-primary/5' 
                    : 'hover:border-border'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium text-sm">{enhanced.title}</h4>
                      <span className="text-xs text-muted-foreground">
                        +{Math.round(enhanced.qualityScore - enhancement.analysis.qualityScore)} quality
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">{enhanced.description}</p>
                  </div>
                  
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleCopyToClipboard(enhanced.content, enhanced.id)}
                      className="p-1 hover:bg-accent rounded text-muted-foreground hover:text-foreground"
                      title="Copy to clipboard"
                    >
                      {copiedId === enhanced.id ? (
                        <Check className="w-3 h-3 text-green-600" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Preview */}
                <div className="bg-muted/50 rounded p-2 text-xs font-mono mb-2 max-h-20 overflow-y-auto">
                  {enhanced.content.length > 200 
                    ? `${enhanced.content.substring(0, 200)}...`
                    : enhanced.content
                  }
                </div>

                {/* Improvements */}
                {enhanced.improvements.length > 0 && (
                  <div className="mb-3">
                    <div className="text-xs font-medium text-muted-foreground mb-1">Improvements:</div>
                    <div className="flex flex-wrap gap-1">
                      {enhanced.improvements.slice(0, 3).map((improvement, idx) => (
                        <span 
                          key={idx}
                          className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-primary/10 text-primary"
                        >
                          {improvement}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  onClick={() => handleSelectEnhancement(enhanced)}
                  className="w-full py-2 px-3 bg-primary text-primary-foreground rounded text-sm font-medium hover:bg-primary/90 transition-colors"
                >
                  ✓ Select This Version
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}