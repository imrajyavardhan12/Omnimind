'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, X, Crown, Users, ChevronDown, Check, Search } from 'lucide-react'
import { useCouncilStore } from '@/lib/stores/council'
import { useModelTabsStore } from '@/lib/stores/modelTabs'
import { useSettingsStore } from '@/lib/stores/settings'
import { Model } from '@/lib/types'
import { Portal } from '@/components/ui/portal'
import { getProviderIcon } from '@/components/ui/provider-icons'
import { cn } from '@/lib/utils'

interface CouncilModelSelectorProps {
  className?: string
}

export function CouncilModelSelector({ className }: CouncilModelSelectorProps) {
  const [showModelPicker, setShowModelPicker] = useState(false)
  const [showChairmanPicker, setShowChairmanPicker] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  
  const { councilModels, chairmanModel, addCouncilModel, removeCouncilModel, setChairmanModel } = useCouncilStore()
  const { getAllAvailableModels } = useModelTabsStore()
  const { providers, getApiKey } = useSettingsStore()
  
  // Get available models from enabled providers
  const availableModels = getAllAvailableModels().filter(model => {
    const provider = providers[model.provider as keyof typeof providers]
    return provider?.enabled && (getApiKey(model.provider as any) || provider.isFree)
  })

  const getProviderColor = (provider: string) => {
    const colors: Record<string, string> = {
      'openai': 'bg-green-500',
      'anthropic': 'bg-orange-500',
      'google-ai-studio': 'bg-blue-500',
      'gemini': 'bg-blue-500',
      'openrouter': 'bg-purple-500'
    }
    return colors[provider] || 'bg-gray-500'
  }

  const getProviderDisplayName = (provider: string) => {
    switch (provider) {
      case 'openai': return 'OpenAI'
      case 'anthropic': return 'Anthropic'
      case 'gemini': return 'Google Gemini'
      case 'google-ai-studio': return 'Google AI Studio'
      case 'openrouter': return 'OpenRouter'
      default: return provider
    }
  }

  const handleAddModel = (model: Model) => {
    addCouncilModel(model)
    setSearchQuery('')
    
    // Auto-set chairman if this is the first model
    if (councilModels.length === 0 && !chairmanModel) {
      setChairmanModel(model)
    }
    
    // Close modal if we've reached max
    if (councilModels.length >= 4) {
      setShowModelPicker(false)
    }
  }

  const handleSetChairman = (model: Model) => {
    setChairmanModel(model)
    setShowChairmanPicker(false)
  }

  const modelsNotInCouncil = availableModels.filter(
    m => !councilModels.find(cm => cm.id === m.id)
  )

  const filteredModels = modelsNotInCouncil.filter(m => 
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.provider.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Group models by provider
  const groupedModels = filteredModels.reduce((acc, model) => {
    const provider = model.provider
    if (!acc[provider]) acc[provider] = []
    acc[provider].push(model)
    return acc
  }, {} as Record<string, Model[]>)

  return (
    <div className={cn("space-y-4", className)}>
      {/* Council Members Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">Council Members</span>
            <span className="text-xs text-muted-foreground">
              ({councilModels.length} / 5 max)
            </span>
          </div>
        </div>

        {/* Selected Models */}
        <div className="flex flex-wrap gap-2">
          <AnimatePresence>
            {councilModels.map((model) => (
              <motion.div
                key={model.id}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg border",
                  chairmanModel?.id === model.id 
                    ? "bg-primary/10 border-primary/50" 
                    : "bg-muted/30 border-border"
                )}
              >
                <div className={cn("w-2 h-2 rounded-full", getProviderColor(model.provider))} />
                <span className="text-sm font-medium">{model.name}</span>
                {chairmanModel?.id === model.id && (
                  <Crown className="w-3 h-3 text-primary" />
                )}
                <button
                  onClick={() => {
                    removeCouncilModel(model.id)
                    if (chairmanModel?.id === model.id) {
                      setChairmanModel(councilModels.find(m => m.id !== model.id) || null)
                    }
                  }}
                  className="ml-1 p-0.5 rounded hover:bg-muted"
                >
                  <X className="w-3 h-3 text-muted-foreground" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Add Model Button */}
          {councilModels.length < 5 && (
            <button
              onClick={() => setShowModelPicker(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-border hover:border-primary hover:bg-primary/5 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span className="text-sm">Add Model</span>
            </button>
          )}
        </div>
      </div>

      {/* Chairman Section */}
      {councilModels.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Crown className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">Chairman</span>
            <span className="text-xs text-muted-foreground">
              (synthesizes final answer)
            </span>
          </div>

          <button
            onClick={() => setShowChairmanPicker(true)}
            className="flex items-center justify-between w-full max-w-xs px-3 py-2 rounded-lg border border-border hover:border-primary bg-background"
          >
            <div className="flex items-center gap-2">
              {chairmanModel ? (
                <>
                  <div className={cn("w-2 h-2 rounded-full", getProviderColor(chairmanModel.provider))} />
                  <span className="text-sm font-medium">{chairmanModel.name}</span>
                </>
              ) : (
                <span className="text-sm text-muted-foreground">Select chairman...</span>
              )}
            </div>
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      )}

      {/* Minimum models warning */}
      {councilModels.length < 2 && (
        <p className="text-xs text-amber-500">
          Add at least 2 models to start a council debate
        </p>
      )}

      {/* Model Picker Modal - Using Portal like Compare mode */}
      {showModelPicker && (
        <Portal>
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]">
            <div className="bg-background border border-border rounded-lg shadow-lg w-full max-w-4xl max-h-[80vh] flex flex-col mx-4">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-border">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
                    <Users className="w-5 h-5 text-primary-foreground" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold">Add Council Member</h2>
                    <p className="text-sm text-muted-foreground">
                      {councilModels.length}/5 members selected
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowModelPicker(false)
                    setSearchQuery('')
                  }}
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
                    className="w-full pl-10 pr-4 py-2 border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                    autoFocus
                  />
                </div>
              </div>

              {/* Models by Provider */}
              <div className="flex-1 overflow-y-auto p-6">
                {Object.keys(groupedModels).length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="text-4xl mb-4">🔍</div>
                    <p className="text-muted-foreground">
                      {modelsNotInCouncil.length === 0 
                        ? "All available models are already in the council"
                        : "No models found matching your search"
                      }
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {Object.entries(groupedModels).map(([provider, models]) => (
                      <div key={provider}>
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-6 h-6">{getProviderIcon(provider, "w-6 h-6")}</div>
                          <h3 className="text-lg font-semibold">{getProviderDisplayName(provider)}</h3>
                          <span className="text-sm text-muted-foreground">({models.length} models)</span>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {models.map((model) => (
                            <div
                              key={model.id}
                              className="p-4 border border-border rounded-lg hover:border-primary/50 hover:bg-accent/50 cursor-pointer transition-all"
                              onClick={() => handleAddModel(model)}
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex-1 min-w-0 space-y-1">
                                  <div className="font-medium text-sm truncate">
                                    {model.name}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {model.contextLength.toLocaleString()} tokens
                                  </div>
                                </div>
                                <div className="ml-3 flex-shrink-0">
                                  <div className="p-1 rounded-full border border-primary text-primary hover:bg-primary hover:text-primary-foreground transition-colors">
                                    <Plus className="w-4 h-4" />
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-6 border-t border-border">
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>Select models to add to your council</span>
                  <span>{filteredModels.length} models available</span>
                </div>
              </div>
            </div>
          </div>
        </Portal>
      )}

      {/* Chairman Picker Modal - Using Portal like Compare mode */}
      {showChairmanPicker && (
        <Portal>
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]">
            <div className="bg-background border border-border rounded-lg shadow-lg w-full max-w-md max-h-[60vh] flex flex-col mx-4">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-border">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
                    <Crown className="w-5 h-5 text-primary-foreground" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold">Select Chairman</h2>
                    <p className="text-sm text-muted-foreground">
                      Synthesizes the final answer
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowChairmanPicker(false)}
                  className="p-2 hover:bg-accent rounded-md transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Model List */}
              <div className="flex-1 overflow-y-auto p-4">
                <div className="space-y-2">
                  {councilModels.map((model) => (
                    <div
                      key={model.id}
                      onClick={() => handleSetChairman(model)}
                      className={cn(
                        "p-4 border rounded-lg cursor-pointer transition-all",
                        chairmanModel?.id === model.id 
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-primary/50 hover:bg-accent/50"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={cn("w-3 h-3 rounded-full", getProviderColor(model.provider))} />
                          <div>
                            <div className="font-medium">{model.name}</div>
                            <div className="text-xs text-muted-foreground">{getProviderDisplayName(model.provider)}</div>
                          </div>
                        </div>
                        {chairmanModel?.id === model.id && (
                          <div className="p-1 rounded-full bg-primary text-primary-foreground">
                            <Check className="w-4 h-4" />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </Portal>
      )}
    </div>
  )
}
