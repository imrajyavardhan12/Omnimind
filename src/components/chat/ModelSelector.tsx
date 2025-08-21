'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import { ProviderName, Model } from '@/lib/types'
import { useSettingsStore } from '@/lib/stores/settings'
import { cn } from '@/lib/utils'

// Import all provider models
import { openaiModels } from '@/lib/providers/openai'
import { anthropicModels } from '@/lib/providers/anthropic'
import { geminiModels } from '@/lib/providers/gemini'
import { openrouterModels } from '@/lib/providers/openrouter'

interface ModelSelectorProps {
  provider: ProviderName
  className?: string
}

const providerModels = {
  openai: openaiModels,
  anthropic: anthropicModels,
  gemini: geminiModels,
  openrouter: openrouterModels
}

export function ModelSelector({ provider, className }: ModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const { selectedModels, setSelectedModel } = useSettingsStore()
  
  const models = providerModels[provider]
  const selectedModelId = selectedModels[provider]
  const selectedModel = models.find(model => model.id === selectedModelId) || models[0]

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleModelSelect = (modelId: string) => {
    setSelectedModel(provider, modelId)
    setIsOpen(false)
  }

  return (
    <div className={cn('relative', className)} ref={dropdownRef}>
      {/* Selected Model Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent/50 rounded transition-colors"
        title={`Current model: ${selectedModel.name}`}
      >
        <span className="truncate max-w-[120px]">
          {selectedModel.name}
        </span>
        <ChevronDown className={cn(
          'w-3 h-3 transition-transform',
          isOpen && 'rotate-180'
        )} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-popover border border-border rounded-md shadow-lg z-50 max-h-80 overflow-y-auto">
          <div className="p-2 border-b border-border">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {provider} Models
            </div>
          </div>
          
          <div className="py-1">
            {models.map((model) => (
              <button
                key={model.id}
                onClick={() => handleModelSelect(model.id)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-accent transition-colors',
                  selectedModelId === model.id && 'bg-accent'
                )}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {model.name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {model.contextLength.toLocaleString()} tokens • ${model.inputCost}/1K in • ${model.outputCost}/1K out
                  </div>
                </div>
                
                {selectedModelId === model.id && (
                  <Check className="w-4 h-4 text-primary flex-shrink-0" />
                )}
              </button>
            ))}
          </div>
          
          {provider === 'openrouter' && (
            <div className="p-2 border-t border-border">
              <div className="text-xs text-muted-foreground">
                OpenRouter provides access to models from multiple providers
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}