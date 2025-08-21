'use client'

import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { useModelTabsStore } from '@/lib/stores/modelTabs'
import { ModelSelectionModal } from './ModelSelectionModal'
import { ModelSettingsModal } from './ModelSettingsModal'
import { useIsClient } from '@/hooks/useIsClient'
import { cn } from '@/lib/utils'

interface ModelTabBarProps {
  className?: string
}

export function ModelTabBar({ className }: ModelTabBarProps) {
  const [showModal, setShowModal] = useState(false)
  const { selectedModels, removeModel, canAddMore } = useModelTabsStore()
  const isClient = useIsClient()

  // Don't render anything on server to avoid hydration issues
  if (!isClient) {
    return (
      <div className={cn('flex items-center gap-2 p-4 bg-background border-b border-border overflow-x-auto', className)}>
        <div className="flex items-center gap-2 min-w-max">
          {/* Placeholder content for SSR */}
        </div>
        <div className="flex-1" />
        <div className="text-xs text-muted-foreground whitespace-nowrap">
          Loading...
        </div>
      </div>
    )
  }

  const getProviderIcon = (provider: string) => {
    switch (provider) {
      case 'openai': return '🤖'
      case 'anthropic': return '🧠' 
      case 'gemini': return '💎'
      case 'openrouter': return '🌐'
      default: return '🔮'
    }
  }

  const getProviderColor = (provider: string) => {
    switch (provider) {
      case 'openai': return 'border-green-200 bg-green-50 text-green-800'
      case 'anthropic': return 'border-orange-200 bg-orange-50 text-orange-800'
      case 'gemini': return 'border-blue-200 bg-blue-50 text-blue-800'
      case 'openrouter': return 'border-purple-200 bg-purple-50 text-purple-800'
      default: return 'border-gray-200 bg-gray-50 text-gray-800'
    }
  }

  return (
    <>
      <div className={cn('flex items-center gap-2 p-4 bg-background border-b border-border overflow-x-auto', className)}>
        <div className="flex items-center gap-2 min-w-max">
          {selectedModels.map((selectedModel) => (
            <div
              key={selectedModel.id}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium whitespace-nowrap',
                getProviderColor(selectedModel.provider)
              )}
            >
              <span className="text-lg leading-none">
                {getProviderIcon(selectedModel.provider)}
              </span>
              <span className="truncate max-w-[120px]">
                {selectedModel.model.name}
              </span>
              <div className="flex items-center gap-0.5 ml-1">
                <ModelSettingsModal selectedModel={selectedModel} />
                <button
                  onClick={() => removeModel(selectedModel.id)}
                  className="p-0.5 hover:bg-black/10 rounded transition-colors"
                  title={`Remove ${selectedModel.model.name}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
          
          {canAddMore() && (
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-4 py-2 border-2 border-dashed border-muted-foreground/30 hover:border-muted-foreground/60 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Model
            </button>
          )}
        </div>
        
        <div className="flex-1" />
        
        <div className="text-xs text-muted-foreground whitespace-nowrap">
          {selectedModels.length}/5 models
        </div>
      </div>

      <ModelSelectionModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
      />
    </>
  )
}