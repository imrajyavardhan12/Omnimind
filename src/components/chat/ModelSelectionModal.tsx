'use client'

import { useState, useEffect } from 'react'
import { X, Plus, Check, Search, Loader2, RefreshCw } from 'lucide-react'
import { useModelTabsStore } from '@/lib/stores/modelTabs'
import { Model, ProviderName } from '@/lib/types'
import { cn } from '@/lib/utils'
import { getProviderIcon } from '@/components/ui/provider-icons'
import { useDynamicModels } from '@/hooks/useDynamicModels'
import { useSettingsStore } from '@/lib/stores/settings'

interface ModelSelectionModalProps {
  isOpen: boolean
  onClose: () => void
}

interface ModelsByProvider {
  [key: string]: Model[]
}

export function ModelSelectionModal({ isOpen, onClose }: ModelSelectionModalProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [dynamicModels, setDynamicModels] = useState<Model[]>([])
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null)
  const { getAllAvailableModels, addModel, isModelSelected, canAddMore } = useModelTabsStore()
  const { providers } = useSettingsStore()
  
  // Load dynamic models for each provider
  const openaiModels = useDynamicModels('openai')
  const anthropicModels = useDynamicModels('anthropic')
  const geminiModels = useDynamicModels('gemini')
  const openrouterModels = useDynamicModels('openrouter')
  
  useEffect(() => {
    // Combine all dynamic models, use fallback if API fails
    const allDynamicModels = [
      ...(openaiModels.models.length > 0 ? openaiModels.models : getAllAvailableModels().filter(m => m.provider === 'openai')),
      ...(anthropicModels.models.length > 0 ? anthropicModels.models : getAllAvailableModels().filter(m => m.provider === 'anthropic')),
      ...(geminiModels.models.length > 0 ? geminiModels.models : getAllAvailableModels().filter(m => m.provider === 'gemini')),
      ...(openrouterModels.models.length > 0 ? openrouterModels.models : getAllAvailableModels().filter(m => m.provider === 'openrouter'))
    ]
    setDynamicModels(allDynamicModels)
  }, [openaiModels.models, anthropicModels.models, geminiModels.models, openrouterModels.models])
  
  // Use dynamic models if available, otherwise use fallback
  const allModels = dynamicModels.length > 0 ? dynamicModels : getAllAvailableModels()
  
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

  const isProviderLoading = (provider: string) => {
    switch (provider) {
      case 'openai': return openaiModels.loading
      case 'anthropic': return anthropicModels.loading
      case 'gemini': return geminiModels.loading
      case 'openrouter': return openrouterModels.loading
      default: return false
    }
  }

  const refreshProvider = async (provider: ProviderName) => {
    setLoadingProvider(provider)
    // The useDynamicModels hook will automatically refresh when the component re-renders
    // We can force a refresh by clearing and re-setting the API key
    const { getApiKey } = useSettingsStore.getState()
    const apiKey = getApiKey(provider)
    if (apiKey) {
      // Trigger a re-fetch by updating a state
      setLoadingProvider(null)
    }
  }

  const handleAddModel = (model: Model) => {
    if (!canAddMore()) return
    addModel(model)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-background border border-border rounded-lg shadow-lg w-full max-w-4xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-semibold">Add Model</h2>
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
                    {hasApiKey && (
                      <button
                        onClick={() => refreshProvider(provider as ProviderName)}
                        className="ml-auto p-1 hover:bg-accent rounded-md transition-colors"
                        title="Refresh models"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                    )}
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
  )
}
