'use client'

import { useState } from 'react'
import { X, Plus, Check, Search, Loader2, AlertCircle } from 'lucide-react'
import { useModelTabsStore } from '@/lib/stores/modelTabs'
import { Model, ProviderName } from '@/lib/types'
import { cn } from '@/lib/utils'
import { getProviderIcon, getProviderDisplayName } from '@/components/ui/provider-icons'
import { useSettingsStore } from '@/lib/stores/settings'
import { Portal } from '@/components/ui/portal'
import type { VerifiedModel } from '@/lib/models/verified-models'
import { useAvailableModels } from '@/features/models/hooks/useModels'
import { ModelBadges } from './ModelBadges'

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
  const { addModel, isModelSelected, canAddMore } = useModelTabsStore()
  const { providers } = useSettingsStore()
  const { models: allModels, isLoading, error } = useAvailableModels({ enabledOnly: true })
  
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

  const handleAddModel = (model: Model) => {
    if (singleMode) {
      onModelSelect?.(model)
    } else {
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
          {isLoading && (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading model catalog...
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
              <AlertCircle className="w-4 h-4" />
              Failed to load model catalog. Try again after checking your session and API server.
            </div>
          )}

          {!isLoading && !error && Object.keys(filteredModelsByProvider).length === 0 && (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No models found.
            </div>
          )}

          {!isLoading && !error && (
            <div className="space-y-6">
              {Object.entries(filteredModelsByProvider).map(([provider, models]) => {
              const providerConfig = providers[provider as ProviderName]
              const hasProviderAccess = Boolean(providerConfig?.apiKey || providerConfig?.isFree)
              
              return (
                <div key={provider}>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6">{getProviderIcon(provider, "w-6 h-6")}</div>
                    <h3 className="text-lg font-semibold">{getProviderDisplayName(provider)}</h3>
                    <span className="text-sm text-muted-foreground">({models.length} models)</span>
                  </div>
                  
                  {!hasProviderAccess && (
                    <div className="mb-3 p-3 bg-muted/50 rounded-md text-sm text-muted-foreground">
                      Configure API key in Settings before selecting these models
                    </div>
                  )}
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {models.map((model) => {
                      const selected = isModelSelected(model.id, model.provider)
                      const canSelect = hasProviderAccess && (singleMode || canAddMore() || selected)
                      const isFree = Boolean(providerConfig?.isFree) || model.name.includes('FREE') || model.inputCost === 0
                      const verifiedModel = model as VerifiedModel
                      
                      return (
                        <div
                          key={model.id}
                          className={cn(
                            'p-4 border rounded-lg transition-all',
                            selected 
                              ? 'border-primary bg-primary/5' 
                              : canSelect
                              ? 'border-border hover:border-primary/50 hover:bg-accent/50 cursor-pointer'
                              : 'border-muted bg-muted/30 cursor-not-allowed opacity-50'
                          )}
                          onClick={() => canSelect && !selected && handleAddModel(model)}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0 space-y-2">
                              <div className="font-medium text-sm truncate">
                                {model.name}
                              </div>
                              
                              {/* Model Badges */}
                              {verifiedModel.capabilities && (
                                <ModelBadges model={verifiedModel} size="sm" />
                              )}
                              
                              <div className="text-xs text-muted-foreground">
                                {model.contextLength.toLocaleString()} tokens
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {isFree ? (
                                  <span className="text-green-600 dark:text-green-400 font-medium">Free to use</span>
                                ) : (
                                  <span>${model.inputCost}/1K in • ${model.outputCost}/1K out</span>
                                )}
                              </div>
                              
                              {/* Description if available */}
                              {verifiedModel.description && (
                                <p className="text-xs text-muted-foreground/80 line-clamp-2 mt-1">
                                  {verifiedModel.description}
                                </p>
                              )}
                            </div>
                            
                            <div className="ml-3 flex-shrink-0">
                              {selected ? (
                                <div className="p-1 rounded-full bg-primary text-primary-foreground">
                                  <Check className="w-4 h-4" />
                                </div>
                              ) : canSelect ? (
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
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-border">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{singleMode ? 'Choose one model' : 'Select up to 5 models to compare'}</span>
            <span>{Object.values(filteredModelsByProvider).flat().length} models available</span>
          </div>
        </div>
      </div>
      </div>
    </Portal>
  )
}
