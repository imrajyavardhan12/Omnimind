'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, Eye } from 'lucide-react'
import { ProviderName } from '@/lib/types'
import { useChatStore } from '@/lib/stores/chat'
import { useSettingsStore } from '@/lib/stores/settings'
import { cn } from '@/lib/utils'

interface HiddenProvidersProps {
  className?: string
}

export function HiddenProviders({ className }: HiddenProvidersProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const { visibleProviders, toggleProviderVisibility } = useChatStore()
  const { providers } = useSettingsStore()

  // Get list of hidden providers
  const hiddenProviders = Object.entries(visibleProviders)
    .filter(([_, isVisible]) => !isVisible)
    .map(([provider]) => provider as ProviderName)

  // Don't render if no hidden providers
  if (hiddenProviders.length === 0) {
    return null
  }

  return (
    <div className={cn('border border-border rounded-lg bg-background', className)}>
      {/* Collapsible Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-accent/50 transition-colors"
      >
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
          <span>
            Hidden Providers ({hiddenProviders.length})
          </span>
        </div>
      </button>

      {/* Expandable Content */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-2">
          <div className="text-xs text-muted-foreground mb-3">
            Click to show a provider and include it in responses
          </div>
          
          <div className="grid grid-cols-2 gap-2">
            {hiddenProviders.map((provider) => {
              const config = providers[provider]
              if (!config) return null

              return (
                <button
                  key={provider}
                  onClick={() => toggleProviderVisibility(provider)}
                  className="flex items-center gap-2 p-2 border border-border rounded-md hover:bg-accent hover:border-accent-foreground/20 transition-colors text-left"
                >
                  <Eye className="w-4 h-4 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {config.name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Click to show
                    </div>
                  </div>
                  <div className={cn(
                    'w-2 h-2 rounded-full flex-shrink-0',
                    config.enabled ? 'bg-green-500' : 'bg-gray-400'
                  )} />
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}