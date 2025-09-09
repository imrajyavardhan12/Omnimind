'use client'

import { useState } from 'react'
import { Plus, Settings, Check, RotateCcw, X } from 'lucide-react'
import { useViewModeStore } from '@/lib/stores/viewMode'
import { useModelTabsStore } from '@/lib/stores/modelTabs'
import { useSettingsStore } from '@/lib/stores/settings'
import { ModelSelectionModal } from './ModelSelectionModal'
import { cn } from '@/lib/utils'
import { getProviderIcon } from '@/components/ui/provider-icons'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useChatStore } from '@/lib/stores/chat'

interface SingleModelSelectorProps {
  className?: string
}

export function SingleModelSelector({ className }: SingleModelSelectorProps) {
  const [showModelModal, setShowModelModal] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [localSettings, setLocalSettings] = useState({
    temperature: 0.7,
    maxTokens: 1000,
    systemPrompt: ''
  })

  const { selectedSingleModel, setSelectedSingleModel } = useViewModeStore()
  const { getAllAvailableModels } = useModelTabsStore()
  const { providers, getApiKey } = useSettingsStore()
  const { createSession, getActiveSession } = useChatStore()

  // Get available models from enabled providers
  const availableModels = getAllAvailableModels().filter(model => {
    const provider = providers[model.provider as keyof typeof providers]
    return provider?.enabled && getApiKey(model.provider as any)
  })

  const getProviderColor = (provider: string) => {
    switch (provider) {
      case 'openai': return 'border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200'
      case 'anthropic': return 'border-orange-200 bg-orange-50 text-orange-800 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-200'
      case 'gemini': return 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200'
      case 'openrouter': return 'border-purple-200 bg-purple-50 text-purple-800 dark:border-purple-800 dark:bg-purple-950 dark:text-purple-200'
      default: return 'border-gray-200 bg-gray-50 text-gray-800 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-200'
    }
  }

  const handleModelSelect = (model: any) => {
    setSelectedSingleModel(model)
    setShowModelModal(false)
  }

  const handleSaveSettings = () => {
    // Here you would save the settings to a store or context
    // For now, we'll just close the popover
    setShowSettings(false)
  }

  const clearConversation = () => {
    createSession() // Creates a new session, effectively clearing the current one
  }

  return (
    <>
      <div className={cn('flex items-center gap-3 p-4 bg-background border-b border-border', className)}>
        {/* Current Model Display */}
        {selectedSingleModel ? (
          <div className={cn(
            'flex items-center gap-3 px-4 py-2 rounded-lg border text-sm font-medium',
            getProviderColor(selectedSingleModel.provider)
          )}>
            <div className="flex items-center gap-2">
              {getProviderIcon(selectedSingleModel.provider, "w-4 h-4")}
              <span className="truncate max-w-[200px]">
                {selectedSingleModel.name}
              </span>
            </div>

            {/* Settings Button */}
            <button
              onClick={() => setShowSettings(true)}
              className="p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded transition-colors"
              title="Model Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>No model selected</span>
          </div>
        )}

        <div className="flex-1" />

        {/* Clear Conversation Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={clearConversation}
          className="text-muted-foreground hover:text-foreground"
          title="Clear conversation"
        >
          <RotateCcw className="w-4 h-4" />
        </Button>

        {/* Add/Change Model Button */}
        <button
          onClick={() => setShowModelModal(true)}
          className="flex items-center gap-2 px-4 py-2 border-2 border-dashed border-muted-foreground/30 hover:border-muted-foreground/60 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <Plus className="w-4 h-4" />
          {selectedSingleModel ? 'Change Model' : 'Select Model'}
        </button>

        {/* Model Count Info */}
        <div className="text-xs text-muted-foreground whitespace-nowrap">
          {availableModels.length} models available
        </div>
      </div>

      {/* Model Selection Modal */}
      <ModelSelectionModal
        isOpen={showModelModal}
        onClose={() => setShowModelModal(false)}
        onModelSelect={handleModelSelect}
        singleMode={true}
      />

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background border border-border rounded-lg shadow-lg w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold">Model Settings</h3>
              <button
                onClick={() => setShowSettings(false)}
                className="p-1 hover:bg-accent rounded transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {selectedSingleModel && (
              <div className="space-y-6">
                {/* Model Info */}
                <div className="flex items-center gap-2 pb-4 border-b">
                  {getProviderIcon(selectedSingleModel.provider, "w-5 h-5")}
                  <span className="font-medium">{selectedSingleModel.name}</span>
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                    {selectedSingleModel.provider}
                  </span>
                </div>

                {/* Temperature */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Temperature</label>
                    <span className="text-sm text-muted-foreground">{localSettings.temperature}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.1"
                    value={localSettings.temperature}
                    onChange={(e) => setLocalSettings(prev => ({ ...prev, temperature: parseFloat(e.target.value) }))}
                    className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer slider"
                  />
                  <p className="text-xs text-muted-foreground">
                    Controls randomness. Lower = more focused, Higher = more creative
                  </p>
                </div>

                {/* Max Tokens */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium">Max Tokens</label>
                    <span className="text-sm text-muted-foreground">{localSettings.maxTokens}</span>
                  </div>
                  <input
                    type="range"
                    min="100"
                    max="4000"
                    step="100"
                    value={localSettings.maxTokens}
                    onChange={(e) => setLocalSettings(prev => ({ ...prev, maxTokens: parseInt(e.target.value) }))}
                    className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer slider"
                  />
                  <p className="text-xs text-muted-foreground">
                    Maximum length of the response
                  </p>
                </div>

                {/* System Prompt */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">System Prompt</label>
                  <Textarea
                    placeholder="Enter system instructions (optional)..."
                    value={localSettings.systemPrompt}
                    onChange={(e) => setLocalSettings(prev => ({ ...prev, systemPrompt: e.target.value }))}
                    className="min-h-[80px] resize-none text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Instructions that guide the model&apos;s behavior
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end gap-3 pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={() => setShowSettings(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSaveSettings}
                    className="flex items-center gap-2"
                  >
                    <Check className="w-4 h-4" />
                    Save Settings
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}