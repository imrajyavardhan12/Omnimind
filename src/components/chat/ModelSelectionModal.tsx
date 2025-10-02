'use client'

import { useState, useEffect } from 'react'
import { X, Plus, Check, Search, Loader2 } from 'lucide-react'
import { useModelTabsStore } from '@/lib/stores/modelTabs'
import { Model, ProviderName } from '@/lib/types'
import { cn } from '@/lib/utils'
import { getProviderIcon } from '@/components/ui/provider-icons'
import { useSettingsStore } from '@/lib/stores/settings'
import { Portal } from '@/components/ui/portal'
import { 
  openaiVerifiedModels, 
  anthropicVerifiedModels, 
  geminiVerifiedModels, 
  openrouterVerifiedModels 
} from '@/lib/models/verified-models'

interface ModelSelectionModalProps {
  isOpen: boolean
  onClose: () => void
  onModelSelect?: (model: Model) => void
  singleMode?: boolean
}

interface ModelsByProvider {
  [key: string]: Model[]
}

export function ModelSelectionModal({ isOpen, onClose, onModelSelect, singleMode = false }: ModelSelectionModalProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null)
  const { getAllAvailableModels, addModel, isModelSelected, canAddMore } = useModelTabsStore()
  const { providers } = useSettingsStore()
  
  // Use verified models instead of dynamic API fetching
  const allModels = getAllAvailableModels()
  
  // Group models by provider
  const modelsByProvider: ModelsByProvider = allModels.reduce((acc, model) => {
    if (!acc[model.provider]) {
      acc[model.provider] = []
    }
    acc[model.provider].push(model)
    return acc
  }, {} as ModelsByProvider)

  // Filter models based on search
  const filteredModelsByProvider = Object.entries(modelsByProvider).reduce((acc, [provider, models]) => {
    const filteredModels = models.filter(model =>
      model.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      model.id.toLowerCase().includes(searchQuery.toLowerCase())
    )
    if (filteredModels.length > 0) {
      acc[provider] = filteredModels
    }
    return acc
  }, {} as ModelsByProvider)

  const getProviderDisplayName = (provider: string) => {
    switch (provider) {
      case 'openai': return 'OpenAI'
      case 'anthropic': return 'Anthropic'
      case 'gemini': return 'Google Gemini'
      case 'openrouter': return 'OpenRouter'
      default: return provider
    }
  }

  // No loading needed - models are now static/verified
  const isProviderLoading = (provider: string) => false

  const handleAddModel = (model: Model) => {
    if (singleMode) {
      // For single mode, call the onModelSelect callback
      onModelSelect?.(model)
    } else {
      // For compare mode, add to model tabs
      if (!canAddMore()) return
      addModel(model)
    }
    onClose()
  }

  if (!isOpen) return null

  return (
    <Portal>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]">
      <div className="bg-background border border-border rounded-lg shadow-lg w-full max-w-4xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-semibold">{singleMode ? 'Select Model' : 'Add Model'}</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-accent rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="p-6 border-b border-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search models..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        {/* Models by Provider */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {Object.entries(filteredModelsByProvider).map(([provider, models]) => {
              const isLoading = isProviderLoading(provider)
              const hasApiKey = providers[provider as ProviderName]?.apiKey
              
              return (
                <div key={provider}>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6">{getProviderIcon(provider, "w-6 h-6")}</div>
                    <h3 className="text-lg font-semibold">{getProviderDisplayName(provider)}</h3>
                    <span className="text-sm text-muted-foreground">({models.length} models)</span>
                    {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}

                  </div>
                  
                  {!hasApiKey && (
                    <div className="mb-3 p-3 bg-muted/50 rounded-md text-sm text-muted-foreground">
                      Configure API key in Settings to see available models
                    </div>
                  )}
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {models.map((model) => {
                      const selected = isModelSelected(model.id)
                      const canAdd = canAddMore() || selected
                      const isFree = model.name.includes('FREE') || model.inputCost === 0
                      
                      return (
                        <div
                          key={model.id}
                          className={cn(
                            'p-4 border rounded-lg transition-all',
                            selected 
                              ? 'border-primary bg-primary/5' 
                              : canAdd
                              ? 'border-border hover:border-primary/50 hover:bg-accent/50 cursor-pointer'
                              : 'border-muted bg-muted/30 cursor-not-allowed opacity-50'
                          )}
                          onClick={() => canAdd && !selected && handleAddModel(model)}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm mb-1 truncate">
                                {model.name}
                                {isFree && (
                                  <span className="ml-2 px-2 py-1 bg-green-500/10 text-green-500 text-xs rounded">
                                    FREE
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground mb-2">
                                {model.contextLength.toLocaleString()} tokens
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {isFree ? (
                                  <span className="text-green-500">Free to use</span>
                                ) : (
                                  <span>${model.inputCost}/1K in • ${model.outputCost}/1K out</span>
                                )}
                              </div>
                            </div>
                            
                            <div className="ml-3 flex-shrink-0">
                              {selected ? (
                                <div className="p-1 rounded-full bg-primary text-primary-foreground">
                                  <Check className="w-4 h-4" />
                                </div>
                              ) : canAdd ? (
                                <div className="p-1 rounded-full border border-primary text-primary hover:bg-primary hover:text-primary-foreground transition-colors">
                                  <Plus className="w-4 h-4" />
                                </div>
                              ) : (
                                <div className="p-1 rounded-full bg-muted text-muted-foreground">
                                  <X className="w-4 h-4" />
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-border">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Select up to 5 models to compare</span>
            <span>{Object.values(filteredModelsByProvider).flat().length} models available</span>
          </div>
        </div>
      </div>
      </div>
    </Portal>
  )
}
