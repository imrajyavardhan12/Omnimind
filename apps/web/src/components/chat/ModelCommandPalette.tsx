'use client'

import { useEffect, useState } from 'react'
import { Command } from 'cmdk'
import { X, Search, Loader2, AlertCircle } from 'lucide-react'
import { Model, ProviderName } from '@/lib/types'
import { useModelTabsStore } from '@/lib/stores/modelTabs'
import { useSettingsStore } from '@/lib/stores/settings'
import { useViewModeStore } from '@/lib/stores/viewMode'
import { getProviderIcon, getProviderDisplayName } from '@/components/ui/provider-icons'
import { ModelBadges } from './ModelBadges'
import { cn } from '@/lib/utils'
import { Portal } from '@/components/ui/portal'
import type { VerifiedModel } from '@/lib/models/verified-models'
import { useAvailableModels } from '@/features/models/hooks/useModels'

interface ModelCommandPaletteProps {
  isOpen: boolean
  onClose: () => void
  onModelSelect?: (model: Model) => void
  singleMode?: boolean
}

export function ModelCommandPalette({ 
  isOpen, 
  onClose, 
  onModelSelect, 
  singleMode = false 
}: ModelCommandPaletteProps) {
  const [search, setSearch] = useState('')
  const { addModel, isModelSelected, canAddMore, selectedModels } = useModelTabsStore()
  const { setSelectedSingleModel } = useViewModeStore()
  const { providers } = useSettingsStore()
  const { models: allModels, isLoading, error } = useAvailableModels({ enabledOnly: true })
  const accessibleModels = allModels.filter((model) => {
    const providerConfig = providers[model.provider as ProviderName]
    return Boolean(providerConfig?.enabled && (providerConfig?.apiKey || providerConfig?.isFree))
  })

  // Group models by provider
  const modelsByProvider = accessibleModels.reduce((acc, model) => {
    if (!acc[model.provider]) {
      acc[model.provider] = []
    }
    acc[model.provider].push(model)
    return acc
  }, {} as Record<string, Model[]>)

  const handleSelectModel = (model: Model) => {
    if (singleMode) {
      if (onModelSelect) {
        onModelSelect(model)
      } else {
        setSelectedSingleModel(model)
      }
    } else {
      if (!isModelSelected(model.id, model.provider) && canAddMore()) {
        addModel(model)
      }
    }
    onClose()
  }

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown, true)
    return () => document.removeEventListener('keydown', handleKeyDown, true)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <Portal>
      <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-[9999] pt-[10vh]">
        <Command 
          className="bg-background border border-border rounded-lg shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden"
          shouldFilter={false} // We handle filtering manually for better control
        >
          {/* Search Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
            <Search className="w-5 h-5 text-muted-foreground flex-shrink-0" />
            <Command.Input
              value={search}
              onValueChange={setSearch}
              placeholder="Search models... (Type to filter)"
              className="flex-1 bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground text-base"
              autoFocus
            />
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-accent rounded-md transition-colors flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Results */}
          <Command.List className="flex-1 overflow-y-auto p-2">
            {isLoading && (
              <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading model catalog...
              </div>
            )}

            {error && (
              <div className="m-2 flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="w-4 h-4" />
                Failed to load model catalog.
              </div>
            )}

            {!isLoading && !error && accessibleModels.length === 0 && (
              <div className="py-12 text-center text-sm text-muted-foreground">
                No models found
              </div>
            )}

            {!isLoading && !error && Object.entries(modelsByProvider).map(([provider, models]) => {
              const providerConfig = providers[provider as ProviderName]

              // Filter models based on search
              const filteredModels = models.filter(model =>
                model.name.toLowerCase().includes(search.toLowerCase()) ||
                model.id.toLowerCase().includes(search.toLowerCase()) ||
                (model as VerifiedModel).tags?.some(tag => 
                  tag.toLowerCase().includes(search.toLowerCase())
                )
              )

              if (filteredModels.length === 0) return null

              return (
                <Command.Group
                  key={provider}
                  heading={
                    <div className="flex items-center gap-2 px-2 py-1.5">
                      {getProviderIcon(provider, "w-4 h-4")}
                      <span className="font-semibold">{getProviderDisplayName(provider)}</span>
                      <span className="text-muted-foreground text-xs">
                        ({filteredModels.length})
                      </span>
                    </div>
                  }
                  className="mb-3"
                >
                  {filteredModels.map((model) => {
                    const verifiedModel = model as VerifiedModel
                    const selected = !singleMode && isModelSelected(model.id, model.provider)
                    const canAdd = singleMode || canAddMore() || selected
                    const isFree = Boolean(providerConfig?.isFree) || (model.inputCost === 0 && model.outputCost === 0)

                    return (
                      <Command.Item
                        key={model.id}
                        value={`${provider}-${model.id}-${model.name}`}
                        onSelect={() => canAdd && !selected && handleSelectModel(model)}
                        disabled={!canAdd || selected}
                        className={cn(
                          'flex items-start gap-3 px-3 py-2.5 rounded-md cursor-pointer transition-colors',
                          'aria-selected:bg-accent',
                          selected && 'opacity-50 cursor-not-allowed bg-muted',
                          !canAdd && !selected && 'opacity-50 cursor-not-allowed'
                        )}
                      >
                        {/* Provider Icon */}
                        <div className="flex-shrink-0 mt-0.5">
                          {getProviderIcon(provider, "w-5 h-5")}
                        </div>

                        {/* Model Info */}
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm truncate">
                              {model.name}
                            </span>
                            {selected && (
                              <span className="text-xs text-muted-foreground">
                                (Selected)
                              </span>
                            )}
                          </div>

                          {/* Badges */}
                          {verifiedModel.capabilities && (
                            <ModelBadges model={verifiedModel} size="sm" />
                          )}

                          {/* Pricing & Context */}
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span>
                              {isFree ? (
                                <span className="text-green-600 dark:text-green-400 font-medium">
                                  Free
                                </span>
                              ) : (
                                <span>
                                  ${model.inputCost?.toFixed(4)}/1K in • ${model.outputCost?.toFixed(4)}/1K out
                                </span>
                              )}
                            </span>
                            <span className="text-muted-foreground/60">•</span>
                            <span>{model.contextLength.toLocaleString()} tokens</span>
                          </div>

                          {/* Description (if available) */}
                          {verifiedModel.description && (
                            <p className="text-xs text-muted-foreground line-clamp-1">
                              {verifiedModel.description}
                            </p>
                          )}
                        </div>
                      </Command.Item>
                    )
                  })}
                </Command.Group>
              )
            })}
          </Command.List>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-border bg-muted/30">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center gap-4">
                <span>↑↓ Navigate</span>
                <span>↵ Select</span>
                <span>ESC Close</span>
              </div>
              {!singleMode && (
                <span>
                  {selectedModels.length} / 5 selected
                </span>
              )}
            </div>
          </div>
        </Command>
      </div>
    </Portal>
  )
}
